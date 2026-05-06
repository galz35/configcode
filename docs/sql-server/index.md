# SQL Server (T-SQL) Reference

## Table of Contents
- [T-SQL vs PostgreSQL Key Differences](#differences)
- [Stored Procedures & UDFs](#procedures)
- [Raw Query Patterns](#raw-queries)
- [CTEs & Window Functions](#ctes)
- [Indexes & Performance](#indexes)
- [Transactions & Locking](#transactions)
- [JSON & XML](#json)
- [Security Patterns](#security)
- [Migrations](#migrations)
- [Nest.js + SQL Server (mssql puro)](#nestjs)
- [Rust + SQL Server (tds puro)](#rust)
- [Common Pitfalls](#pitfalls)

---

## T-SQL vs PostgreSQL Key Differences

```sql
-- TOP vs LIMIT
-- SQL Server
SELECT TOP 10 * FROM users ORDER BY created_at DESC;
-- PostgreSQL: SELECT * FROM users ORDER BY created_at DESC LIMIT 10;

-- Pagination: OFFSET/FETCH (SQL Server 2012+)
SELECT * FROM users ORDER BY id OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;

-- String concatenation: + (not ||)
SELECT first_name + ' ' + last_name AS full_name FROM users;
-- NULL handling: CONCAT() is NULL-safe (CONCAT() not default in T-SQL)
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM users;

-- Boolean type: BIT (0, 1, NULL) not true/false
CREATE TABLE users (
  is_active BIT NOT NULL DEFAULT 1,
  is_verified BIT NOT NULL DEFAULT 0
);
-- Check: WHERE is_active = 1 (not WHERE is_active)

-- UUID: UNIQUEIDENTIFIER type
CREATE TABLE items (
  id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  -- or NEWSEQUENTIALID() for ordered GUIDs (less fragmentation)
);

-- Date/Time: no TIMESTAMPTZ. Use DATETIME2 or DATETIMEOFFSET
CREATE TABLE logs (
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  local_time DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- Case-insensitive by default (depends on collation)
-- Use COLLATE for explicit comparisons
SELECT * FROM users WHERE email COLLATE Latin1_General_BIN = 'test@test.com'; -- binary=case sensitive

-- OUTPUT clause (like RETURNING in PostgreSQL)
INSERT INTO users (email, name) OUTPUT INSERTED.id, INSERTED.created_at
VALUES ('a@b.com', 'Alice');

-- MERGE (upsert)
MERGE users AS target
USING (VALUES (@id, @email, @name)) AS source (id, email, name)
ON target.id = source.id
WHEN MATCHED THEN
  UPDATE SET email = source.email, name = source.name, updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (id, email, name) VALUES (source.id, source.email, source.name)
OUTPUT INSERTED.*;
```

---

## Stored Procedures & UDFs

### Stored Procedures

```sql
-- Basic stored procedure with params
CREATE OR ALTER PROCEDURE usp_GetUsersByFilter
  @SearchTerm NVARCHAR(200) = NULL,
  @RoleName NVARCHAR(50) = NULL,
  @PageNumber INT = 1,
  @PageSize INT = 20,
  @TotalCount INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT @TotalCount = COUNT(*)
  FROM dbo.Users u
  LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.Id
  LEFT JOIN dbo.Roles r ON r.Id = ur.RoleId
  WHERE (@SearchTerm IS NULL OR u.Email LIKE '%' + @SearchTerm + '%' OR u.Name LIKE '%' + @SearchTerm + '%')
    AND (@RoleName IS NULL OR r.Name = @RoleName)
    AND u.DeletedAt IS NULL;

  SELECT u.Id, u.Email, u.Name, u.CreatedAt,
         STRING_AGG(r.Name, ', ') AS Roles
  FROM dbo.Users u
  LEFT JOIN dbo.UserRoles ur ON ur.UserId = u.Id
  LEFT JOIN dbo.Roles r ON r.Id = ur.RoleId
  WHERE (@SearchTerm IS NULL OR u.Email LIKE '%' + @SearchTerm + '%' OR u.Name LIKE '%' + @SearchTerm + '%')
    AND (@RoleName IS NULL OR r.Name = @RoleName)
    AND u.DeletedAt IS NULL
  GROUP BY u.Id, u.Email, u.Name, u.CreatedAt
  ORDER BY u.CreatedAt DESC
  OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- Procedure with transaction and TRY/CATCH
CREATE OR ALTER PROCEDURE usp_CreateUserWithProfile
  @Email NVARCHAR(255),
  @Name NVARCHAR(200),
  @PasswordHash NVARCHAR(255),
  @Theme NVARCHAR(20) = 'light'
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;  -- auto-rollback on error

  DECLARE @UserId UNIQUEIDENTIFIER;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Check uniqueness
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email AND DeletedAt IS NULL)
    BEGIN
      RAISERROR('Email already registered', 16, 1);
      RETURN;
    END

    -- Insert user
    INSERT INTO dbo.Users (Email, Name, PasswordHash)
    VALUES (@Email, @Name, @PasswordHash);

    SET @UserId = SCOPE_IDENTITY(); -- last identity value

    -- Insert profile
    INSERT INTO dbo.UserProfiles (UserId, Theme, NotificationsEnabled)
    VALUES (@UserId, @Theme, 1);

    COMMIT TRANSACTION;

    -- Return created user
    SELECT Id, Email, Name, CreatedAt
    FROM dbo.Users
    WHERE Id = @UserId;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;  -- re-throw the error
  END CATCH
END;
GO

-- Procedure returning multiple result sets
CREATE OR ALTER PROCEDURE usp_GetDashboard
  @UserId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  -- Result set 1: user info
  SELECT Id, Email, Name, CreatedAt FROM dbo.Users WHERE Id = @UserId;

  -- Result set 2: recent orders
  SELECT TOP 5 Id, Total, Status, CreatedAt
  FROM dbo.Orders WHERE UserId = @UserId ORDER BY CreatedAt DESC;

  -- Result set 3: notifications count
  SELECT COUNT(*) AS UnreadCount
  FROM dbo.Notifications WHERE UserId = @UserId AND ReadAt IS NULL;
END;
GO
```

### Scalar Functions

```sql
-- Scalar UDF (avoid in WHERE/JOIN - they kill performance)
CREATE OR ALTER FUNCTION dbo.fn_CalculateOrderDiscount(@OrderId INT)
RETURNS DECIMAL(10,2)
AS
BEGIN
  DECLARE @Total DECIMAL(10,2), @Discount DECIMAL(10,2) = 0;

  SELECT @Total = SUM(Quantity * UnitPrice)
  FROM dbo.OrderItems WHERE OrderId = @OrderId;

  IF @Total > 1000 SET @Discount = @Total * 0.10;
  ELSE IF @Total > 500 SET @Discount = @Total * 0.05;

  RETURN @Discount;
END;
GO
-- Usage: SELECT dbo.fn_CalculateOrderDiscount(123);

-- Table-valued function (better than scalar for sets)
CREATE OR ALTER FUNCTION dbo.fn_GetUserOrders(@UserId UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN (
  SELECT o.Id, o.Total, o.Status, o.CreatedAt,
         COUNT(oi.Id) AS ItemCount
  FROM dbo.Orders o
  LEFT JOIN dbo.OrderItems oi ON oi.OrderId = o.Id
  WHERE o.UserId = @UserId
  GROUP BY o.Id, o.Total, o.Status, o.CreatedAt
);
GO
-- Usage: SELECT * FROM dbo.fn_GetUserOrders('...');
```

---

## Raw Query Patterns

### Dynamic SQL (with SQL Injection Protection)

```sql
-- SAFE: Parameterized dynamic SQL
CREATE OR ALTER PROCEDURE usp_DynamicSearch
  @TableName NVARCHAR(128),
  @ColumnName NVARCHAR(128),
  @SearchValue NVARCHAR(255),
  @SortColumn NVARCHAR(128),
  @SortDir NVARCHAR(4) = 'ASC'
AS
BEGIN
  SET NOCOUNT ON;

  -- Validate table/column names (whitelist approach safest)
  IF @SortDir NOT IN ('ASC', 'DESC')
    RAISERROR('Invalid sort direction', 16, 1);

  DECLARE @SQL NVARCHAR(MAX);
  SET @SQL = N'SELECT * FROM ' + QUOTENAME(@TableName) + 
             N' WHERE ' + QUOTENAME(@ColumnName) + N' LIKE @pSearch
             ORDER BY ' + QUOTENAME(@SortColumn) + N' ' + @SortDir;

  EXEC sp_executesql @SQL,
    N'@pSearch NVARCHAR(255)',
    @pSearch = '%' + @SearchValue + '%';
END;
GO

-- Batch insert with table-valued parameter (TVP)
-- Step 1: Create type
CREATE TYPE dbo.UserImportType AS TABLE (
  Email NVARCHAR(255) NOT NULL,
  Name NVARCHAR(200) NOT NULL,
  Role NVARCHAR(50) NOT NULL
);
GO

-- Step 2: Procedure using TVP
CREATE OR ALTER PROCEDURE usp_BulkInsertUsers
  @Users dbo.UserImportType READONLY
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.Users (Email, Name, Role, CreatedAt)
  SELECT Email, Name, Role, SYSUTCDATETIME()
  FROM @Users u
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Users WHERE Email = u.Email AND DeletedAt IS NULL
  );

  SELECT @@ROWCOUNT AS InsertedCount;
END;
GO
```

### Efficient Bulk Operations

```sql
-- Batch UPDATE with CASE
UPDATE dbo.Products
SET Price = CASE Id
  WHEN 1 THEN 19.99
  WHEN 2 THEN 29.99
  WHEN 3 THEN 39.99
END,
UpdatedAt = SYSUTCDATETIME()
OUTPUT INSERTED.Id, INSERTED.Price
WHERE Id IN (1, 2, 3);

-- Soft delete batch with OUTPUT
DELETE TOP (1000) FROM dbo.Notifications
OUTPUT DELETED.Id, DELETED.UserId, DELETED.DeletedAt
WHERE CreatedAt < DATEADD(DAY, -90, SYSUTCDATETIME());

-- UPSERT with MERGE (production-ready pattern)
MERGE dbo.Products AS target
USING (
  SELECT Id, Sku, Name, Price FROM @ProductUpdates
) AS source ON target.Id = source.Id
WHEN MATCHED AND target.UpdatedAt < source.UpdatedAt THEN -- optimistic concurrency
  UPDATE SET Name = source.Name, Price = source.Price, UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (Sku, Name, Price) VALUES (source.Sku, source.Name, source.Price)
OUTPUT $action AS ChangeType, INSERTED.Id;
```

---

## CTEs & Window Functions

```sql
-- Equivalent to PostgreSQL, with T-SQL specifics

-- STRING_AGG (T-SQL 2017+) instead of STRING_AGG (same name, different syntax)
SELECT u.Id, STRING_AGG(r.Name, ', ') WITHIN GROUP (ORDER BY r.Name) AS Roles
FROM dbo.Users u
JOIN dbo.UserRoles ur ON ur.UserId = u.Id
JOIN dbo.Roles r ON r.Id = ur.RoleId
GROUP BY u.Id;

-- Row numbers for deduplication
WITH Duplicates AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY Email ORDER BY CreatedAt DESC) AS rn
  FROM dbo.Users
  WHERE DeletedAt IS NULL
)
DELETE FROM Duplicates WHERE rn > 1;

-- Running totals (SQL Server 2012+ supports ROWS/RANGE)
SELECT
  OrderDate,
  Total,
  SUM(Total) OVER (ORDER BY OrderDate ROWS UNBOUNDED PRECEDING) AS RunningTotal,
  AVG(Total) OVER (ORDER BY OrderDate ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS Moving7DayAvg
FROM dbo.Orders
ORDER BY OrderDate;

-- FIRST_VALUE/LAST_VALUE with defaults
SELECT
  ProductId,
  SaleDate,
  Price,
  FIRST_VALUE(Price) OVER (PARTITION BY ProductId ORDER BY SaleDate) AS FirstPrice,
  LAST_VALUE(Price) OVER (
    PARTITION BY ProductId ORDER BY SaleDate
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING  -- IMPORTANT for LAST_VALUE
  ) AS LastPrice
FROM dbo.ProductPrices;
```

---

## Indexes & Performance

```sql
-- Clustered vs Non-clustered
-- Every table should have a clustered index (defines physical order)
CREATE CLUSTERED INDEX IX_Users_Id ON dbo.Users (Id); -- PK is clustered by default

-- Non-clustered for queries
CREATE NONCLUSTERED INDEX IX_Users_Email ON dbo.Users (Email) WHERE DeletedAt IS NULL; -- filtered

-- Covering index with INCLUDE
CREATE NONCLUSTERED INDEX IX_Orders_UserId_Date
ON dbo.Orders (UserId, CreatedAt DESC)
INCLUDE (Total, Status); -- index-only scan

-- Columnstore index (analytics/reporting, not OLTP)
CREATE CLUSTERED COLUMNSTORE INDEX CCI_Sales ON dbo.SalesData;

-- Missing index DMV (find what indexes to create)
SELECT
  migs.avg_user_impact,
  mid.statement AS table_name,
  mid.equality_columns,
  mid.inequality_columns,
  mid.included_columns
FROM sys.dm_db_missing_index_details mid
JOIN sys.dm_db_missing_index_groups mig ON mig.index_handle = mid.index_handle
JOIN sys.dm_db_missing_index_group_stats migs ON migs.group_handle = mig.index_group_handle
WHERE mid.database_id = DB_ID()
ORDER BY migs.avg_user_impact DESC;

-- Check index usage (see which indexes are never used)
SELECT
  OBJECT_NAME(i.object_id) AS table_name,
  i.name AS index_name,
  s.user_seeks, s.user_scans, s.user_lookups, s.user_updates
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i ON i.object_id = s.object_id AND i.index_id = s.index_id
WHERE s.database_id = DB_ID()
  AND OBJECT_NAME(i.object_id) NOT LIKE 'sys%'
ORDER BY (s.user_seeks + s.user_scans + s.user_lookups) ASC;

-- Query plan cache analysis
SELECT TOP 10
  creation_time,
  last_execution_time,
  execution_count,
  total_worker_time / execution_count AS avg_cpu,
  total_elapsed_time / execution_count AS avg_duration,
  SUBSTRING(text, statement_start_offset / 2 + 1,
    (CASE WHEN statement_end_offset = -1 THEN LEN(text) ELSE statement_end_offset END - statement_start_offset) / 2 + 1) AS query_text
FROM sys.dm_exec_query_stats
CROSS APPLY sys.dm_exec_sql_text(sql_handle)
ORDER BY total_worker_time DESC;
```

---

## Transactions & Locking

```sql
-- READ COMMITTED SNAPSHOT (preferred for OLTP)
-- ALTER DATABASE MyDB SET READ_COMMITTED_SNAPSHOT ON;  -- once per DB
-- This eliminates most blocking between readers and writers

-- Transaction with TRY/CATCH (production pattern)
CREATE OR ALTER PROCEDURE usp_TransferFunds
  @FromAccount INT,
  @ToAccount INT,
  @Amount DECIMAL(10,2)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRY
    BEGIN TRANSACTION;

    -- Lock rows in order to prevent deadlocks (always same order: lower ID first)
    IF @FromAccount < @ToAccount
    BEGIN
      UPDATE dbo.Accounts SET Balance = Balance - @Amount WHERE Id = @FromAccount;
      UPDATE dbo.Accounts SET Balance = Balance + @Amount WHERE Id = @ToAccount;
    END
    ELSE
    BEGIN
      UPDATE dbo.Accounts SET Balance = Balance + @Amount WHERE Id = @ToAccount;
      UPDATE dbo.Accounts SET Balance = Balance - @Amount WHERE Id = @FromAccount;
    END

    -- Check no negative balance
    IF EXISTS (SELECT 1 FROM dbo.Accounts WHERE Id = @FromAccount AND Balance < 0)
    BEGIN
      RAISERROR('Insufficient funds', 16, 1);
    END

    -- Log transaction
    INSERT INTO dbo.TransactionLog (FromAccount, ToAccount, Amount, CreatedAt)
    VALUES (@FromAccount, @ToAccount, @Amount, SYSUTCDATETIME());

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END;
GO

-- Optimistic concurrency with ROWVERSION
CREATE TABLE dbo.Documents (
  Id INT IDENTITY PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  Content NVARCHAR(MAX),
  RowVersion ROWVERSION  -- auto-incremented on every update
);

CREATE OR ALTER PROCEDURE usp_UpdateDocument
  @Id INT,
  @Title NVARCHAR(200),
  @Content NVARCHAR(MAX),
  @ExpectedRowVersion ROWVERSION
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.Documents
  SET Title = @Title, Content = @Content, UpdatedAt = SYSUTCDATETIME()
  WHERE Id = @Id AND RowVersion = @ExpectedRowVersion;

  IF @@ROWCOUNT = 0
    RAISERROR('Document modified by another user. Refresh and try again.', 16, 1);
  ELSE
    SELECT Title, Content, RowVersion FROM dbo.Documents WHERE Id = @Id;
END;
GO

-- READPAST hint (skip locked rows - queue pattern)
-- Consumer pattern: get next item without blocking
BEGIN TRANSACTION;
  DECLARE @NextId INT;

  SELECT TOP 1 @NextId = Id
  FROM dbo.JobQueue WITH (READPAST, ROWLOCK)
  WHERE Status = 'Pending'
  ORDER BY Priority DESC, CreatedAt ASC;

  IF @NextId IS NOT NULL
    UPDATE dbo.JobQueue SET Status = 'Processing', StartedAt = SYSUTCDATETIME()
    OUTPUT INSERTED.Id, INSERTED.Payload
    WHERE Id = @NextId;

COMMIT TRANSACTION;
```

---

## JSON & XML

```sql
-- JSON support (SQL Server 2016+)

-- Parse JSON
DECLARE @json NVARCHAR(MAX) = N'{"user":{"name":"John","roles":["admin","user"]}}';

SELECT
  JSON_VALUE(@json, '$.user.name') AS name,
  JSON_QUERY(@json, '$.user.roles') AS roles,  -- returns JSON fragment
  JSON_VALUE(@json, '$.user.roles[0]') AS first_role;

-- Query JSON array as rows
SELECT value AS role
FROM OPENJSON(@json, '$.user.roles');

-- Generate JSON from table
SELECT
  Id,
  Email,
  Name,
  (SELECT Id, Title, CreatedAt FROM dbo.Posts WHERE UserId = u.Id FOR JSON PATH) AS Posts
FROM dbo.Users u
FOR JSON PATH, ROOT('users');

-- JSON column with index
ALTER TABLE dbo.Users ADD Preferences NVARCHAR(MAX);
ALTER TABLE dbo.Users ADD CONSTRAINT CK_Preferences CHECK (ISJSON(Preferences) = 1);

-- Index on JSON property (computed column)
ALTER TABLE dbo.Users ADD Theme AS JSON_VALUE(Preferences, '$.theme');
CREATE INDEX IX_Users_Theme ON dbo.Users (Theme);
```

---

## Security Patterns

### SQL Injection Prevention

```sql
-- BAD: Concatenating user input
SET @sql = 'SELECT * FROM users WHERE email = ''' + @email + '''';
EXEC(@sql); -- VULNERABLE!

-- GOOD: Parameterized queries (ALWAYS)
SELECT * FROM users WHERE email = @email;

-- GOOD: sp_executesql for dynamic queries
DECLARE @sql NVARCHAR(MAX) = N'SELECT * FROM ' + QUOTENAME(@table) + ' WHERE email = @email';
EXEC sp_executesql @sql, N'@email NVARCHAR(255)', @email = 'test@test.com';
-- QUOTENAME prevents table/column injection

-- BAD: Even with stored procedures, if you concatenate
CREATE PROCEDURE usp_Bad @name NVARCHAR(100) AS
  EXEC('SELECT * FROM users WHERE name = ''' + @name + ''''); -- VULNERABLE

-- GOOD: Proper parameter usage
CREATE PROCEDURE usp_Good @name NVARCHAR(100) AS
  SELECT * FROM users WHERE name = @name;
```

### Permission Model

```sql
-- Principle of Least Privilege
-- Application login: ONLY EXECUTE on procedures, NO direct table access

CREATE LOGIN AppUser WITH PASSWORD = 'StrongP@ss123';
CREATE USER AppUser FOR LOGIN AppUser;

-- Grant execute on all procedures in schema
GRANT EXECUTE ON SCHEMA::dbo TO AppUser;

-- Deny direct table access
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO AppUser;

-- Read-only reporting user
CREATE ROLE ReportReader;
GRANT SELECT ON SCHEMA::dbo TO ReportReader;
ALTER ROLE ReportReader ADD MEMBER ReportUser;

-- Schema-level organization for security
CREATE SCHEMA app;   -- application procedures
CREATE SCHEMA rpt;   -- reporting views
CREATE SCHEMA sec;   -- security functions

-- Application can only execute app schema
GRANT EXECUTE ON SCHEMA::app TO AppUser;
-- Reporting user can only select from rpt schema
GRANT SELECT ON SCHEMA::rpt TO ReportReader;
```

---

## Migrations

```sql
-- Best practice: Idempotent migrations (can be re-run safely)

-- Check and create schema
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'app')
  EXEC('CREATE SCHEMA app');
GO

-- Check and create table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Products')
BEGIN
  CREATE TABLE dbo.Products (
    Id INT IDENTITY PRIMARY KEY,
    Sku NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Price DECIMAL(10,2) NOT NULL CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    DeletedAt DATETIME2 NULL,
    CONSTRAINT UQ_Products_Sku UNIQUE (Sku)
  );
END
GO

-- Check and add column safely
IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'Description'
)
BEGIN
  ALTER TABLE dbo.Products ADD Description NVARCHAR(MAX) NULL;
END
GO

-- Check and create index safely
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_Sku_Deleted'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Products_Sku_Deleted
  ON dbo.Products (Sku) WHERE DeletedAt IS NULL;
END
GO

-- Add column with default for existing rows (safer approach)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'IsFeatured')
BEGIN
  ALTER TABLE dbo.Products ADD IsFeatured BIT NULL;  -- Step 1: nullable
  UPDATE dbo.Products SET IsFeatured = 0 WHERE IsFeatured IS NULL;  -- Step 2: set default
  ALTER TABLE dbo.Products ALTER COLUMN IsFeatured BIT NOT NULL;  -- Step 3: not null
END
GO
```

---

## Nest.js + SQL Server (mssql puro, sin ORMs)

```typescript
// database.service.ts - usando el paquete mssql (node-mssql)
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as sql from 'mssql';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: sql.ConnectionPool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.pool = await sql.connect({
      server: this.config.get('DB_HOST'),
      port: parseInt(this.config.get('DB_PORT', '1433')),
      user: this.config.get('DB_USER'),
      password: this.config.get('DB_PASS'),
      database: this.config.get('DB_NAME'),
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
      },
      pool: { max: 20, min: 5, idleTimeoutMillis: 30000 },
    });
  }

  async onModuleDestroy() {
    await this.pool?.close();
  }

  // Ejecutar stored procedure con params tipados
  async executeProc<T>(name: string, params?: Record<string, any>): Promise<T[]> {
    const request = this.pool.request();

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        // Tipado explicito para seguridad
        if (typeof value === 'number') {
          request.input(key, sql.Int, value);
        } else if (typeof value === 'boolean') {
          request.input(key, sql.Bit, value ? 1 : 0);
        } else if (value instanceof Date) {
          request.input(key, sql.DateTime2, value);
        } else {
          request.input(key, sql.NVarChar, value);
        }
      }
    }

    // Output parameters
    request.output('TotalCount', sql.Int);
    request.output('ErrorCode', sql.Int);

    const result = await request.execute(name);
    return result.recordset as T[];
  }

  // Query pura con parametros (siempre parametrizado)
  async query<T>(query: string, params?: Record<string, any>): Promise<T[]> {
    const request = this.pool.request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }
    }
    const result = await request.query(query);
    return result.recordset as T[];
  }

  // Transaccion
  async transaction<T>(callback: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const result = await callback(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }
}

// users.service.ts - usando procedures puros
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findPaginated(search: string, page: number, limit: number) {
    const result = await this.db.executeProc<UserRow>('usp_GetUsersByFilter', {
      SearchTerm: search || null,
      PageNumber: page,
      PageSize: limit,
    });
    return result;
  }

  async create(dto: CreateUserDto) {
    const [user] = await this.db.executeProc<UserRow>('usp_CreateUserWithProfile', {
      Email: dto.email,
      Name: dto.name,
      PasswordHash: await bcrypt.hash(dto.password, 12),
    });
    return user;
  }

  // Raw query cuando no hay procedure
  async getActiveByRole(role: string): Promise<UserRow[]> {
    return this.db.query<UserRow>(
      `SELECT u.Id, u.Email, u.Name
       FROM dbo.Users u
       JOIN dbo.UserRoles ur ON ur.UserId = u.Id
       JOIN dbo.Roles r ON r.Id = ur.RoleId
       WHERE r.Name = @role AND u.DeletedAt IS NULL`,
      { role }
    );
  }

  // Transaccion multi-tabla
  async transferCredits(fromId: string, toId: string, amount: number) {
    return this.db.transaction(async (tx) => {
      const req = new sql.Request(tx);
      req.input('FromId', sql.UniqueIdentifier, fromId);
      req.input('ToId', sql.UniqueIdentifier, toId);
      req.input('Amount', sql.Decimal(10, 2), amount);
      await req.execute('usp_TransferCredits');
    });
  }
}
```

---

## Rust + SQL Server (tds puro, sin ORMs)

```toml
# Cargo.toml - dependencies for SQL Server
[dependencies]
tiberius = { version = "0.12", features = ["tds73", "rustls", "chrono", "uuid"] }
tokio-util = { version = "0.7", features = ["compat"] }
async-std = "1"

# Alternative: libtds (C wrapper, lighter but less safe)
# tds = "0.3"
```

```rust
// db.rs - Connection pool and raw query executor
use tiberius::{Client, Config, AuthMethod, Query};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct SqlServer {
    pool: bb8_tiberius::Pool, // or deadpool-tiberius, mobc-tiberius
}

impl SqlServer {
    pub async fn new(conn_str: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let config = Config::from_ado_string(conn_str)?;

        let mgr = bb8_tiberius::ConnectionManager::new(config);
        let pool = bb8::Pool::builder().max_size(20).build(mgr).await?;

        Ok(Self { pool })
    }

    // Execute raw query with params
    pub async fn query<T>(
        &self,
        sql: &str,
        params: &[&(dyn tiberius::IntoSql + Sync)],
    ) -> Result<Vec<tiberius::Row>, Box<dyn std::error::Error>> {
        let mut client = self.pool.get().await?;

        let mut query = Query::new(sql);
        for param in params {
            query.bind(param);
        }

        let stream = query.query(&mut client).await?;
        let rows = stream.into_results().await?;

        Ok(rows.into_iter().flatten().collect())
    }

    // Call stored procedure
    pub async fn execute_proc(
        &self,
        name: &str,
        params: &[(&str, &(dyn tiberius::IntoSql + Sync))],
    ) -> Result<Vec<tiberius::Row>, Box<dyn std::error::Error>> {
        let mut client = self.pool.get().await?;

        let param_names: Vec<String> = params.iter().map(|(n, _)| format!("@{}", n)).collect();
        let sql = format!("EXEC {} {}", name, param_names.join(", "));

        let mut query = Query::new(sql);
        for (_, value) in params {
            query.bind(value);
        }

        let stream = query.query(&mut client).await?;
        let rows = stream.into_results().await?;

        Ok(rows.into_iter().flatten().collect())
    }

    // Transaction
    pub async fn transaction<T, F>(
        &self,
        callback: F,
    ) -> Result<T, Box<dyn std::error::Error>>
    where
        F: AsyncFnOnce(&mut Client<'_>) -> Result<T, Box<dyn std::error::Error>>,
    {
        let mut client = self.pool.get().await?;

        client.simple_query("BEGIN TRANSACTION").await?;

        match callback(&mut client).await {
            Ok(result) => {
                client.simple_query("COMMIT TRANSACTION").await?;
                Ok(result)
            }
            Err(e) => {
                client.simple_query("ROLLBACK TRANSACTION").await?;
                Err(e)
            }
        }
    }
}

// Mapping rows to structs
#[derive(Debug, serde::Serialize)]
struct User {
    id: Uuid,
    email: String,
    name: String,
    created_at: DateTime<Utc>,
}

impl User {
    fn from_row(row: &tiberius::Row) -> Option<Self> {
        Some(Self {
            id: row.get::<Uuid, _>("Id")?,
            email: row.get::<&str, _>("Email")?.to_string(),
            name: row.get::<&str, _>("Name")?.to_string(),
            created_at: row.get::<DateTime<Utc>, _>("CreatedAt")?,
        })
    }
}

// Usage in service
struct UserService {
    db: SqlServer,
}

impl UserService {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let rows = self.db.query(
            "SELECT Id, Email, Name, CreatedAt FROM dbo.Users WHERE Id = @P1 AND DeletedAt IS NULL",
            &[&id],
        ).await?;

        Ok(rows.first().and_then(User::from_row))
    }

    async fn search_users(&self, term: &str, page: i32, size: i32) -> Result<Vec<User>, AppError> {
        let offset = (page - 1) * size;
        let rows = self.db.query(
            "SELECT Id, Email, Name, CreatedAt FROM dbo.Users
             WHERE (Email LIKE @P1 OR Name LIKE @P1) AND DeletedAt IS NULL
             ORDER BY CreatedAt DESC
             OFFSET @P2 ROWS FETCH NEXT @P3 ROWS ONLY",
            &[&format!("%{}%", term), &offset, &size],
        ).await?;

        Ok(rows.iter().filter_map(User::from_row).collect())
    }

    async fn create_user(&self, email: &str, name: &str, password_hash: &str) -> Result<User, AppError> {
        let rows = self.db.query(
            "INSERT INTO dbo.Users (Email, Name, PasswordHash)
             OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.Name, INSERTED.CreatedAt
             VALUES (@P1, @P2, @P3)",
            &[&email, &name, &password_hash],
        ).await?;

        rows.first()
            .and_then(User::from_row)
            .ok_or_else(|| AppError::Internal("Failed to create user".into()))
    }

    async fn call_proc(&self, proc_name: &str, id: Uuid) -> Result<Vec<User>, AppError> {
        let rows = self.db.execute_proc(proc_name, &[("UserId", &id)]).await?;
        Ok(rows.iter().filter_map(User::from_row).collect())
    }
}
```

---

## Common Pitfalls

### 1. CURSORS instead of set-based operations
```sql
-- BAD: Cursor (row by row = slow)
DECLARE cur CURSOR FOR SELECT Id FROM Users;
OPEN cur;
WHILE @@FETCH_STATUS = 0
  -- process one row at a time

-- GOOD: Set-based
UPDATE Users SET Status = 'inactive'
WHERE LastLoginAt < DATEADD(DAY, -90, SYSUTCDATETIME());
```

### 2. Scalar functions in WHERE/JOIN
```sql
-- BAD: Scalar UDF executed per row (kills performance)
SELECT * FROM Orders WHERE dbo.fn_GetOrderTotal(Id) > 100;

-- GOOD: Inline the logic or use TVF
SELECT * FROM Orders o
JOIN dbo.fn_GetOrderTotals() t ON t.OrderId = o.Id
WHERE t.Total > 100;
```

### 3. NOLOCK hint abuse
```sql
-- BAD: NOLOCK (READ UNCOMMITTED) = dirty reads, missing rows, double counting
SELECT * FROM Orders WITH (NOLOCK);  -- DANGEROUS

-- GOOD: Use READ COMMITTED SNAPSHOT isolation at DB level
-- ALTER DATABASE MyDB SET READ_COMMITTED_SNAPSHOT ON;
-- Then: SELECT * FROM Orders; (no hint = snapshot read, no locks, no dirty reads)
```

### 4. Implicit transactions
```sql
-- BAD: SET IMPLICIT_TRANSACTIONS ON (forgetting COMMIT = blocking)
SET IMPLICIT_TRANSACTIONS ON;
UPDATE Users SET Name = 'Updated'; -- transaction started!
-- forgot COMMIT = blocks everything

-- GOOD: Explicit transactions OR autocommit (default)
```

### 5. Query parameter sniffing issues
```sql
-- Problem: SQL Server caches a plan for the first param values
-- If first execution uses broad filter, plan is bad for narrow filter
CREATE OR ALTER PROCEDURE usp_GetOrders @Status NVARCHAR(20) AS
  SELECT * FROM Orders WHERE Status = @Status; -- parameter sniffing!

-- Fix: OPTION (RECOMPILE) for volatile queries
CREATE OR ALTER PROCEDURE usp_GetOrders @Status NVARCHAR(20) AS
  SELECT * FROM Orders WHERE Status = @Status OPTION (RECOMPILE);

-- Or: use local variables to prevent sniffing
CREATE OR ALTER PROCEDURE usp_GetOrders @Status NVARCHAR(20) AS
BEGIN
  DECLARE @StatusLocal NVARCHAR(20) = @Status;
  SELECT * FROM Orders WHERE Status = @StatusLocal;
END
```
