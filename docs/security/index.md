# Security Reference

## Table of Contents
- [SQL Injection Prevention](#sql-injection)
- [Authentication Security](#auth-security)
- [Authorization Patterns](#authorization)
- [Input Validation & Sanitization](#input-validation)
- [API Security Headers](#api-headers)
- [CORS Configuration](#cors)
- [Rate Limiting](#rate-limiting)
- [Secrets Management](#secrets)
- [Cryptography](#crypto)
- [Logging & Monitoring](#logging)
- [CSRF / XSS Prevention](#csrf-xss)
- [Database Security](#db-security)

---

## SQL Injection Prevention

### PostgreSQL (pg / slonik)

```typescript
// BAD: String concatenation = SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;
await pool.query(query); // VULNERABLE!

// GOOD: Parameterized query (params are NEVER interpolated)
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// GOOD: Using tag templates (slonik - best practice)
const user = await connection.one(sql.type(UserDto)`
  SELECT id, email, name FROM users WHERE email = ${email}
`);

// BAD: Dynamically built column/table names with string concat
const orderBy = req.query.sort; // 'id; DROP TABLE users;--'
await pool.query(`SELECT * FROM users ORDER BY ${orderBy}`);

// GOOD: Whitelist validation for identifiers
const ALLOWED_COLUMNS = ['id', 'email', 'name', 'created_at'];
if (!ALLOWED_COLUMNS.includes(orderBy)) {
  throw new BadRequestException('Invalid sort column');
}
await pool.query(`SELECT * FROM users ORDER BY ${orderBy}`); // now safe

// GOOD: Use pg-format for identifier escaping
const format = require('pg-format');
await pool.query(format('SELECT * FROM users ORDER BY %I', orderBy));
```

### SQL Server (mssql puro)

```typescript
// BAD: Embedding user input
const query = `SELECT * FROM users WHERE email = '${email}'`;
await sql.query(query); // VULNERABLE!

// GOOD: Parameterized input()
const request = new sql.Request(pool);
request.input('email', sql.NVarChar, email);
const result = await request.query('SELECT * FROM users WHERE email = @email');

// GOOD: Dynamic table/column with QUOTENAME
const tableName = 'users';
const safeName = `[dbo].[${tableName.replace(/[^a-zA-Z0-9_]/g, '')}]`;
await request.query(`SELECT * FROM ${safeName}`);

// GOOD: sp_executesql for fully dynamic
await request.query(`
  DECLARE @sql NVARCHAR(MAX) = N'SELECT * FROM ' + QUOTENAME(@table);
  EXEC sp_executesql @sql, N'@email NVARCHAR(255)', 'test@test.com'
`);
```

### Rust (sqlx / tiberius)

```rust
// BAD: format!() with user input
let query = format!("SELECT * FROM users WHERE email = '{}'", email);
sqlx::query(&query).fetch_all(&pool).await; // VULNERABLE!

// GOOD: Parameterized query ($1, $2...)
sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", email)
    .fetch_all(&pool).await;

// GOOD: Query builder with bind()
sqlx::QueryBuilder::new("SELECT * FROM users")
    .push(" WHERE email = ")
    .push_bind(email)
    .build_query_as::<User>()
    .fetch_all(&pool).await;

// For dynamic ORDER BY: whitelist
let sort_column = match user_input {
    "email" => "email",
    "name" => "name",
    "created_at" => "created_at",
    _ => "id", // default safe fallback
};
// Now safe to use in query builder
```

### Raw SQL Procedures - Golden Rules

```
1. NUNCA concatenes input del usuario en strings SQL
2. Parametriza TODO (incluso en procedures y funciones)
3. Para nombres dinamicos (tablas, columnas): whitelist O usa QUOTENAME/quote_ident
4. Para LIKE searches: parametriza el valor, no el patron completo
5. Procedures siempre usan parametros tipados, nunca EXEC con concatenacion
6. Dynamic SQL dentro de procedures: solo con sp_executesql + parametros
```

---

## Authentication Security

### Nest.js JWT

```typescript
// NEVER hardcode secrets
// BAD:
const jwtSecret = 'my-secret-key-123';

// GOOD: From env vars validated at startup
// config.service.ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// Token storage: NEVER in localStorage (XSS vulnerable)
// Use httpOnly cookies with Secure + SameSite
res.cookie('access_token', token, {
  httpOnly: true,       // not accessible via JS
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  maxAge: 15 * 60 * 1000, // 15 min
  path: '/',
});

// Refresh token rotation
async refreshTokens(oldToken: string) {
  const stored = await this.refreshRepo.findOne({ where: { token: oldToken } });

  if (!stored || stored.expiresAt < new Date()) {
    // Token reuse detection: revoke ALL tokens for this user
    if (stored) {
      await this.refreshRepo.delete({ userId: stored.userId });
      // Alert: possible token theft
      this.logger.warn(`Token reuse detected for user ${stored.userId}`);
    }
    throw new UnauthorizedException();
  }

  // Delete old, create new (rotation)
  await this.refreshRepo.remove(stored);
  return this.generateTokens(stored.user);
}

// Password hashing
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // min 10, recommended 12
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Store hash, NEVER store plain text
// Compare: bcrypt.compare(plainPassword, storedHash)
```

### Rust JWT (jsonwebtoken crate)

```rust
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Serialize, Deserialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,     // user id
    email: String,
    exp: usize,      // expiration timestamp
    iat: usize,      // issued at
}

// Generate
fn create_token(user_id: &str, email: &str) -> Result<String, AppError> {
    let secret = env::var("JWT_SECRET").map_err(|_| AppError::Config("JWT_SECRET not set".into()))?;

    let now = chrono::Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp: (now + chrono::Duration::minutes(15)).timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
        .map_err(|e| AppError::Internal(e.to_string()))
}

// Validate with strict settings
fn validate_token(token: &str) -> Result<Claims, AppError> {
    let secret = env::var("JWT_SECRET").map_err(|_| AppError::Config("JWT_SECRET not set".into()))?;

    let mut validation = Validation::default();
    validation.leeway = 0;           // no clock skew tolerance (strict)
    validation.validate_exp = true;
    validation.required_spec_claims = ["exp", "iat", "sub"].iter().map(|s| s.to_string()).collect();

    let token_data = decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

    Ok(token_data.claims)
}

// Argon2 for passwords (better than bcrypt)
use argon2::{self, Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::SaltString;

async fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(hash.to_string())
}

async fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash).map_err(|_| AppError::Internal("Invalid hash".into()))?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}
```

---

## Authorization Patterns

### Row-Level Security (PostgreSQL)

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
CREATE POLICY doc_user_policy ON documents
  FOR ALL
  TO authenticated
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Policy: Admins see everything
CREATE POLICY doc_admin_policy ON documents
  FOR ALL
  TO admin_role
  USING (true);

-- Application sets the user ID at connection level
-- In Nest.js (after auth):
await pool.query(
  "SELECT set_config('app.current_user_id', $1, true)",
  [req.user.id]
);
```

### Authorization Headers (Nest.js)

```typescript
// Validar tipo de token (Bearer)
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
  throw new UnauthorizedException('Invalid authorization header');
}
const token = authHeader.slice(7); // remove 'Bearer '

// No aceptar tokens en query params
// BAD: /api/data?token=xxx
// Los tokens en URLs se loguean, se cachean en el browser

// Siempre usar header Authorization: Bearer <token>
```

---

## Input Validation & Sanitization

### Nest.js (class-validator + whitelist)

```typescript
// Global pipe configuration (main.ts)
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // STRIP non-decorated properties
  forbidNonWhitelisted: true,   // THROW on unexpected properties
  transform: true,
  stopAtFirstError: true,       // fail fast
  disableErrorMessages: false,  // keep in dev, set true in prod
}));

// DTO with strict validation
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @Length(3, 255)
  email: string;

  @IsString()
  @Length(2, 100)
  @Matches(/^[a-zA-Z\s'-]+$/, { message: 'Name contains invalid characters' })
  name: string;

  @IsString()
  @Length(8, 64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, {
    message: 'Password must include uppercase, lowercase, number, and special character',
  })
  password: string;
}

// Sanitize output (remove sensitive fields)
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  // NEVER expose: passwordHash, refreshToken, internalNotes

  static fromEntity(user: User): UserResponseDto {
    const { passwordHash, refreshTokens, ...safe } = user;
    return safe;
  }
}
```

### Rust (serde + validator)

```rust
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserDto {
    #[validate(email, length(min = 3, max = 255))]
    pub email: String,

    #[validate(length(min = 2, max = 100))]
    #[validate(regex(path = "RE_NAME", message = "Invalid name characters"))]
    pub name: String,

    #[validate(length(min = 8, max = 64))]
    #[validate(regex(path = "RE_PASSWORD", message = "Password too weak"))]
    pub password: String,
}

// Validate in handler
async fn create_user(Json(payload): Json<CreateUserDto>) -> Result<impl IntoResponse, AppError> {
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    // ... create user
}
```

### React (input sanitization)

```typescript
// Sanitize text input (strip HTML)
function sanitizeText(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// NEVER use dangerouslySetInnerHTML with user input
// BAD:
<div dangerouslySetInnerHTML={{ __html: userComment }} />
// GOOD (sanitized with DOMPurify):
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userComment) }} />

// URL validation before navigation
function safeRedirect(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow relative paths or same origin
    if (parsed.origin === window.location.origin) {
      return parsed.pathname + parsed.search;
    }
  } catch {}
  return '/'; // fallback to home
}
```

---

## API Security Headers

### Nest.js Helmet

```typescript
// main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // tighten if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.API_URL || ''],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));
```

---

## CORS Configuration

```typescript
// Nest.js - NEVER use { origin: true } in production
// BAD:
app.enableCors({ origin: true }); // allows ALL origins!

// GOOD: Whitelist
const ALLOWED_ORIGINS = [
  'https://myapp.com',
  'https://admin.myapp.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,       // allow cookies
  maxAge: 86400,           // preflight cache: 24h
});

// Rust (tower-http)
use tower_http::cors::{CorsLayer, Any, AllowOrigin};

let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::list([
        "https://myapp.com".parse().unwrap(),
    ]))
    .allow_methods([Method::GET, Method::POST])
    .allow_headers([CONTENT_TYPE, AUTHORIZATION])
    .allow_credentials(true)
    .max_age(Duration::from_secs(86400));
```

---

## Rate Limiting

```typescript
// Nest.js (throttler)
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  throttlers: [
    {
      ttl: 60000,   // window: 1 min
      limit: 30,    // 30 req/min global
    },
  ],
});

// Stricter for auth endpoints
@Post('login')
@Throttle({ default: { ttl: 60000, limit: 5 } })  // 5 login attempts/min
async login() {}

@Post('register')
@Throttle({ default: { ttl: 3600000, limit: 3 } }) // 3 registrations/hour
async register() {}

// By IP + endpoint (custom guard)
@Injectable()
export class StrictThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const ip = req.ip;
    const route = req.route.path;
    return `${ip}:${route}`;
  }
}
```

---

## Secrets Management

```typescript
// BAD: Hardcoded secrets
const dbPass = 'admin123';

// BAD: Secrets in code (accidental commit)
const apiKey = 'sk-live-xxx...';

// GOOD: Environment variables validated at startup
// config/validation.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  API_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().length(32), // 256 bits = 32 chars base64
});

export const env = envSchema.parse(process.env);

// GOOD: Use a secrets manager in production (Vault, AWS Secrets Manager)
// NEVER commit .env files with real secrets to git
// Add to .gitignore: .env, .env.local, .env.production
// Provide .env.example with dummy values as documentation
```

---

## Cryptography

```typescript
import crypto from 'node:crypto';

// AES-256-GCM for symmetric encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(encrypted: string, key: Buffer, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// The key must be 32 bytes (256 bits)
// const KEY = crypto.scryptSync(env.ENCRYPTION_KEY, 'salt', 32);
```

---

## Logging & Monitoring

```typescript
// NEVER log sensitive data
// BAD:
logger.log(`User logged in: ${JSON.stringify(user)}`); // passwordHash included!

// GOOD:
logger.log(`User logged in: ${user.id}`);

// Always scrub sensitive headers
// BAD: logging full request headers (Authorization token visible)
// GOOD: Redact before logging
function redactHeaders(headers: Record<string, any>): Record<string, any> {
  const redacted = { ...headers };
  delete redacted.authorization;
  delete redacted.cookie;
  delete redated['set-cookie'];
  delete redacted['x-api-key'];
  return redacted;
}

// Production
// - Disable verbose errors (no stack traces to clients)
// - Sanitize error messages (don't leak DB structure)
// BAD:
throw new Error(`Failed to insert into users(email,password_hash): ${dbError}`);
// GOOD:
throw new InternalServerErrorException('Unable to complete the request');
// Log the real error server-side:
logger.error(`DB error creating user: ${dbError.message}`);
```

---

## CSRF / XSS Prevention

### CSRF

```typescript
// When using cookie-based auth, CSRF is required
// Nest.js with csurf
import * as csurf from 'csurf';

// Apply to all state-changing routes
app.use(csurf({ cookie: true }));

// React: Include CSRF token in requests
const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
fetch('/api/data', {
  method: 'POST',
  headers: {
    'CSRF-Token': token || '',
  },
});

// SPA alternative: Don't use cookies for auth = no CSRF risk
// Store JWT in memory (not localStorage) and send via Authorization header
// This eliminates CSRF entirely
```

### XSS

```typescript
// React: Automatic XSS protection (JSX escapes by default)
// But watch out for these vectors:

// BAD: dangerouslySetInnerHTML with user content
<div dangerouslySetInnerHTML={{ __html: userBio }} />

// GOOD (if you must render HTML): Ssanitize with DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userBio) }} />

// BAD: href with javascript:
<a href={userProvidedUrl}>Click</a> // could be "javascript:alert(1)"

// GOOD: Validate URL protocol
const safeUrl = userProvidedUrl?.startsWith('http') ? userProvidedUrl : undefined;
<a href={safeUrl}>Click</a>

// BAD: eval() with user data
const result = eval(userCode); // NEVER do this

// Content Security Policy header blocks inline scripts
// Use nonces or hashes for inline scripts when needed
```

---

## Database Security

```sql
-- Principle of least privilege
-- Application user: NO DDL, NO CREATE/DROP

-- PostgreSQL
CREATE ROLE app_user WITH LOGIN PASSWORD 'strong-pass';
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Migration user (separate from app!)
CREATE ROLE migration_user WITH LOGIN PASSWORD 'different-pass';
GRANT CREATE ON SCHEMA public TO migration_user;

-- Read-only reporting user
CREATE ROLE report_reader WITH LOGIN PASSWORD 'readonly-pass';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO report_reader;
-- Auto-grant for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO report_reader;

-- SQL Server equivalent
CREATE LOGIN app_user WITH PASSWORD = 'strong-pass';
CREATE USER app_user FOR LOGIN app_user;
GRANT EXECUTE ON SCHEMA::dbo TO app_user; -- only procedures
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO app_user;
```

### SQL Client Security

```typescript
// Nest.js DatabaseService
// Connection pooling with timeouts
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  max: 20,                     // max connections
  idleTimeoutMillis: 30000,    // close idle after 30s
  connectionTimeoutMillis: 5000, // fail fast on connect
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

// Always parameterize
// pool.query('SELECT $1', [input]) -- CORRECT
// pool.query(`SELECT '${input}'`) -- WRONG

// Rust database connection
let config = Config::from_ado_string(&conn_str)?;
config.encryption(tiberius::EncryptionLevel::Required); // force encryption
config.trust_cert(false); // verify certificate (not self-signed)
```
