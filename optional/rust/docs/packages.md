# Rust Packages & Production Patterns

Crates esenciales y como usarlos en produccion.

## Web: Axum + Tower

```rust
// Cargo.toml
// axum = "0.8", tower = "0.5", tower-http = { version = "0.5", features = ["cors", "trace", "compression-gzip", "limit"] }

use axum::{
    Router, routing::{get, post},
    extract::{State, Path, Query, Json},
    middleware,
    http::{StatusCode, Method, header},
    Error,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer, compression::CompressionLayer, limit::RequestBodyLimitLayer};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub cache: redis::Client,
}

#[tokio::main]
async fn main() {
    // Inicializar
    let db = init_db().await;
    let cache = init_redis();
    let state = AppState { db, cache };

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(["https://example.com".parse().unwrap()])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true)
        .max_age(Duration::from_secs(86400));

    // Router con middlewares
    let app = Router::new()
        .route("/health", get(health))
        .nest("/api/v1", api_routes())
        .layer((
            TraceLayer::new_for_http(),
            CompressionLayer::new().gzip(true).br(true),
            RequestBodyLimitLayer::new(10 * 1024 * 1024), // 10MB
            cors,
        ))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Handler con State + Path + Query
async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<UserDto>, AppError> {
    let include_posts = params.get("include").map_or(false, |v| v == "posts");

    let user = if include_posts {
        sqlx::query_as!(User, "SELECT u.*, json_agg(p.*) as posts FROM users u LEFT JOIN posts p ON p.user_id = u.id WHERE u.id = $1 GROUP BY u.id", id)
            .fetch_optional(&state.db).await?
    } else {
        sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
            .fetch_optional(&state.db).await?
    };

    match user {
        Some(u) => Ok(Json(u.into())),
        None => Err(AppError::NotFound(format!("User {id} not found"))),
    }
}

// Multipart upload
use axum::extract::Multipart;

async fn upload_avatar(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
        let data = field.bytes().await?;

        // Validate
        if !content_type.starts_with("image/") {
            return Err(AppError::Validation("Only images allowed".into()));
        }
        if data.len() > 5 * 1024 * 1024 {
            return Err(AppError::Validation("Max 5MB".into()));
        }

        // Save
        let path = format!("uploads/avatars/{user_id}-{filename}");
        tokio::fs::write(&path, &data).await?;

        return Ok(Json(UploadResponse { url: format!("/{path}") }));
    }
    Err(AppError::Validation("No file uploaded".into()))
}

// Middleware de auth como funcion
async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = req.headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    let token = match token {
        Some(t) => t.to_string(),
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let claims = validate_jwt(&token).map_err(|_| StatusCode::UNAUTHORIZED)?;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
```

## Error Handling: anyhow + thiserror + Axum IntoResponse

```rust
// errors.rs
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal error")]
    Internal(#[from] anyhow::Error),

    #[error("Database error")]
    Database(#[from] sqlx::Error),

    #[error("Cache error")]
    Cache(#[from] redis::RedisError),

    #[error("HTTP error")]
    Http(#[from] reqwest::Error),
}

impl AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::BadRequest(_) | Self::Validation(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Internal(_) | Self::Database(_) | Self::Cache(_) | Self::Http(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();

        if status.is_server_error() {
            tracing::error!(?self, "Server error");
        }

        let body = json!({
            "success": false,
            "statusCode": status.as_u16(),
            "message": self.to_string(),
        });

        (status, Json(body)).into_response()
    }
}

// Patron: Result alias en el modulo
pub type Result<T> = std::result::Result<T, AppError>;
```

## Tracing / Observability

```rust
// tracing + tracing-subscriber + opentelemetry
use tracing::{info, warn, error, instrument, Span};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "info,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer()
            .json()
            .with_current_span(true)
            .with_span_list(true))
        .init();

    // ...
}

// Instrument functions
#[instrument(skip(pool), fields(user_id = %id))]
async fn get_user(pool: &PgPool, id: Uuid) -> Result<User, AppError> {
    info!("Fetching user");
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_optional(pool).await?;

    match user {
        Some(u) => {
            info!(email = %u.email, "User found");
            Ok(u)
        }
        None => {
            warn!("User not found");
            Err(AppError::NotFound(id.to_string()))
        }
    }
}
```

## Redis + Caching

```rust
// Cargo.toml: redis = { version = "0.25", features = ["tokio-comp", "connection-manager"] }

use redis::{AsyncCommands, Client, aio::ConnectionManager};

pub struct Cache {
    conn: ConnectionManager,
}

impl Cache {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    pub async fn get<T: redis::FromRedisValue>(&mut self, key: &str) -> Result<Option<T>, AppError> {
        let value: Option<T> = self.conn.get(key).await?;
        Ok(value)
    }

    pub async fn set(&mut self, key: &str, value: impl redis::ToRedisArgs, ttl_secs: u64) -> Result<(), AppError> {
        self.conn.set_ex(key, value, ttl_secs).await?;
        Ok(())
    }

    pub async fn del(&mut self, key: &str) -> Result<(), AppError> {
        self.conn.del(key).await?;
        Ok(())
    }
}

// Cache aside pattern
pub async fn get_user_cached(cache: &mut Cache, db: &PgPool, id: Uuid) -> Result<User, AppError> {
    let cache_key = format!("user:{id}");

    if let Some(user) = cache.get::<String>(&cache_key).await? {
        if let Ok(user) = serde_json::from_str::<User>(&user) {
            return Ok(user);
        }
    }

    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_optional(db).await?
        .ok_or_else(|| AppError::NotFound(id.to_string()))?;

    let json = serde_json::to_string(&user)?;
    cache.set(&cache_key, json, 300).await?;

    Ok(user)
}
```

## Validation: validator + garde

```rust
// Cargo.toml: validator = { version = "0.18", features = ["derive"] }

use validator::Validate;
use serde::Deserialize;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserDto {
    #[validate(email, length(min = 1, max = 255))]
    pub email: String,

    #[validate(length(min = 2, max = 100))]
    #[validate(regex(path = "RE_NAME"))]
    pub name: String,

    #[validate(length(min = 8, max = 128))]
    #[validate(custom(function = "validate_password_strength"))]
    pub password: String,
}

use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref RE_NAME: Regex = Regex::new(r"^[a-zA-Z\s'-]+$").unwrap();
}

fn validate_password_strength(password: &str) -> Result<(), validator::ValidationError> {
    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_special = password.chars().any(|c| !c.is_alphanumeric());

    if has_upper && has_lower && has_digit && has_special {
        Ok(())
    } else {
        Err(validator::ValidationError::new("password_strength")
            .with_message("Password must include uppercase, lowercase, digit, and special character".into()))
    }
}

// En handler
async fn create_user(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserDto>,
) -> Result<impl IntoResponse, AppError> {
    payload.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    // ... crear usuario
}
```

## Config Management: config + dotenvy

```rust
// Cargo.toml: config = "0.14", dotenvy = "0.15", serde = "1"

use config::{Config, Environment, File};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub redis: RedisConfig,
    pub jwt: JwtConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        dotenvy::dotenv().ok();

        Config::builder()
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name(&format!("config/{}", std::env::var("APP_ENV").unwrap_or("local".into()))).required(false))
            .add_source(Environment::with_prefix("APP").separator("__"))
            .build()?
            .try_deserialize()
    }
}
```

## Async graceful shutdown

```rust
async fn main() {
    let app = build_router().await;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
}

// Builder con shutdown hook
fn build_router() -> Router {
    Router::new()
        // ... rutas
        .with_state(state)
}
```

## Performance Tips

```rust
// Prefer &str over String for function params (no heap allocation)
// BAD
fn process(name: String) { }
// GOOD
fn process(name: &str) { }

// Use Cow when possible (clone on write)
use std::borrow::Cow;
fn normalize(input: &str) -> Cow<str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "-"))
    } else {
        Cow::Borrowed(input)
    }
}

// Pre-allocate Vec capacity
let mut items: Vec<User> = Vec::with_capacity(1000);
for user in results { items.push(user); }

// Use collect_into (nightly) or extend for bulk
let mut items = Vec::with_capacity(results.len());
items.extend(results);

// Avoid unnecessary clone in chains
// BAD: .cloned() then .collect()
// GOOD: .copied() for Copy types, or work with references

// Use SmallVec for small collections (< 64 items typical)
use smallvec::{SmallVec, smallvec};
let mut items: SmallVec<[User; 16]> = SmallVec::new();

// Async: avoid Box::pin(async {}) - use regular async blocks
// BAD: Box::pin(async move { heavy_work() })
// GOOD: tokio::spawn(async move { heavy_work() })
```
