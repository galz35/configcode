# SQL Advanced Patterns (PostgreSQL + SQL Server)

Patrones de produccion que van mas alla de lo basico.

## Materialized Views (PostgreSQL)

```sql
-- View materializada: resultado precomputado, refrescar manualmente
CREATE MATERIALIZED VIEW mv_user_stats AS
SELECT
  u.id,
  u.email,
  COUNT(DISTINCT o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_spent,
  COUNT(DISTINCT o.id) FILTER (WHERE o.created_at >= now() - interval '30 days') AS orders_last_30d,
  MAX(o.created_at) AS last_order_at
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email;

-- Indice en la view materializada
CREATE UNIQUE INDEX ON mv_user_stats (id);
CREATE INDEX ON mv_user_stats (last_order_at DESC);

-- Refrescar (puede ser via cron/pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;
-- CONCURRENTLY evita locks pero requiere indice unico

-- Programado con pg_cron
SELECT cron.schedule('refresh-user-stats', '0 */6 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats');
```

## Full-Text Search (PostgreSQL)

```sql
-- Crear columna de busqueda
ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) STORED;

-- Indice GIN
CREATE INDEX idx_posts_search ON posts USING gin(search_vector);

-- Buscar con ranking
SELECT
  id, title,
  ts_rank(search_vector, query) AS rank,
  ts_headline('english', body, query, 'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>') AS snippet
FROM posts, plainto_tsquery('english', 'react hooks performance') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;

-- Busqueda con autocorrect (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);

SELECT *, similarity(name, 'Jon') AS score
FROM users
WHERE name % 'Jon'  -- similarity >= threshold (default 0.3)
ORDER BY similarity(name, 'Jon') DESC
LIMIT 10;
-- SELECT set_limit(0.2); para cambiar threshold
```

## Row-Level Security (PostgreSQL)

```sql
-- Habilitar RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Usuario de aplicacion vs admin
CREATE POLICY doc_owner_policy ON documents
  FOR ALL
  TO app_user
  USING (owner_id = current_setting('app.current_user_id')::uuid)
  WITH CHECK (owner_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY doc_admin_all ON documents
  FOR ALL
  TO admin_user
  USING (true);

-- Bypass RLS para migraciones (usar con cuidado)
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- La app setea el user al inicio de la sesion
-- SELECT set_config('app.current_user_id', 'uuid-aqui', true);
-- SELECT set_config('app.tenant_id', 'tenant-id', true);

-- Multi-tenant RLS
CREATE POLICY tenant_isolation ON orders
  FOR ALL
  TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

## Table Partitioning Avanzado

```sql
-- PostgreSQL: particion por hash (distribucion uniforme)
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
) PARTITION BY HASH (tenant_id);

CREATE TABLE events_p0 PARTITION OF events FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE events_p1 PARTITION OF events FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE events_p2 PARTITION OF events FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE events_p3 PARTITION OF events FOR VALUES WITH (modulus 4, remainder 3);

-- Subparticion: primero hash(tenant), luego range(fecha)
CREATE TABLE events_p0 PARTITION OF events
FOR VALUES WITH (modulus 4, remainder 0)
PARTITION BY RANGE (created_at);

CREATE TABLE events_p0_2024q1 PARTITION OF events_p0
FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

-- Detach para archivar (sin bloquear)
ALTER TABLE events DETACH PARTITION events_p0_2023q4;
-- Luego mover a otro tablespace, comprimir, o archivar

-- SQL Server: partition function + scheme
CREATE PARTITION FUNCTION pf_OrderDate (DATETIME2)
AS RANGE RIGHT FOR VALUES ('2024-01-01', '2024-04-01', '2024-07-01', '2024-10-01');

CREATE PARTITION SCHEME ps_OrderDate
AS PARTITION pf_OrderDate ALL TO ([PRIMARY]);

CREATE TABLE Orders (
  Id INT IDENTITY,
  OrderDate DATETIME2 NOT NULL,
  Total DECIMAL(10,2)
) ON ps_OrderDate (OrderDate);
```

## Query Performance Profiling

```sql
-- PostgreSQL: ver queries lentas
SELECT queryid, query, calls, mean_exec_time, total_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Habilitar: CREATE EXTENSION pg_stat_statements;
-- En postgresql.conf: shared_preload_libraries = 'pg_stat_statements'

-- Ver bloqueos activos
SELECT
  blocked_locks.pid AS blocked_pid,
  blocking_locks.pid AS blocking_pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query,
  blocked_activity.wait_event_type || '/' || blocked_activity.wait_event AS wait_event
FROM pg_locks blocked_locks
JOIN pg_locks blocking_locks
  ON blocked_locks.locktype = blocking_locks.locktype
  AND blocked_locks.database IS NOT DISTINCT FROM blocking_locks.database
  AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
  AND blocked_locks.page IS NOT DISTINCT FROM blocking_locks.page
  AND blocked_locks.tuple IS NOT DISTINCT FROM blocking_locks.tuple
  AND blocked_locks.virtualxid IS NOT DISTINCT FROM blocking_locks.virtualxid
  AND blocked_locks.transactionid IS NOT DISTINCT FROM blocking_locks.transactionid
  AND blocked_locks.pid != blocking_locks.pid
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Matar query bloqueada
-- SELECT pg_terminate_backend(pid);

-- SQL Server: actividad actual
SELECT
  r.session_id, r.status, r.blocking_session_id,
  r.cpu_time, r.total_elapsed_time,
  t.text AS query
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.status = 'running'
ORDER BY r.total_elapsed_time DESC;
```

## Advanced Indexing

```sql
-- Indice parcial + incluye columnas = index-only scan
CREATE INDEX idx_orders_pending_user ON orders (user_id, created_at DESC)
INCLUDE (total, status)
WHERE status = 'pending';

-- Indice funcional
CREATE INDEX idx_users_lower_email ON users ((lower(email)));
CREATE INDEX idx_orders_day ON orders ((created_at::date));

-- Indice multicolumna: orden IMPORTA
-- WHERE a = x AND b = y: (a, b) o (b, a) ambos sirven
-- WHERE a = x AND b > y: (a, b) - b se usa para range
-- WHERE a > x AND b = y: (b, a) - a no se puede usar para sort si hay range primero

-- Missing index (SQL Server)
SELECT
  mig.index_group_handle,
  mid.statement,
  mid.equality_columns,
  mid.inequality_columns,
  mid.included_columns,
  migs.user_seeks,
  migs.avg_user_impact,
  'CREATE INDEX ix_auto_' + CONVERT(varchar, mig.index_group_handle) + '_' + CONVERT(varchar, mid.index_handle) +
  ' ON ' + mid.statement + ' (' + ISNULL(mid.equality_columns, '') +
  CASE WHEN mid.equality_columns IS NOT NULL AND mid.inequality_columns IS NOT NULL THEN ',' ELSE '' END +
  ISNULL(mid.inequality_columns, '') + ')' +
  CASE WHEN mid.included_columns IS NOT NULL THEN ' INCLUDE (' + mid.included_columns + ')' ELSE '' END AS create_stmt
FROM sys.dm_db_missing_index_groups mig
JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE mid.database_id = DB_ID()
ORDER BY migs.avg_user_impact DESC;
```

## Data Migration / Bulk Update Patterns

```sql
-- Bulk update en batches (evita locks largos)
DO $$
DECLARE
  batch_size INT := 1000;
  rows_updated INT := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM users
      WHERE status = 'legacy' AND updated_at IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED  -- no bloquear otras transacciones
    )
    UPDATE users u SET
      status = CASE
        WHEN u.last_login_at >= now() - interval '90 days' THEN 'active'
        ELSE 'inactive'
      END,
      updated_at = now()
    FROM batch b
    WHERE u.id = b.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows', rows_updated;

    COMMIT;  -- commit cada batch

    EXIT WHEN rows_updated < batch_size;
  END LOOP;
END;
$$;

-- Add column + backfill sin downtime
-- Paso 1: nullable
ALTER TABLE orders ADD COLUMN delivery_window tsrange;
-- Paso 2: backfill en batches
UPDATE orders SET delivery_window = tsrange(created_at, delivered_at)
WHERE delivery_window IS NULL AND delivered_at IS NOT NULL
LIMIT 10000; -- repetir en loop si es mucha data
-- Paso 3: not null constraint (con validacion diferida)
ALTER TABLE orders ADD CONSTRAINT ck_delivery_window
  CHECK (delivery_window IS NOT NULL) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT ck_delivery_window;
```

## JSON Aggregation Patterns

```sql
-- Construir respuesta API directamente desde SQL
SELECT json_build_object(
  'user', row_to_json(u.*),
  'posts', COALESCE(posts_json.data, '[]'::json),
  'stats', json_build_object(
    'totalPosts', (SELECT COUNT(*) FROM posts WHERE user_id = u.id),
    'totalComments', (SELECT COUNT(*) FROM comments WHERE author_id = u.id)
  )
) AS response
FROM users u
LEFT JOIN LATERAL (
  SELECT json_agg(row_to_json(p.*) ORDER BY p.created_at DESC) AS data
  FROM (
    SELECT id, title, created_at FROM posts WHERE user_id = u.id LIMIT 5
  ) p
) posts_json ON true
WHERE u.id = $1;

-- Agregacion de array con filtro
SELECT
  u.id,
  json_agg(json_build_object('id', p.id, 'title', p.title))
    FILTER (WHERE p.status = 'published') AS published_posts,
  json_agg(json_build_object('id', p.id, 'title', p.title))
    FILTER (WHERE p.status = 'draft') AS drafts
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
GROUP BY u.id;
```

## SQL Server Temporal Tables (System-Versioned)

```sql
-- Tabla temporal: audita cambios automaticamente
CREATE TABLE dbo.Products (
  Id INT IDENTITY PRIMARY KEY,
  Name NVARCHAR(200) NOT NULL,
  Price DECIMAL(10,2) NOT NULL,
  ValidFrom DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN,
  ValidTo DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN,
  PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.ProductsHistory));

-- Consultar estado en un momento del pasado
SELECT * FROM dbo.Products
FOR SYSTEM_TIME AS OF '2024-01-01 12:00:00';

-- Consultar cambios en un rango
SELECT * FROM dbo.Products
FOR SYSTEM_TIME BETWEEN '2024-01-01' AND '2024-01-31';

-- Ver todas las versiones de un registro
SELECT * FROM dbo.Products
FOR SYSTEM_TIME ALL
WHERE Id = 123;
```

## Data Integrity Checks

```sql
-- Check de integridad referencial (PostgreSQL)
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  -- FKs que no tienen indice (causa locks en DELETE del padre)
  'Missing index on FK column' AS issue
FROM pg_constraint
WHERE contype = 'f'
AND NOT EXISTS (
  SELECT 1 FROM pg_index
  WHERE indrelid = conrelid
  AND conkey <@ indkey::smallint[]
  AND conkey[0] = indkey[0]::smallint  -- FK column must be first in index
);

-- Find duplicate records
SELECT email, COUNT(*)
FROM users
WHERE deleted_at IS NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Find soft-deleted records referenced by active records
SELECT u.id, u.email, o.id AS order_id
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.deleted_at IS NOT NULL AND o.status = 'active';
```
