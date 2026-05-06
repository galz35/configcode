# SQL Poster Reference

## Table of Contents
- [Query Patterns](#queries)
- [CTEs (Common Table Expressions)](#ctes)
- [Window Functions](#windows)
- [Indexes & Performance](#indexes)
- [Data Types & Casting](#types)
- [Constraints & Triggers](#constraints)
- [PL/pgSQL](#plpgsql)
- [Transactions & Concurrency](#transactions)
- [JSON Operations](#json)
- [Migrations](#migrations)
- [Common Pitfalls](#pitfalls)

---

## Query Patterns

### Pagination (Keyset/Cursor-based)

```sql
-- BEST: Keyset pagination (stable, performant, no offset)
SELECT id, email, name, created_at
FROM users
WHERE created_at < $cursor OR (created_at = $cursor AND id > $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- ACCEPTABLE: Offset-based for small datasets or page number UIs
SELECT id, email, name, created_at
FROM users
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;  -- page 3
```

### Aggregation

```sql
-- Count with filters
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_last_30d
FROM users;

-- Aggregation with grouping sets (multiple group levels in one query)
SELECT
  COALESCE(region, 'ALL') AS region,
  COALESCE(country, 'ALL') AS country,
  COUNT(*) AS users
FROM user_locations
GROUP BY GROUPING SETS ((), (region), (region, country))
ORDER BY region, country;

-- Percentiles
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_total) AS median,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY order_total) AS p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY order_total) AS p99
FROM orders
WHERE created_at >= now() - interval '30 days';
```

### Upsert (INSERT ON CONFLICT)

```sql
-- Basic upsert
INSERT INTO users (id, email, name, login_count)
VALUES ($1, $2, $3, 1)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    login_count = users.login_count + 1,
    updated_at = now()
RETURNING *;

-- UPSERT with WHERE condition (partial upsert)
INSERT INTO inventory (product_id, warehouse_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (product_id, warehouse_id)
DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity
WHERE inventory.warehouse_id = EXCLUDED.warehouse_id
RETURNING *;

-- DO NOTHING (insert if not exists, else ignore)
INSERT INTO tags (name) VALUES ($1)
ON CONFLICT (name) DO NOTHING
RETURNING id;
```

### Bulk Operations

```sql
-- BATCH INSERT
INSERT INTO logs (user_id, action, metadata)
SELECT * FROM unnest(
  $1::uuid[],    -- user_ids array
  $2::text[],    -- actions array
  $3::jsonb[]    -- metadata array
);

-- BATCH UPDATE with CASE
UPDATE products
SET price = CASE id
  WHEN 1 THEN 19.99
  WHEN 2 THEN 29.99
  WHEN 3 THEN 39.99
END
WHERE id IN (1, 2, 3);

-- BATCH DELETE with subquery
DELETE FROM sessions
WHERE user_id = $1
AND id NOT IN (
  SELECT id FROM sessions
  WHERE user_id = $1
  ORDER BY created_at DESC
  LIMIT 5  -- keep 5 most recent
);
```

### Recursive Queries

```sql
-- Recursive CTE for hierarchy/tree traversal
WITH RECURSIVE category_tree AS (
  -- Base case: root categories
  SELECT id, name, parent_id, 0 AS depth, ARRAY[id] AS path
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  -- Recursive case: children
  SELECT c.id, c.name, c.parent_id, ct.depth + 1, ct.path || c.id
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY path;
```

---

## CTEs (Common Table Expressions)

### Basic CTE

```sql
WITH active_users AS (
  SELECT id, email, name
  FROM users
  WHERE status = 'active'
    AND last_active_at >= now() - interval '90 days'
),
recent_orders AS (
  SELECT user_id, COUNT(*) AS order_count, SUM(total) AS total_spent
  FROM orders
  WHERE created_at >= now() - interval '30 days'
  GROUP BY user_id
)
SELECT u.*, COALESCE(ro.order_count, 0) AS orders, COALESCE(ro.total_spent, 0) AS spent
FROM active_users u
LEFT JOIN recent_orders ro ON ro.user_id = u.id
ORDER BY spent DESC NULLS LAST;
```

### Multi-Step Data Pipeline

```sql
-- Data pipeline: enrich -> filter -> aggregate -> rank
WITH enriched AS (
  SELECT
    o.*,
    u.region,
    EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 3600 AS delivery_hours,
    CASE
      WHEN o.total >= 100 THEN 'premium'
      WHEN o.total >= 50 THEN 'standard'
      ELSE 'budget'
    END AS tier
  FROM orders o
  JOIN users u ON u.id = o.user_id
  WHERE o.status = 'delivered'
),
filtered AS (
  SELECT * FROM enriched
  WHERE delivery_hours IS NOT NULL
    AND delivery_hours < 720  -- exclude > 30 days
),
aggregated AS (
  SELECT
    region,
    tier,
    COUNT(*) AS total_orders,
    ROUND(AVG(delivery_hours), 1) AS avg_delivery_hours,
    SUM(total) AS revenue
  FROM filtered
  GROUP BY region, tier
)
SELECT
  *,
  RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS rank_in_region
FROM aggregated
ORDER BY region, rank_in_region;
```

### CTE for Audit/Logging

```sql
-- Delete old records but log them to an archive table
WITH deleted AS (
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days'
  RETURNING *
)
INSERT INTO notifications_archive (id, user_id, title, body, read, created_at, deleted_at)
SELECT id, user_id, title, body, read, created_at, now()
FROM deleted;
```

---

## Window Functions

### Rankings

```sql
-- ROW_NUMBER: unique sequential number
-- RANK: same value gets same rank, gaps after ties
-- DENSE_RANK: same value gets same rank, no gaps
-- NTILE: divide into N buckets

SELECT
  department_id,
  employee_name,
  salary,
  ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS row_num,
  RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rank,
  DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dense_rank,
  NTILE(4) OVER (PARTITION BY department_id ORDER BY salary DESC) AS quartile
FROM employees;
```

### Value Windows

```sql
-- LAG/LEAD: access previous/next rows
-- FIRST_VALUE/LAST_VALUE: first/last in window
-- NTH_VALUE: nth value in window

SELECT
  date,
  revenue,
  LAG(revenue, 1) OVER (ORDER BY date) AS prev_day_revenue,
  LAG(revenue, 7) OVER (ORDER BY date) AS prev_week_revenue,
  LEAD(revenue, 1) OVER (ORDER BY date) AS next_day_revenue,
  ROUND(
    (revenue - LAG(revenue, 1) OVER (ORDER BY date)) * 100.0 /
    NULLIF(LAG(revenue, 1) OVER (ORDER BY date), 0),
    2
  ) AS pct_change_from_prev_day,
  AVG(revenue) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling_7day_avg,
  SUM(revenue) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_revenue
FROM daily_revenue
ORDER BY date DESC;
```

### Cumulative and Moving Aggregates

```sql
-- Running total
SELECT
  user_id,
  created_at,
  amount,
  SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at) AS running_total,
  AVG(amount) OVER (
    PARTITION BY user_id
    ORDER BY created_at
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) AS moving_avg_3,
  MAX(amount) OVER (
    PARTITION BY user_id
    ORDER BY created_at
    ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
  ) AS max_last_10
FROM transactions
ORDER BY user_id, created_at;
```

---

## Indexes & Performance

### Index Types

```sql
-- B-tree (default): equality + range queries
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_status_created ON users (status, created_at DESC);

-- Partial index: smaller, faster for specific queries
CREATE INDEX idx_orders_pending ON orders (created_at)
WHERE status = 'pending';

-- GIN: full-text search, arrays, JSONB
CREATE INDEX idx_posts_fts ON posts USING gin(to_tsvector('english', title || ' ' || body));
CREATE INDEX idx_users_tags ON users USING gin (tags);

-- GiST: geometric data, full-text, range types
CREATE INDEX idx_locations ON locations USING gist (coordinate);

-- BRIN: very large tables, physical correlation with column
CREATE INDEX idx_audit_log_created ON audit_logs USING brin (created_at);

-- Covering index (INCLUDE): index-only scans
CREATE INDEX idx_users_email_name ON users (email) INCLUDE (name, avatar_url);

-- Unique index (prefer over unique constraint for partial/dynamic)
CREATE UNIQUE INDEX idx_users_lower_email ON users (LOWER(email));
CREATE UNIQUE INDEX idx_active_tags ON tags (name) WHERE deleted_at IS NULL;
```

### EXPLAIN ANALYZE

```sql
-- Understand query performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id, u.email
HAVING COUNT(o.id) > 5;

-- Key metrics to watch:
--   "Planning Time": < 5ms is good
--   "Execution Time": depends on query
--   "Shared Hit": data from cache (fast)
--   "Shared Read": data from disk (slow, check indexes)
--   "Seq Scan": scanning entire table (bad for large tables, need index)
--   "Index Only Scan": perfect, no table access
--   "Heap Fetches": rows fetched from table during index-only scan
```

### Query Optimization

```sql
-- BAD: Function on indexed column prevents index usage
SELECT * FROM users WHERE LOWER(email) = 'test@test.com';

-- GOOD: Index the expression
CREATE INDEX idx_users_lower_email ON users (LOWER(email));
-- Then: SELECT * FROM users WHERE LOWER(email) = 'test@test.com';

-- BAD: LIKE with leading wildcard
SELECT * FROM posts WHERE body ILIKE '%search term%';

-- GOOD: Full-text search
SELECT * FROM posts
WHERE to_tsvector('english', body) @@ plainto_tsquery('english', 'search term');

-- BAD: NOT IN with potential NULLs
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blacklist);

-- GOOD: NOT EXISTS (NULL-safe + usually faster)
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM blacklist b WHERE b.user_id = u.id);

-- BAD: OFFSET on large tables (reads + discards rows)
SELECT * FROM users OFFSET 100000 LIMIT 20;

-- GOOD: Keyset pagination (see pagination section above)
```

### Table Partitioning

```sql
-- Range partition by date
CREATE TABLE orders (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  total decimal NOT NULL,
  created_at timestamptz NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024q1 PARTITION OF orders
FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE orders_2024q2 PARTITION OF orders
FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Default partition catch-all
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- List partition by region
CREATE TABLE users PARTITION BY LIST (region);
CREATE TABLE users_na PARTITION OF users FOR VALUES IN ('US', 'CA', 'MX');
CREATE TABLE users_eu PARTITION OF users FOR VALUES IN ('DE', 'FR', 'IT', 'ES');
```

---

## Data Types & Casting

```sql
-- UUID
CREATE TABLE items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id)
);

-- ENUM (native, efficient)
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- Array
SELECT tags[1] AS first_tag, cardinality(tags) AS tag_count
FROM posts
WHERE 'important' = ANY(tags);

-- Range types
SELECT * FROM reservations
WHERE daterange(check_in, check_out, '[]') && daterange('2024-06-01', '2024-06-07', '[]');

-- INTERVAL arithmetic
SELECT
  now() AS now,
  now() - interval '1 day' AS yesterday,
  now() + interval '1 month' AS next_month,
  age(now(), created_at) AS account_age
FROM users;

-- Casting
SELECT
  '123'::integer,
  created_at::date,
  total::text,
  status::user_status,
  CAST(metadata AS jsonb)
FROM orders;
```

---

## Constraints & Triggers

### Constraints

```sql
CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  score integer DEFAULT 0,

  -- Check constraints
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT users_score_check CHECK (score >= 0),

  -- Unique constraints
  CONSTRAINT users_email_unique UNIQUE (email),

  -- Exclusion constraints (no overlapping ranges)
  CONSTRAINT users_no_overlap EXCLUDE USING gist (
    daterange(valid_from, valid_to, '[]') WITH &&
  )
);
```

### Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_setting('app.current_user_id', true)::uuid);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_user_id', true)::uuid);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_setting('app.current_user_id', true)::uuid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Soft delete trigger (prevent hard deletes)
CREATE OR REPLACE FUNCTION prevent_hard_delete()
RETURNS trigger AS $$
BEGIN
  UPDATE users SET deleted_at = now() WHERE id = OLD.id;
  RETURN NULL; -- cancel the DELETE
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER soft_delete_users
  INSTEAD OF DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_hard_delete();
```

---

## PL/pgSQL

### Stored Functions

```sql
-- Basic function
CREATE OR REPLACE FUNCTION calculate_order_total(p_user_id uuid, p_order_date date)
RETURNS decimal
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(total), 0)
  FROM orders
  WHERE user_id = p_user_id
    AND created_at::date = p_order_date
    AND status != 'cancelled';
$$;

-- Complex function with variables
CREATE OR REPLACE FUNCTION create_user_with_defaults(
  p_email text,
  p_name text,
  p_role text DEFAULT 'user'
) RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user users;
BEGIN
  -- Validate input
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty' USING ERRCODE = 'check_violation';
  END IF;

  -- Insert user
  INSERT INTO users (email, name, role)
  VALUES (p_email, p_name, p_role)
  RETURNING id INTO v_user_id;

  -- Create default profile
  INSERT INTO profiles (user_id, theme, notifications_enabled)
  VALUES (v_user_id, 'light', true);

  -- Create welcome notification
  INSERT INTO notifications (user_id, title, body)
  VALUES (v_user_id, 'Welcome!', 'Thanks for joining, ' || p_name || '!');

  -- Return the created user
  SELECT * INTO v_user FROM users WHERE id = v_user_id;
  RETURN v_user;
END;
$$;

-- Function returning table
CREATE OR REPLACE FUNCTION get_user_posts(
  p_user_id uuid,
  p_limit int DEFAULT 10
) RETURNS TABLE (
  post_id uuid,
  title text,
  created_at timestamptz,
  comment_count bigint,
  like_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.title,
    p.created_at,
    COUNT(DISTINCT c.id) AS comment_count,
    COUNT(DISTINCT l.id) AS like_count
  FROM posts p
  LEFT JOIN comments c ON c.post_id = p.id
  LEFT JOIN likes l ON l.post_id = p.id
  WHERE p.user_id = p_user_id
  GROUP BY p.id
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;
```

---

## Transactions & Concurrency

```sql
-- Basic transaction with savepoints
BEGIN;
  -- Deduct from sender
  UPDATE accounts SET balance = balance - 100 WHERE id = $1;
  
  SAVEPOINT deduct_sender;

  -- Add to receiver
  UPDATE accounts SET balance = balance + 100 WHERE id = $2;
  
  -- Check no negative balances
  IF EXISTS (SELECT 1 FROM accounts WHERE id = $1 AND balance < 0) THEN
    ROLLBACK TO SAVEPOINT deduct_sender;
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

COMMIT;

-- Advisory lock for app-level synchronization
SELECT pg_advisory_lock(12345);  -- acquire lock
  -- do the work
SELECT pg_advisory_unlock(12345); -- release lock

-- Non-blocking lock attempt
SELECT pg_try_advisory_lock(12345);

-- Pessimistic locking (SELECT ... FOR UPDATE)
BEGIN;
  SELECT * FROM inventory
  WHERE product_id = $1
  FOR UPDATE;  -- blocks other transactions from updating this row

  -- Check stock, then decrement
  UPDATE inventory SET quantity = quantity - $2
  WHERE product_id = $1 AND quantity >= $2;

  -- If no rows updated, rollback
  IF NOT FOUND THEN
    ROLLBACK;
    RAISE EXCEPTION 'Insufficient stock';
  END IF;
COMMIT;

-- Optimistic locking with version column
UPDATE documents
SET content = $2, version = version + 1, updated_at = now()
WHERE id = $1 AND version = $3;  -- $3 = expected version

IF NOT FOUND THEN
  RAISE EXCEPTION 'Document was modified by another user. Refresh and try again.';
END IF;
```

### Transaction Isolation Levels

```sql
-- Read Committed (default): each statement sees committed data
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Repeatable Read: all reads within transaction see same snapshot
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Serializable: strictest, concurrent transactions must produce same result as sequential
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

---

## JSON Operations

```sql
-- JSONB is preferred over JSON (faster, indexes, operators)
ALTER TABLE users ADD COLUMN preferences jsonb DEFAULT '{}';

-- Extract / Access
SELECT
  preferences->>'theme' AS theme,
  preferences->'notifications'->>'email' AS email_notifications,
  preferences#>>'{notifications,push}' AS push_notifications,
  preferences ? 'lang' AS has_language
FROM users;

-- Update JSONB fields
UPDATE users
SET preferences = preferences || '{"theme": "dark"}'::jsonb;  -- merge

UPDATE users
SET preferences = jsonb_set(preferences, '{notifications,email}', '"true"');  -- set nested

-- Query JSONB arrays
SELECT * FROM posts
WHERE tags @> '["important"]'::jsonb;  -- contains

SELECT * FROM users
WHERE preferences->'roles' ? 'admin';  -- key exists in object

SELECT * FROM users
WHERE preferences->'tags' ?| ARRAY['vip', 'premium'];  -- any of

-- Indexing JSONB
CREATE INDEX idx_users_preferences ON users USING gin (preferences jsonb_path_ops);
CREATE INDEX idx_users_theme ON users ((preferences->>'theme'));

-- Generating JSON from relational data
SELECT json_build_object(
  'id', u.id,
  'email', u.email,
  'posts', (
    SELECT json_agg(json_build_object('id', p.id, 'title', p.title))
    FROM posts p WHERE p.user_id = u.id
  )
) AS user_with_posts
FROM users u;

-- Array aggregation
SELECT
  user_id,
  json_agg(json_build_object('id', id, 'title', title) ORDER BY created_at DESC) AS posts
FROM posts
GROUP BY user_id;
```

---

## Migrations

```sql
-- Best practice: always write reversible migrations
-- Use transactional DDL so failed migrations rollback

-- UP: Create table
CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text NOT NULL,
  name text NOT NULL,
  price decimal(10, 2) NOT NULL CHECK (price >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  attributes jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,  -- soft delete
  CONSTRAINT products_sku_unique UNIQUE (sku)
);

CREATE INDEX idx_products_category ON products (category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_attributes ON products USING gin (attributes);

-- DOWN:
-- DROP TABLE IF EXISTS products;

-- UP: Add column (safe - nullable or with default)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- DOWN:
-- ALTER TABLE products DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS is_featured;

-- UP: Add column with NOT NULL (safer approach)
-- Step 1: add as nullable
ALTER TABLE products ADD COLUMN IF NOT EXISTS status text;
-- Step 2: populate default for existing rows
UPDATE products SET status = 'active' WHERE status IS NULL;
-- Step 3: add NOT NULL constraint
ALTER TABLE products ALTER COLUMN status SET NOT NULL;

-- UP: Rename column (safe with transactional DDL)
ALTER TABLE products RENAME COLUMN description TO summary;
```

---

## Common Pitfalls

### 1. Implicit Type Conversion
```sql
-- BAD: Implicit string to integer conversion can error or be slow
INSERT INTO items (count) VALUES ('10'); -- might work, might not

-- GOOD: Explicit cast
INSERT INTO items (count) VALUES ('10'::integer);
```

### 2. COUNT(*) vs COUNT(column)
```sql
-- count(*) counts all rows (including NULLs)
-- count(column) counts non-NULL values only
SELECT
  COUNT(*) AS total_rows,     -- 1000
  COUNT(email) AS with_email, -- 950 (50 NULL emails)
  COUNT(DISTINCT email) AS unique_emails
FROM users;
```

### 3. NOT IN with NULLs
```sql
-- BAD: NOT IN with NULL subquery = empty result (silent bug!)
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blacklist);
-- If blacklist has a NULL user_id, the whole expression becomes NULL = 0 rows

-- GOOD: Use NOT EXISTS (NULL-safe)
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM blacklist b WHERE b.user_id = u.id);
```

### 4. Unoptimized IN with large lists
```sql
-- BAD: Large IN list (hundreds of items)
SELECT * FROM orders WHERE id IN (1, 2, 3, ..., 999);

-- GOOD: JOIN to a temporary table or VALUES
WITH order_ids AS (
  SELECT unnest($1::uuid[]) AS id
)
SELECT o.* FROM orders o JOIN order_ids oid ON o.id = oid.id;
```

### 5. DISTINCT abuse
```sql
-- BAD: Using DISTINCT to hide duplicate joins
SELECT DISTINCT u.id, u.email, u.name
FROM users u
JOIN orders o ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id;  -- multiple rows per user

-- GOOD: Use EXISTS or fix the JOIN logic
SELECT u.id, u.email, u.name
FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

### 6. Table bloat (autovacuum)
```sql
-- Check for bloat (dead tuples)
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;

-- Manual VACUUM (use sparingly, autovacuum should handle this)
-- VACUUM ANALYZE users;
```

### 7. Missing schema qualifications
```sql
-- BAD: Not qualifying table names = search_path dependent
SELECT * FROM users;  -- which schema?
-- If search_path changes, this might break

-- GOOD: Always qualify in production code
SELECT * FROM public.users;
```
