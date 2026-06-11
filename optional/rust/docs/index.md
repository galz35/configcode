# Rust Reference

## Table of Contents
- [Ownership & Borrowing](#ownership)
- [Lifetimes](#lifetimes)
- [Structs & Enums](#structs)
- [Traits & Generics](#traits)
- [Error Handling](#errors)
- [Collections & Iterators](#collections)
- [Async/Await & Tokio](#async)
- [Macros](#macros)
- [Testing](#testing)
- [Cargo & Project Structure](#cargo)
- [Common Patterns](#patterns)
- [PostgreSQL Raw SQL (sqlx, sin ORMs)](#pg-raw)
- [Common Pitfalls](#pitfalls)

---

## Ownership & Borrowing

### The Rules
```rust
// Rule 1: Each value has ONE owner
let s1 = String::from("hello");
let s2 = s1;              // s1 is MOVED, no longer valid
// println!("{s1}");      // COMPILE ERROR: value borrowed after move

// Rule 2: You can have EITHER one mutable reference OR many immutable refs
let mut data = vec![1, 2, 3];
let r1 = &data;           // immutable borrow
let r2 = &data;           // fine: multiple immutable borrows
// let r3 = &mut data;    // COMPILE ERROR: can't borrow mutably while immutable borrows exist
println!("{r1} {r2}");    // last use of immutable borrows
let r3 = &mut data;       // NOW this is fine: immutable borrows are done

// Rule 3: References must always be valid (no dangling pointers)
```

### Common Ownership Patterns

```rust
// Clone to keep original
fn takes_ownership(s: String) { /* s is dropped here */ }
let original = String::from("keep me");
takes_ownership(original.clone());     // clone before moving
println!("{original}");                // original still valid

// Borrow instead of move (preferred)
fn takes_ref(s: &String) { /* ownership stays with caller */ }
let text = String::from("data");
takes_ref(&text);
println!("{text}");                   // text still owned here

// Mutable borrow for modification
fn append_world(s: &mut String) {
    s.push_str(" world");
}
let mut greeting = String::from("hello");
append_world(&mut greeting);

// Take ownership, return modified
fn transform(s: String) -> String {
    s.to_uppercase()
}
let s = transform(String::from("hello"));
```

### Cow (Clone on Write)
```rust
use std::borrow::Cow;

fn process(input: &str) -> Cow<'_, str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))
    } else {
        Cow::Borrowed(input)  // no allocation needed
    }
}
```

### Rc & Arc (shared ownership)
```rust
use std::rc::Rc;
use std::sync::Arc;

// Single-threaded shared ownership
let a = Rc::new(String::from("shared"));
let b = Rc::clone(&a);     // increments reference count
let c = Rc::clone(&a);
assert_eq!(Rc::strong_count(&a), 3);

// Multi-threaded (atomic reference counting)
let a = Arc::new(vec![1, 2, 3]);
let a_clone = Arc::clone(&a);
tokio::spawn(async move {
    println!("{:?}", a_clone);
});
```

### Interior Mutability

```rust
use std::cell::{Cell, RefCell};
use std::sync::Mutex;

// Cell: Copy types, no runtime check
let x = Cell::new(42);
x.set(x.get() + 1);

// RefCell: non-Copy types, runtime borrow checking (single thread)
let data = RefCell::new(vec![1, 2, 3]);
data.borrow_mut().push(4);

// Mutex: multi-thread safe
let counter = Arc::new(Mutex::new(0));
let mut handles = vec![];
for _ in 0..10 {
    let c = Arc::clone(&counter);
    handles.push(std::thread::spawn(move || {
        let mut num = c.lock().unwrap();
        *num += 1;
    }));
}
for h in handles { h.join().unwrap(); }
assert_eq!(*counter.lock().unwrap(), 10);
```

---

## Lifetimes

### Basic Lifetime Annotation

```rust
// Compiler can't infer which reference to return
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Lifetimes in structs
struct Excerpt<'a> {
    part: &'a str,        // the reference must live as long as struct
}

impl<'a> Excerpt<'a> {
    fn announce(&self, msg: &str) -> &str {
        println!("{msg}");
        self.part
    }
}

// Lifetime elision rules (when you can omit)
fn first_word(s: &str) -> &str {           // elided: fn first_word<'a>(s: &'a str) -> &'a str
    s.split_whitespace().next().unwrap()
}
fn process(s: &str, t: &str) -> &str {     // COMPILE ERROR: ambiguous return lifetime
    // compiler can't guess: is return from s or t?
    s  // need explicit annotation
}
```

### Advanced Lifetime Scenarios

```rust
// 'static lifetime (lives for the entire program)
let literal: &'static str = "I live forever";

// Higher-ranked trait bounds (HRTB)
fn apply<F>(f: F) where F: for<'a> Fn(&'a str) -> &'a str {
    let result = f("hello");
    println!("{result}");
}

// Lifetime coercion
struct Context<'s>(&'s str);
fn parse<'a>(context: &Context<'a>) -> Result<(), &'a str> {
    Err(context.0)   // 's is coerced to 'a
}

// GAT (Generic Associated Types) for iterator patterns
trait Container {
    type Item<'a> where Self: 'a;
    fn get<'a>(&'a self, index: usize) -> Self::Item<'a>;
}

struct BorrowedItems<'a> {
    items: Vec<&'a str>,
}

impl<'a> Container for BorrowedItems<'a> {
    type Item<'b> = &'b str where 'a: 'b;
    fn get<'b>(&'b self, index: usize) -> &'b str {
        self.items[index]
    }
}
```

---

## Structs & Enums

### Struct Patterns

```rust
// Classic struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl User {
    pub fn new(email: String, name: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            email,
            name,
            role: UserRole::default(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    // Builder-style chaining with mutation
    pub fn with_role(mut self, role: UserRole) -> Self {
        self.role = role;
        self
    }
}

// Tuple struct (named wrapper)
pub struct Meters(f64);
pub struct Seconds(f64);

impl Meters {
    pub fn as_f64(&self) -> f64 { self.0 }
}

// Newtype pattern - zero-cost abstraction
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(Uuid);

impl UserId {
    pub fn new() -> Self { Self(Uuid::new_v4()) }
    pub fn from_str(s: &str) -> Result<Self, uuid::Error> {
        let uuid = Uuid::parse_str(s)?;
        Ok(Self(uuid))
    }
}

impl std::fmt::Display for UserId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

// Builder pattern (typed-builder crate)
#[derive(TypedBuilder)]
pub struct QueryParams {
    #[builder(default = 1)]
    page: u32,
    #[builder(default = 20)]
    limit: u32,
    #[builder(default, setter(strip_option))]
    search: Option<String>,
    #[builder(default, setter(strip_option))]
    status: Option<UserStatus>,
}
```

### Enums (ADTs / Algebraic Data Types)

```rust
// Classic Result-style enum
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ApiResponse<T> {
    Success(T),
    Error { code: u16, message: String },
    Pending { request_id: String },
}

// Using the power of enums for states
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { since: chrono::DateTime<chrono::Utc> },
    Reconnecting { attempt: u32, last_error: String },
    Failed { error: String },
}

impl ConnectionState {
    pub fn is_connected(&self) -> bool {
        matches!(self, Self::Connected { .. })
    }

    pub fn attempt_count(&self) -> u32 {
        match self {
            Self::Connecting { attempt } | Self::Reconnecting { attempt, .. } => *attempt,
            _ => 0,
        }
    }

    pub fn next_attempt(&self) -> Self {
        let attempt = self.attempt_count() + 1;
        Self::Connecting { attempt }
    }
}

// Enum with methods via impl
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Debug => "DEBUG",
            Self::Info => "INFO",
            Self::Warning => "WARNING",
            Self::Error => "ERROR",
            Self::Critical => "CRITICAL",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "DEBUG" => Some(Self::Debug),
            "INFO" => Some(Self::Info),
            _ => None,
        }
    }
}

// Enum for API error types
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Invalid input: {0}")]
    ValidationError(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl ApiError {
    pub fn status_code(&self) -> u16 {
        match self {
            Self::NotFound(_) => 404,
            Self::Unauthorized(_) => 401,
            Self::ValidationError(_) => 400,
            Self::DatabaseError(_) => 500,
            Self::Internal(_) => 500,
        }
    }
}
```

---

## Traits & Generics

### Trait Definition

```rust
pub trait Repository<T, ID> {
    async fn find_by_id(&self, id: &ID) -> Result<Option<T>, ApiError>;
    async fn find_all(&self, limit: u32, offset: u32) -> Result<Vec<T>, ApiError>;
    async fn save(&self, entity: &T) -> Result<T, ApiError>;
    async fn delete(&self, id: &ID) -> Result<bool, ApiError>;
}

// Blanket implementation
impl<T: Repository<User, Uuid>> UserService for T {
    async fn get_user(&self, id: &Uuid) -> Result<UserDto, ApiError> {
        let user = self.find_by_id(id).await?
            .ok_or_else(|| ApiError::NotFound(format!("User {id} not found")))?;
        Ok(UserDto::from(user))
    }
}

// Trait objects (dynamic dispatch)
fn get_repo() -> Box<dyn Repository<User, Uuid> + Send + Sync> {
    Box::new(PostgresRepo::new())
}

// Associated types
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}

pub struct RangeIterator {
    current: i32,
    end: i32,
}

impl Iterator for RangeIterator {
    type Item = i32;
    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.end {
            let val = self.current;
            self.current += 1;
            Some(val)
        } else {
            None
        }
    }
}

// Extension trait pattern
pub trait StrExt {
    fn is_valid_email(&self) -> bool;
}

impl StrExt for str {
    fn is_valid_email(&self) -> bool {
        // simple check
        self.contains('@') && self.contains('.')
    }
}

// Usage: "test@example.com".is_valid_email()

// Trait constraints
pub async fn process<T>(item: T) -> Result<T::Output, T::Error>
where
    T: Send + Sync + 'static,
    T: Processor + Serialize,
    T::Output: DeserializeOwned,
    T::Error: std::fmt::Display,
{
    // ...
}

// Async trait (stable as of Rust 1.75)
#[async_trait::async_trait]
pub trait CacheProvider {
    async fn get(&self, key: &str) -> Result<Option<String>, CacheError>;
    async fn set(&self, key: &str, value: &str, ttl_secs: u32) -> Result<(), CacheError>;
    async fn del(&self, key: &str) -> Result<(), CacheError>;
}
```

---

## Error Handling

### Result Type

```rust
// Basic error propagation with ?
fn read_config(path: &str) -> Result<Config, ConfigError> {
    let content = std::fs::read_to_string(path)?;            // converts io::Error
    let config: Config = toml::from_str(&content)?;           // converts toml::de::Error
    Ok(config)
}

// Combinators
fn parse_number(input: &str) -> Result<i32, ParseError> {
    input
        .parse::<i32>()
        .map_err(|_| ParseError::InvalidInteger(input.to_string()))
}

// and_then for chaining
fn get_user_posts(user_id: Uuid) -> Result<Vec<Post>, ApiError> {
    find_user(user_id)?
        .ok_or(ApiError::NotFound("User not found".into()))
        .and_then(|user| get_posts(user.id))
}

// Type alias in module
pub type Result<T> = std::result::Result<T, AppError>;
```

### Custom Error Types

```rust
// Using thiserror (most common)
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("configuration error: {0}")]
    Config(String),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("HTTP client error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("resource not found: {0}")]
    NotFound(String),

    #[error("unauthorized")]
    Unauthorized,

    #[error("validation failed: {0}")]
    Validation(String),

    #[error(transparent)]   // wraps into the inner error's message
    Io(#[from] std::io::Error),
}

// Using anyhow for application/prototype code
use anyhow::{Context, Result, anyhow, bail};

fn process_file(path: &str) -> Result<()> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file '{path}'"))?;

    if content.trim().is_empty() {
        bail!("Config file '{path}' is empty");  // early return with error
    }

    Ok(())
}

// Error context for better messages
fn connect_db(url: &str) -> Result<Pool> {
    MySqlPoolOptions::new()
        .connect(url)
        .await
        .context("Failed to connect to database")?  // wraps error with context
}
```

---

## Collections & Iterators

### Iterators

```rust
// Chain transformations
let active_admins: Vec<String> = users
    .iter()
    .filter(|u| u.is_active)
    .filter(|u| u.role == Role::Admin)
    .map(|u| u.email.clone())
    .collect();

// fold (reduce with accumulator)
let total_age: u32 = users.iter().fold(0, |acc, u| acc + u.age);

// find returns Option
let first_admin = users.iter().find(|u| u.role == Role::Admin);

// partition splits collection
let (admins, regulars): (Vec<_>, Vec<_>) = users
    .into_iter()
    .partition(|u| u.role == Role::Admin);

// group_by with itertools
use itertools::Itertools;
let grouped: Vec<(Role, Vec<&User>)> = users
    .iter()
    .sorted_by_key(|u| u.role)
    .chunk_by(|u| u.role)
    .into_iter()
    .map(|(role, group)| (role, group.collect()))
    .collect();

// flat_map for nested structures
let all_tags: Vec<String> = posts
    .iter()
    .flat_map(|p| p.tags.iter().cloned())
    .unique()
    .sorted()
    .collect();

// Custom iterator with collect()
#[derive(Debug)]
struct Paginated<T> {
    items: Vec<T>,
    total: usize,
}

impl<T> FromIterator<T> for Paginated<T> {
    fn from_iter<I: IntoIterator<Item = T>>(iter: I) -> Self {
        let items: Vec<T> = iter.into_iter().collect();
        let total = items.len();
        Self { items, total }
    }
}
```

### HashMap Patterns

```rust
use std::collections::HashMap;

// Entry API (insert or update)
let mut word_count: HashMap<String, u32> = HashMap::new();
for word in text.split_whitespace() {
    word_count.entry(word.to_lowercase())
        .and_modify(|count| *count += 1)
        .or_insert(1);
}

// Get or insert default
let cache = &mut HashMap::new();
let value = cache.entry(key).or_insert_with(|| expensive_computation());

// Collect into HashMap
let users_by_id: HashMap<Uuid, User> = users
    .into_iter()
    .map(|u| (u.id, u))
    .collect();

// HashMap with multiple values per key
let mut index: HashMap<String, Vec<Uuid>> = HashMap::new();
for user in &users {
    index.entry(user.role.to_string())
        .or_default()
        .push(user.id);
}
```

---

## Async/Await & Tokio

### Basic Async

```rust
// Async function
async fn fetch_user(id: Uuid) -> Result<User, ApiError> {
    let row = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_one(&pool)
        .await?;
    Ok(row)
}

// Concurrent operations with join!
async fn get_dashboard(user_id: Uuid) -> Result<Dashboard, AppError> {
    let (user, posts, notifications) = tokio::join!(
        fetch_user(user_id),
        fetch_posts(user_id),
        fetch_notifications(user_id),
    );
    Ok(Dashboard {
        user: user?,
        posts: posts?,
        notifications: notifications?,
    })
}

// try_join! stops on first error
async fn save_all(items: Vec<Item>) -> Result<Vec<Item>, AppError> {
    let futures: Vec<_> = items.into_iter().map(|item| save_item(item)).collect();
    tokio::try_join_all(futures)  // fails fast on first error
}

// select! for racing
async fn fetch_with_timeout(url: &str) -> Result<String, AppError> {
    tokio::select! {
        result = fetch(url) => result,
        _ = tokio::time::sleep(Duration::from_secs(5)) => {
            Err(AppError::Timeout("Request timed out".into()))
        }
    }
}

// Spawning tasks
#[tokio::main]
async fn main() {
    let handle = tokio::spawn(async {
        // expensive computation
        process_data().await
    });

    // Await the result later
    let result = handle.await.unwrap();
}

// Channels
async fn producer_consumer() {
    let (tx, mut rx) = tokio::sync::mpsc::channel(32);

    let producer = tokio::spawn(async move {
        for i in 0..100 {
            tx.send(i).await.unwrap();
        }
    });

    let consumer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            println!("Got: {msg}");
        }
    });

    tokio::try_join!(producer, consumer).unwrap();
}
```

### Axum Web Framework

```rust
use axum::{
    Router, routing::{get, post},
    extract::{State, Path, Query, Json},
    http::StatusCode,
    middleware,
};

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
    redis: redis::Client,
}

#[tokio::main]
async fn main() {
    let state = AppState { db: init_db().await, redis: init_redis() };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/:id", get(get_user).patch(update_user).delete(delete_user))
        .route_layer(middleware::from_fn(auth_middleware))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn create_user(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserDto>,
) -> Result<(StatusCode, Json<UserDto>), AppError> {
    let user = sqlx::query_as!(User,
        "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *",
        payload.email, payload.name
    )
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(user.into())))
}
```

---

## Macros

### Declarative Macros

```rust
// Simple macro for repetition
macro_rules! vec_of_strings {
    ($($x:expr),*) => {
        vec![$($x.to_string()),*]
    };
}

// Macro for SQL query params
macro_rules! paginate {
    ($query:expr, $page:expr, $limit:expr) => {{
        let offset = ($page - 1) * $limit;
        format!("{} LIMIT {} OFFSET {}", $query, $limit, offset)
    }};
}

// Macro generating struct with common derives
macro_rules! model {
    ($name:ident { $($field:ident: $type:ty),* $(,)? }) => {
        #[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
        pub struct $name {
            pub id: uuid::Uuid,
            $(pub $field: $type,)*
            pub created_at: chrono::DateTime<chrono::Utc>,
            pub updated_at: chrono::DateTime<chrono::Utc>,
        }
    };
}

model!(User {
    email: String,
    name: String,
    role: String,
});
```

### Proc Macros (derive)

```rust
// Derive macro example
#[proc_macro_derive(MyTrait)]
pub fn derive_my_trait(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let expanded = quote! {
        impl MyTrait for #name {
            fn describe() -> String {
                format!("{} at {}", stringify!(#name), file!())
            }
        }
    };

    TokenStream::from(expanded)
}

// Attribute macro
#[proc_macro_attribute]
pub fn log_execution_time(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let fn_item = parse_macro_input!(item as ItemFn);
    let name = &fn_item.sig.ident;

    let expanded = quote! {
        #fn_item

        fn #name() {
            let start = std::time::Instant::now();
            let result = #name();
            println!("{} took {:?}", stringify!(#name), start.elapsed());
            result
        }
    };

    TokenStream::from(expanded)
}
```

---

## Testing

```rust
// Unit tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_user_with_valid_data() {
        let user = User::new("test@test.com".into(), "Test User".into());
        assert_eq!(user.email, "test@test.com");
        assert!(!user.id.is_nil());
    }

    #[test]
    #[should_panic(expected = "Invalid email")]
    fn test_create_user_empty_email() {
        User::new("".into(), "Test".into());  // should panic
    }

    // Parametrized tests with rstest
    #[rstest::rstest]
    #[case("test@test.com", true)]
    #[case("invalid", false)]
    #[case("", false)]
    #[case("user@domain.co.uk", true)]
    fn test_email_validation(#[case] email: &str, #[case] expected: bool) {
        assert_eq!(email.is_valid_email(), expected);
    }
}

// Async tests
#[cfg(test)]
mod async_tests {
    use super::*;

    #[tokio::test]
    async fn test_fetch_user_not_found() {
        let pool = test_helpers::create_test_db().await;
        let result = fetch_user(&pool, &Uuid::new_v4()).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::NotFound(_)));
    }

    #[sqlx::test]
    async fn test_create_and_fetch(pool: sqlx::PgPool) {
        let user = create_user(&pool, CreateUserDto {
            email: "test@test.com".into(),
            name: "Test".into(),
        }).await.unwrap();

        let fetched = fetch_user(&pool, &user.id).await.unwrap();
        assert_eq!(fetched.email, user.email);
    }
}

// Integration tests (in tests/ directory)
// tests/api_test.rs
#[tokio::test]
async fn test_create_user_endpoint() {
    let app = test_helpers::spawn_app().await;

    let response = app
        .post("/api/users")
        .json(&serde_json::json!({
            "email": "api@test.com",
            "name": "API User",
        }))
        .send()
        .await
        .expect("Failed to execute request");

    assert_eq!(response.status(), 201);
    let body: serde_json::Value = response.json().await.unwrap();
    assert_eq!(body["email"], "api@test.com");
}

#[tokio::test]
async fn test_create_user_duplicate_email() {
    let app = test_helpers::spawn_app().await;

    // First creation succeeds
    let payload = serde_json::json!({"email": "dup@test.com", "name": "First"});
    app.post("/api/users").json(&payload).send().await.unwrap();

    // Second creation conflicts
    let response = app.post("/api/users").json(&payload).send().await.unwrap();
    assert_eq!(response.status(), 409);
}
```

---

## Cargo & Project Structure

```toml
# Cargo.toml
[package]
name = "my-api"
version = "0.1.0"
edition = "2024"  # latest edition

[dependencies]
# Async runtime
tokio = { version = "1", features = ["full"] }
axum = "0.8"

# Database
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Error handling
thiserror = "2"
anyhow = "1"

# Utilities
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tower-http = { version = "0.5", features = ["cors", "trace", "compression-gzip"] }

# Testing
rstest = "0.18"
mockall = "0.12"

[dev-dependencies]
tower = { version = "0.5", features = ["util"] }  # for test helpers
reqwest = { version = "0.12", features = ["json"] }
```

### Recommended Structure

```
src/
  main.rs                      # Entry point, server startup
  lib.rs                       # Re-exports, shared utilities
  config/
    mod.rs                     # Configuration loading
    app.rs                     # AppConfig struct
  db/
    mod.rs                     # Database module
    pool.rs                    # Connection pool initialization
    migrations.rs              # Migration runner
  models/
    mod.rs
    user.rs                    # User struct + impls
    post.rs
  handlers/
    mod.rs
    users.rs                   # Route handlers for /api/users
    posts.rs
    auth.rs
  services/
    mod.rs
    user_service.rs            # Business logic
    auth_service.rs
  dto/
    mod.rs
    user_dto.rs                # Request/Response DTOs
  errors/
    mod.rs                     # AppError enum
  middleware/
    mod.rs
    auth.rs                    # Auth middleware
    logging.rs                 # Request logging
  utils/
    mod.rs
    crypto.rs                  # Password hashing
    jwt.rs                     # Token generation/validation
tests/                         # Integration tests
  common/
    mod.rs                     # Test helpers, fixtures, app spawn
  api/
    users_test.rs
    auth_test.rs
```

---

## Common Pitfalls

### 1. Fighting the Borrow Checker

```rust
// BAD: Trying to borrow mutably while another borrow exists
let mut items = vec![1, 2, 3];
let first = &items[0];   // immutable borrow
items.push(4);            // COMPILE ERROR: mutable borrow while immutable exists
println!("{first}");      // uses immutable borrow

// GOOD: Reduce scope of immutable borrow, or clone
let mut items = vec![1, 2, 3];
let first = items[0];     // copy/clone (i32 is Copy)
items.push(4);             // now fine
println!("{first}");

// OR: restructure to avoid overlap
let mut items = vec![1, 2, 3];
{
    let first = &items[0];
    println!("{first}");   // borrow ends here
}
items.push(4);             // now fine
```

### 2. Blocking Async Runtime

```rust
// BAD: Blocking operations in async context
async fn handler() {
    let content = std::fs::read_to_string("data.json")?;  // BLOCKS the thread!
    process(content).await
}

// GOOD: Use tokio's async equivalents or spawn_blocking
async fn handler() {
    let content = tokio::task::spawn_blocking(|| {
        std::fs::read_to_string("data.json")
    })
    .await??;
    process(content).await
}

// EVEN BETTER: Use async-aware libraries
async fn handler() {
    let content = tokio::fs::read_to_string("data.json").await?;
    process(content).await
}
```

### 3. Unnecessary Cloning / Allocation

```rust
// BAD: Clone when a reference would work
fn process_user(user: User) {  // takes ownership
    println!("{user.name}");
}
let user = User::new();
process_user(user.clone());     // clone to keep ownership

// GOOD: Borrow instead
fn process_user(user: &User) {
    println!("{user.name}");
}
process_user(&user);            // no clone needed
```

### 4. String vs &str Confusion

```rust
// BAD: Using String when &str is enough
fn greet(name: String) {  // requires allocation from caller
    println!("Hello, {name}");
}
greet(String::from("World"));  // unnecessary allocation
greet("World".to_string());    // unnecessary allocation

// GOOD: Accept &str
fn greet(name: &str) {
    println!("Hello, {name}");
}
greet("World");           // string literal is &str
greet(&user.name);        // borrow from String

// EXCEPTION: When you need to store it, take String
struct Person {
    name: String,  // correct: owner
}
```

### 5. Mutex Poisoning Panic

```rust
// BAD: unwrap() on mutex lock - panics if another thread panicked while holding it
let guard = shared_data.lock().unwrap();

// GOOD: Handle poisoning gracefully
let guard = match shared_data.lock() {
    Ok(guard) => guard,
    Err(poisoned) => {
        eprintln!("Mutex was poisoned, recovering...");
        poisoned.into_inner()  // recover inner data
    }
};

// ALTERNATIVE: For databases/external resources, use RwLock instead of Mutex
```

### 6. Iterator Exhaustion

```rust
// BAD: Using an iterator after collect()
let iter = vec![1, 2, 3].into_iter();
let items: Vec<_> = iter.collect();  // iter consumed
// let more: Vec<_> = iter.collect(); // COMPILE ERROR: use of moved value

// GOOD: Use iter() (borrows) when you need it again
let items = vec![1, 2, 3];
let a = items.iter().collect::<Vec<_>>();
let b = items.iter().collect::<Vec<_>>();  // fine: iter() borrows
```

### 7. Release Binary Size

```toml
# Cargo.toml - reduce binary size
[profile.release]
opt-level = "s"      # optimize for size (use "z" for extreme)
lto = true           # link time optimization
codegen-units = 1    # better optimization, slower compile
strip = true         # strip symbols
panic = "abort"      # smaller binary, no unwinding
```

---

## PostgreSQL Raw SQL (sqlx, sin ORMs)

Si prefieres SQL puro y stored procedures en Rust:

```toml
# Cargo.toml - dependencies for PostgreSQL raw SQL
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "postgres", "uuid", "chrono", "migrate"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
```

```rust
// db.rs - Connection pool
use sqlx::postgres::{PgPool, PgPoolOptions, PgRow};
use sqlx::{FromRow, query, query_as};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub type DbPool = PgPool;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .min_connections(5)
        .idle_timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(5))
        .connect(database_url)
        .await
}

// Row struct con FromRow para mapeo automatico
#[derive(Debug, FromRow, serde::Serialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

// users_repo.rs - Queries SQL PURAS (sin ORM!)
pub struct UserRepo {
    pool: DbPool,
}

impl UserRepo {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    // Query con parametros tipados (protege contra SQL injection)
    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, sqlx::Error> {
        query_as::<_, User>(
            "SELECT id, email, name, role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
    }

    // Query con filtros dinamicos (query builder + params)
    pub async fn find_by_filters(
        &self,
        email: Option<&str>,
        role: Option<&str>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<User>, sqlx::Error> {
        let mut builder = sqlx::QueryBuilder::new(
            "SELECT id, email, name, role, created_at FROM users WHERE deleted_at IS NULL"
        );

        if let Some(email) = email {
            builder.push(" AND email ILIKE ").push_bind(format!("%{}%", email));
        }
        if let Some(role) = role {
            builder.push(" AND role = ").push_bind(role);
        }

        builder
            .push(" ORDER BY created_at DESC LIMIT ")
            .push_bind(limit)
            .push(" OFFSET ")
            .push_bind(offset);

        builder.build_query_as::<User>().fetch_all(&self.pool).await
    }

    // Insert con RETURNING (sin SELECT extra)
    pub async fn create(&self, email: &str, name: &str, password_hash: &str, role: &str) -> Result<User, sqlx::Error> {
        query_as::<_, User>(
            "INSERT INTO users (email, name, password_hash, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, name, role, created_at"
        )
        .bind(email)
        .bind(name)
        .bind(password_hash)
        .bind(role)
        .fetch_one(&self.pool)
        .await
    }

    // Update con optimistic locking
    pub async fn update_name(&self, id: Uuid, name: &str, expected_version: i32) -> Result<User, AppError> {
        let result = sqlx::query(
            "UPDATE users SET name = $2, version = version + 1, updated_at = now()
             WHERE id = $1 AND version = $3
             RETURNING id, email, name, role, version, created_at, updated_at"
        )
        .bind(id)
        .bind(name)
        .bind(expected_version)
        .fetch_optional(&self.pool)
        .await?;

        result.map_or_else(
            || Err(AppError::Conflict("User modified by another request. Refresh.".into())),
            |row| Ok(User::from_row(&row)?),
        )
    }

    // Soft delete
    pub async fn soft_delete(&self, id: Uuid) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE users SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL"
        )
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // Raw SQL con multiple params
    pub async fn search_full_text(&self, query: &str) -> Result<Vec<User>, sqlx::Error> {
        query_as::<_, User>(
            "SELECT id, email, name, role, created_at
             FROM users
             WHERE to_tsvector('english', name || ' ' || email) @@ plainto_tsquery('english', $1)
               AND deleted_at IS NULL
             ORDER BY ts_rank(to_tsvector('english', name || ' ' || email), plainto_tsquery('english', $1)) DESC
             LIMIT 20"
        )
        .bind(query)
        .fetch_all(&self.pool)
        .await
    }
}

// service.rs - Transactions multi-tabla
pub async fn transfer_credits(
    pool: &DbPool,
    from_id: Uuid,
    to_id: Uuid,
    amount: i64,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    // Deduct from sender
    let deduct_result = sqlx::query(
        "UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1"
    )
    .bind(amount)
    .bind(from_id)
    .execute(&mut *tx)
    .await?;

    if deduct_result.rows_affected() == 0 {
        tx.rollback().await?;
        return Err(AppError::BadRequest("Insufficient credits".into()));
    }

    // Add to receiver
    sqlx::query("UPDATE users SET credits = credits + $1 WHERE id = $2")
        .bind(amount)
        .bind(to_id)
        .execute(&mut *tx)
        .await?;

    // Log
    sqlx::query(
        "INSERT INTO credit_transfers (from_user_id, to_user_id, amount) VALUES ($1, $2, $3)"
    )
    .bind(from_id)
    .bind(to_id)
    .bind(amount)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

// stored_procedure.rs - Llamar funciones/procedures PostgreSQL
pub async fn get_dashboard(pool: &DbPool, user_id: Uuid) -> Result<DashboardData, AppError> {
    // Llamar funcion SQL
    let user = query_as::<_, User>(
        "SELECT * FROM get_user_by_id($1)"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Procedimiento con multiples result sets no es soportado por sqlx.
    // Solucion: llamar funciones separadas que devuelven TABLE
    let stats = query_as::<_, UserStats>(
        "SELECT * FROM get_user_stats($1)"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    let orders = query_as::<_, Order>(
        "SELECT * FROM get_recent_orders($1, 5)"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(DashboardData { user, stats, recent_orders: orders })
}
```

### Principios SQL Puro en Rust:

```
1. SIEMPRE bind(): sqlx::query("...WHERE id = $1").bind(id) - parametrizado
2. NUNCA format!: evitar format!("SELECT * FROM {table}") - usar QueryBuilder con push_bind
3. Usa RETURNING: INSERT/UPDATE con RETURNING * evita SELECT extra
4. Transacciones explicitas: pool.begin() -> commit/rollback
5. FromRow derive: mapea filas a structs automaticamente
6. fetch_optional: para queries que pueden no encontrar resultado (Option<T>)
7. QueryBuilder: para queries dinamicas con numero variable de condiciones
8. Migraciones: sqlx migrate run para control de versiones de BD
```

