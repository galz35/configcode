# API Testing Reference

## Table of Contents
- [JavaScript: Supertest + Jest (Nest.js)](#supertest)
- [Python: Requests + Pytest](#pytest)
- [HTTPie / Curl (rapido, manual)](#httpie)
- [Postman / Bruno (GUI + CLI)](#postman)
- [Contract Testing](#contract)
- [Load Testing](#load)
- [Mock Server](#mock)
- [Test Data Factories](#factories)
- [CI/CD Integration](#cicd)

---

## JavaScript: Supertest + Jest (Nest.js E2E)

### Setup

```bash
npm install --save-dev supertest @types/supertest jest @nestjs/testing
```

```typescript
// test/api/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Users API (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: login y obtener token
  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);

    return res.body.data.accessToken;
  }

  describe('POST /api/v1/users', () => {
    it('creates a user and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'new@test.com',
          name: 'New User',
          password: 'Str0ngP@ss!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: 'new@test.com',
        name: 'New User',
      });
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data.id).toBeDefined();
    });

    it('validates email format and returns 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'invalid', name: 'Test', password: 'Str0ngP@ss!' })
        .expect(400);

      expect(res.body.message).toContain('email');
    });

    it('rejects duplicate email with 409', async () => {
      // First creation
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'dup@test.com', name: 'A', password: 'Str0ngP@ss!' })
        .expect(201);

      // Duplicate
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'dup@test.com', name: 'B', password: 'Str0ngP@ss!' })
        .expect(409);
    });

    it('strips unknown fields (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({
          email: 'clean@test.com',
          name: 'Clean',
          password: 'Str0ngP@ss!',
          isAdmin: true,     // campo no decorado → ignorado
          injected: '<script>alert(1)</script>', // ignorado
        })
        .expect(201);

      expect(res.body.data).not.toHaveProperty('isAdmin');
      expect(res.body.data).not.toHaveProperty('injected');
    });
  });

  describe('GET /api/v1/users', () => {
    beforeEach(async () => {
      accessToken = await login('admin@test.com', 'AdminP@ss1');
    });

    it('requires authentication (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('returns paginated users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body.data.meta).toMatchObject({
        page: 1,
        limit: 10,
      });
      expect(res.body.data.meta.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('rejects invalid page param', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users?page=abc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('returns 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('End-to-end flow', () => {
    it('register → login → create resource → read resource', async () => {
      // 1. Register
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'flow@test.com', name: 'Flow', password: 'Str0ngP@ss!' })
        .expect(201);
      const userId = registerRes.body.data.id;

      // 2. Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'flow@test.com', password: 'Str0ngP@ss!' })
        .expect(201);
      const token = loginRes.body.data.accessToken;

      // 3. Get own profile
      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(profileRes.body.data.id).toBe(userId);

      // 4. Delete (soft)
      await request(app.getHttpServer())
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // 5. Verify deleted (should be 404 for GET with deleted filter)
      await request(app.getHttpServer())
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
```

### Test Helpers

```typescript
// test/api/helpers.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export class ApiHelper {
  private token: string | null = null;

  constructor(private readonly app: INestApplication) {}

  async login(email: string, password: string): Promise<this> {
    const res = await request(this.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    this.token = res.body.data.accessToken;
    return this;
  }

  get auth() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async post(path: string, data: any, expectedStatus = 201) {
    return request(this.app.getHttpServer())
      .post(path)
      .set(this.auth)
      .send(data)
      .expect(expectedStatus);
  }

  async get(path: string, query?: any, expectedStatus = 200) {
    const req = request(this.app.getHttpServer())
      .get(path)
      .set(this.auth);
    if (query) req.query(query);
    return req.expect(expectedStatus);
  }

  async patch(path: string, data: any, expectedStatus = 200) {
    return request(this.app.getHttpServer())
      .patch(path)
      .set(this.auth)
      .send(data)
      .expect(expectedStatus);
  }

  async del(path: string, expectedStatus = 204) {
    return request(this.app.getHttpServer())
      .delete(path)
      .set(this.auth)
      .expect(expectedStatus);
  }
}

// Usage:
// const api = new ApiHelper(app);
// await api.login('test@test.com', 'pass');
// const res = await api.get('/api/v1/users');
```

---

## Python: Requests + Pytest

```python
# test/api/test_users.py
import pytest
import requests
import uuid

BASE_URL = "http://localhost:3000/api/v1"

@pytest.fixture
def auth_token():
    """Login and return access token"""
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@test.com",
        "password": "AdminP@ss1",
    })
    assert res.status_code == 201
    return res.json()["data"]["accessToken"]

@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}

class TestUsersAPI:
    def test_create_user_returns_201(self):
        res = requests.post(f"{BASE_URL}/users", json={
            "email": "py@test.com",
            "name": "Python Test",
            "password": "Str0ngP@ss!",
        })
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["email"] == "py@test.com"
        assert "password" not in data
        assert uuid.UUID(data["id"])  # valid UUID

    def test_create_user_invalid_email_returns_400(self):
        res = requests.post(f"{BASE_URL}/users", json={
            "email": "not-an-email",
            "name": "Test",
            "password": "Str0ngP@ss!",
        })
        assert res.status_code == 400
        assert "email" in str(res.json()).lower()

    def test_create_user_duplicate_returns_409(self):
        payload = {"email": "dup@test.com", "name": "T", "password": "Str0ngP@ss!"}
        requests.post(f"{BASE_URL}/users", json=payload)
        res = requests.post(f"{BASE_URL}/users", json=payload)
        assert res.status_code == 409

    def test_get_users_requires_auth(self):
        res = requests.get(f"{BASE_URL}/users")
        assert res.status_code == 401

    def test_get_users_returns_paginated(self, auth_headers):
        res = requests.get(f"{BASE_URL}/users", headers=auth_headers, params={
            "page": 1, "limit": 10
        })
        assert res.status_code == 200
        meta = res.json()["data"]["meta"]
        assert meta["page"] == 1
        assert meta["total"] > 0
        assert len(res.json()["data"]["items"]) <= 10

    @pytest.mark.parametrize("field,value,expected_field", [
        ("email", "", "email"),
        ("name", "", "name"),
        ("password", "short", "password"),
    ])
    def test_validation_empty_fields(self, field, value, expected_field):
        payload = {"email": "x@x.com", "name": "X", "password": "Str0ngP@ss!"}
        payload[field] = value
        res = requests.post(f"{BASE_URL}/users", json=payload)
        assert res.status_code == 400
        assert expected_field in str(res.json()).lower()

class TestAuthFlow:
    def test_full_auth_flow(self):
        email = f"flow{uuid.uuid4().hex[:8]}@test.com"
        password = "Str0ngP@ss!"

        # 1. Register
        reg = requests.post(f"{BASE_URL}/auth/register", json={
            "email": email, "name": "Flow", "password": password
        })
        assert reg.status_code == 201

        # 2. Login
        login = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email, "password": password
        })
        assert login.status_code == 201
        token = login.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Get profile
        profile = requests.get(f"{BASE_URL}/users/me/profile", headers=headers)
        assert profile.status_code == 200
        assert profile.json()["data"]["email"] == email

        # 4. Refresh token
        refresh_token = login.json()["data"]["refreshToken"]
        refresh = requests.post(f"{BASE_URL}/auth/refresh", json={
            "refreshToken": refresh_token
        })
        assert refresh.status_code == 201
        new_token = refresh.json()["data"]["accessToken"]
        assert new_token != token  # rotated!

        # 5. Old token should still work (until expiry)
        old = requests.get(f"{BASE_URL}/users/me/profile", headers=headers)
        assert old.status_code == 200  # or 401 if blacklisted
```

### Pytest con fixtures avanzadas

```python
# conftest.py
import pytest
import requests
import subprocess
import time

@pytest.fixture(scope="session")
def api():
    """Start server and wait for it"""
    # Asume que el server esta corriendo
    # Si no: subprocess.Popen(["npm", "run", "start:dev"])
    # time.sleep(3)
    pass

@pytest.fixture
def fresh_db():
    """Limpia la DB antes de cada test"""
    requests.post("http://localhost:3001/test/reset-db")
    yield
    requests.post("http://localhost:3001/test/reset-db")

@pytest.fixture
def api_client():
    """Cliente HTTP wrapper"""
    class APIClient:
        def __init__(self):
            self.base = "http://localhost:3000/api/v1"
            self.token = None

        @property
        def headers(self):
            h = {"Content-Type": "application/json"}
            if self.token:
                h["Authorization"] = f"Bearer {self.token}"
            return h

        def login(self, email, password):
            res = requests.post(f"{self.base}/auth/login", json={
                "email": email, "password": password
            }, headers={"Content-Type": "application/json"})
            assert res.status_code == 201
            self.token = res.json()["data"]["accessToken"]
            return self

        def get(self, path, **kwargs):
            return requests.get(f"{self.base}{path}", headers=self.headers, **kwargs)

        def post(self, path, data, **kwargs):
            return requests.post(f"{self.base}{path}", json=data, headers=self.headers, **kwargs)

        def assert_status(self, response, expected):
            assert response.status_code == expected, \
                f"Expected {expected}, got {response.status_code}: {response.text}"

    return APIClient()
```

---

## HTTPie / Curl (rapido, manual)

```bash
# HTTPie (mas legible que curl)
# Login
http POST localhost:3000/api/v1/auth/login email=admin@test.com password=AdminP@ss1

# Usar token
TOKEN=$(http POST localhost:3000/api/v1/auth/login email=admin@test.com password=AdminP@ss1 | jq -r '.data.accessToken')
http GET localhost:3000/api/v1/users Authorization:"Bearer $TOKEN"

# Crear usuario
http POST localhost:3000/api/v1/users email=nuevo@test.com name=Nuevo password=Str0ngP@ss!

# Con query params
http GET "localhost:3000/api/v1/users?page=2&limit=5" Authorization:"Bearer $TOKEN"

# Con archivo JSON
http POST localhost:3000/api/v1/users < payload.json Authorization:"Bearer $TOKEN"

# === Curl (siempre disponible) ===
# Login
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"AdminP@ss1"}' | jq .

# Con token extraido
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"AdminP@ss1"}' | jq -r '.data.accessToken')

curl -s http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test rapido de todos los status codes
for endpoint in "/health" "/api/v1/users" "/api/v1/auth/login"; do
  echo -n "$endpoint: "
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint"
  echo ""
done
```

### Script de smoke test rapido

```bash
#!/bin/bash
# scripts/smoke-test.sh
# Smoke test basico - corre en segundos, ideal para CI rapido

BASE="http://localhost:3000/api/v1"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected="$2"
  local method="$3"
  local url="$4"
  local data="$5"
  local token="$6"

  local headers=(-H "Content-Type: application/json")
  [ -n "$token" ] && headers+=(-H "Authorization: Bearer $token")

  local status
  if [ "$method" = "POST" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${headers[@]}" -d "$data" "$BASE$url")
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "${headers[@]}" "$BASE$url")
  fi

  if [ "$status" = "$expected" ]; then
    echo "  PASS: $desc (got $status)"
    ((PASS++))
  else
    echo "  FAIL: $desc (expected $expected, got $status)"
    ((FAIL++))
  fi
}

echo "SMOKE TEST"
echo "=========="

# Health
check "Health endpoint" "200" "GET" "/health" "" ""

# Auth
check "Login valid" "201" "POST" "/auth/login" '{"email":"admin@test.com","password":"AdminP@ss1"}' ""
check "Login invalid" "401" "POST" "/auth/login" '{"email":"admin@test.com","password":"wrong"}' ""

# Users (sin auth → 401)
check "Users sin auth" "401" "GET" "/users" "" ""

# Obtener token
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"AdminP@ss1"}' | jq -r '.data.accessToken')

# Users (con auth → 200)
check "Users con auth" "200" "GET" "/users" "" "$TOKEN"

# Create user
check "Create user" "201" "POST" "/users" \
  '{"email":"smoke@test.com","name":"Smoke","password":"Sm0keT3st!"}' "$TOKEN"

# Duplicate
check "Duplicate email" "409" "POST" "/users" \
  '{"email":"smoke@test.com","name":"Dup","password":"Sm0keT3st!"}' "$TOKEN"

echo ""
echo "Results: $PASS passed, $FAIL failed"
exit $FAIL
```

---

## Postman / Bruno (GUI + CLI)

### Bruno (open source, archivos JSON en git)

```
collection/
  api.bru                    # Config de la coleccion
  auth/
    login.bru                # POST /auth/login
    register.bru             # POST /auth/register
    refresh.bru              # POST /auth/refresh
  users/
    list.bru                 # GET /users
    create.bru               # POST /users
    get-by-id.bru            # GET /users/:id
    update.bru               # PATCH /users/:id
    delete.bru               # DELETE /users/:id
  environments/
    dev.bru                  # http://localhost:3000
    staging.bru              # https://staging-api.example.com
```

### Newman (Postman CLI para CI/CD)

```bash
# Instalar
npm install -g newman

# Correr coleccion Postman
newman run collection.json -e environment.json

# Con reporter HTML
newman run collection.json -e environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export ./reports/api-report.html

# En CI (GitHub Actions):
# - name: API Tests
#   run: |
#     npm run start:test &
#     sleep 5
#     newman run postman/collection.json -e postman/test.json
```

---

## Contract Testing

### Pact (consumer-driven contracts)

```typescript
// Consumer test (frontend → espera cierta forma de respuesta)
import { Pact } from '@pact-foundation/pact';

const provider = new Pact({
  consumer: 'react-app',
  provider: 'nestjs-api',
  port: 1234,
});

beforeAll(() => provider.setup());
afterAll(() => provider.finalize());

describe('Users API contract', () => {
  it('GET /api/v1/users returns User[]', async () => {
    await provider.addInteraction({
      state: 'has users',
      uponReceiving: 'a request for users',
      withRequest: {
        method: 'GET',
        path: '/api/v1/users',
        query: { page: '1', limit: '10' },
        headers: { Authorization: 'Bearer valid-token' },
      },
      willRespondWith: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            items: [
              { id: 'uuid', email: 'user@test.com', name: 'User' },
            ],
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
          },
        },
      },
    });

    const users = await fetchUsers(1, 10);
    expect(Array.isArray(users.items)).toBe(true);
    expect(users.items[0]).toHaveProperty('email');

    await provider.verify();
  });
});
```

---

## Load Testing

### k6 (JavaScript, mejor para devs)

```javascript
// load/login-test.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up to 50 users
    { duration: '1m', target: 50 },    // stay at 50
    { duration: '30s', target: 100 },  // ramp up to 100
    { duration: '1m', target: 100 },   // stay at 100
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% errors
  },
};

const BASE = 'http://localhost:3000/api/v1';

export default function () {
  group('Login flow', () => {
    const res = http.post(`${BASE}/auth/login`, JSON.stringify({
      email: `user${__VU}@test.com`,
      password: 'TestP@ss1',
    }), { headers: { 'Content-Type': 'application/json' } });

    check(res, {
      'login OK': (r) => r.status === 201,
      'has token': (r) => r.json('data.accessToken') !== '',
    });

    const token = res.json('data.accessToken');

    // Get users
    const users = http.get(`${BASE}/users?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(users, {
      'users OK': (r) => r.status === 200,
    });
  });

  sleep(1);
}
```

### Artillery (YAML, mas simple)

```yaml
# load/artillery.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      rampTo: 50
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Login and fetch users"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "load@test.com"
            password: "LoadT3st!"
          capture:
            - json: "$.data.accessToken"
              as: "token"
      - get:
          url: "/api/v1/users"
          headers:
            Authorization: "Bearer {{ token }}"
          qs:
            page: 1
            limit: 10
```

---

## Mock Server

### JSON Server (rapido para prototipos)

```bash
npx json-server db.json --port 4000 --routes routes.json
```

```json
// db.json
{
  "users": [
    { "id": "1", "email": "a@b.com", "name": "Alice" }
  ],
  "posts": [
    { "id": "1", "userId": "1", "title": "Hello" }
  ]
}
// routes.json
{
  "/api/v1/*": "/$1"
}
```

### MSW (Mock Service Worker - tests + dev)

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    if (email === 'test@test.com' && password === 'password') {
      return HttpResponse.json({
        success: true,
        data: { accessToken: 'mock-token', user: { id: '1', email } },
      });
    }
    return HttpResponse.json(
      { success: false, message: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.get('*/users', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth) {
      return HttpResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          { id: '1', email: 'a@b.com', name: 'Alice' },
          { id: '2', email: 'b@c.com', name: 'Bob' },
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      },
    });
  }),
];
```

---

## Test Data Factories

```typescript
// test/factories/user.factory.ts
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export async function createTestUser(overrides?: Partial<{
  email: string;
  name: string;
  password: string;
  role: string;
}>) {
  const random = crypto.randomBytes(4).toString('hex');
  const defaults = {
    email: `test-${random}@example.com`,
    name: `Test User ${random}`,
    password: 'TestP@ss1',
    role: 'user',
  };

  const data = { ...defaults, ...overrides };
  const passwordHash = await bcrypt.hash(data.password, 4); // 4 rounds en tests = rapido

  return {
    input: data,
    hash: passwordHash,
  };
}

// Factory que inserta en DB real (tests de integracion)
// test/factories/db.factory.ts
import { Pool } from 'pg';

export class DbFactory {
  constructor(private pool: Pool) {}

  async createUser(overrides?: Partial<UserInput>): Promise<User> {
    const data = await createTestUser(overrides);

    const { rows: [user] } = await this.pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [data.input.email, data.input.name, data.hash, data.input.role]
    );

    return user;
  }

  async createMany(count: number): Promise<User[]> {
    const users: User[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.createUser());
    }
    return users;
  }

  async cleanup(): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE email LIKE $1', ['test-%@example.com']);
  }
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb

      - name: E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/testdb
          JWT_SECRET: test-secret-at-least-32-chars-long-for-ci

      - name: Smoke test
        run: bash scripts/smoke-test.sh

      - name: Newman (Postman)
        run: |
          npm run start:test &
          sleep 5
          npx newman run postman/collection.json -e postman/ci.json
```

---

## Resumen: Que usar cuando

| Necesidad | Herramienta |
|---|---|
| Tests E2E Nest.js | Supertest + Jest |
| Tests API con Python | Requests + Pytest |
| Prueba manual rapida | HTTPie o Curl |
| Smoke test en CI | Script bash (1s) |
| GUI para explorar API | Bruno (gratis, archivos en git) |
| CLI para Postman en CI | Newman |
| Tests de carga | k6 (JavaScript) o Artillery (YAML) |
| Mock de API para dev/tests | MSW (frontend), json-server (rapido) |
| Contract testing | Pact |
| Datos de prueba | Factory functions + DB helpers |
