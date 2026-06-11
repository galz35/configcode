# JavaScript — Guía de Referencia Moderna (ES2024+)

## Fundamentos modernos

### Variables y scope
```js
// SIEMPRE usa const por defecto, let solo si reasignas
const API_URL = '/api/v1';
let currentPage = 1;

// NUNCA uses var
// var x = 1; ❌
```

### Destructuring
```js
// Objetos
const { name, email, role = 'user' } = user;

// Arrays
const [first, second, ...rest] = items;

// Parámetros de función
function createUser({ name, email, role = 'user' }) {
  // ...
}

// Nested
const { address: { city, country } } = user;

// Rename
const { name: userName, id: userId } = user;
```

### Template literals
```js
// Strings con variables
const greeting = `Hola ${user.name}, tienes ${count} mensajes`;

// Multiline
const html = `
  <div class="card">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
`;

// Tagged templates (para SQL seguro, CSS-in-JS, etc.)
const query = sql`SELECT * FROM users WHERE id = ${userId}`;
```

### Optional chaining y Nullish coalescing
```js
// Optional chaining — evita errores con null/undefined
const city = user?.address?.city;
const firstItem = arr?.[0];
const result = obj?.method?.();

// Nullish coalescing — solo para null/undefined (no 0, '', false)
const port = config.port ?? 3000;
const name = user.name ?? 'Anónimo';

// Combinados
const theme = user?.settings?.theme ?? 'light';
```

---

## Funciones

### Arrow functions
```js
// Simple
const double = (n) => n * 2;

// Con bloque
const processUser = (user) => {
  const { name, email } = user;
  return { name: name.trim(), email: email.toLowerCase() };
};

// Retornar objeto (necesita paréntesis)
const createUser = (name) => ({ name, createdAt: new Date() });
```

### Default parameters
```js
function fetchData(url, { method = 'GET', headers = {}, timeout = 5000 } = {}) {
  // ...
}
```

### Rest y Spread
```js
// Rest — recoger argumentos
function log(message, ...args) {
  console.log(message, ...args);
}

// Spread — expandir
const merged = { ...defaults, ...userConfig };
const allItems = [...oldItems, ...newItems];
const copy = [...originalArray];
```

---

## Async / Await

### Patrón básico
```js
async function fetchUser(id) {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error; // re-throw para que el caller maneje
  }
}
```

### Paralelo vs Secuencial
```js
// ❌ Secuencial (lento) — cada await espera al anterior
const users = await fetchUsers();
const posts = await fetchPosts();
const comments = await fetchComments();

// ✅ Paralelo (rápido) — todas las peticiones al mismo tiempo
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);

// ✅ Paralelo con tolerancia a fallos
const results = await Promise.allSettled([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);

results.forEach((result) => {
  if (result.status === 'fulfilled') {
    console.log('OK:', result.value);
  } else {
    console.error('Failed:', result.reason);
  }
});
```

### AbortController (cancelar peticiones)
```js
const controller = new AbortController();

// Timeout automático
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request cancelled');
  }
  throw error;
}
```

---

## Arrays — Métodos funcionales

SIEMPRE prefiere métodos funcionales sobre loops imperativos.

```js
const users = [
  { id: 1, name: 'Ana', age: 28, active: true },
  { id: 2, name: 'Ben', age: 35, active: false },
  { id: 3, name: 'Carlos', age: 22, active: true },
];

// map — transformar
const names = users.map((u) => u.name);

// filter — filtrar
const activeUsers = users.filter((u) => u.active);

// find — buscar uno
const ben = users.find((u) => u.name === 'Ben');

// some / every — verificar condición
const hasMinors = users.some((u) => u.age < 18);
const allActive = users.every((u) => u.active);

// reduce — acumular
const totalAge = users.reduce((sum, u) => sum + u.age, 0);

// flatMap — map + flatten
const tags = posts.flatMap((p) => p.tags);

// Sort (CUIDADO: muta el original — usa toSorted)
const sorted = users.toSorted((a, b) => a.age - b.age); // ES2023+
const reversed = users.toReversed(); // ES2023+

// Chaining
const result = users
  .filter((u) => u.active)
  .map((u) => u.name)
  .toSorted();

// groupBy (ES2024)
const grouped = Object.groupBy(users, (u) => u.active ? 'active' : 'inactive');
```

---

## Objetos

```js
// Shorthand properties
const name = 'Ana';
const age = 28;
const user = { name, age }; // { name: 'Ana', age: 28 }

// Computed property names
const key = 'email';
const obj = { [key]: 'ana@mail.com' }; // { email: 'ana@mail.com' }

// Object.entries / Object.fromEntries
const entries = Object.entries(config); // [[key, value], ...]
const filtered = Object.fromEntries(
  entries.filter(([key]) => !key.startsWith('_'))
);

// structuredClone — deep copy (ES2022)
const deepCopy = structuredClone(complexObject);

// Object.hasOwn (ES2022) — reemplaza hasOwnProperty
if (Object.hasOwn(user, 'email')) { /* ... */ }
```

---

## Módulos (ESM)

```js
// Named exports (PREFERIDO)
export const API_URL = '/api/v1';
export function fetchUsers() { /* ... */ }
export class UserService { /* ... */ }

// Named imports
import { API_URL, fetchUsers } from './api.js';

// Default export (solo 1 por archivo — evitar si posible)
export default function App() { /* ... */ }
import App from './App.js';

// Re-export (barrel files)
export { fetchUsers } from './users.js';
export { fetchPosts } from './posts.js';

// Dynamic import (code splitting)
const module = await import('./heavy-feature.js');
module.doSomething();

// Conditional import
if (needsChart) {
  const { Chart } = await import('./chart.js');
}
```

---

## Error Handling

```js
// Custom errors
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

class ValidationError extends AppError {
  constructor(field, message) {
    super(`Validation failed: ${field} - ${message}`, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

// Uso
async function getUser(id) {
  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) throw new NotFoundError('User', id);
  return user;
}
```

---

## Fetch API — Patrones

```js
// Wrapper reutilizable
async function api(endpoint, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) config.body = JSON.stringify(body);

  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/v1${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new AppError(error.message || `HTTP ${response.status}`, error.code, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Uso
const users = await api('/users');
const user = await api('/users', { method: 'POST', body: { name, email } });
await api(`/users/${id}`, { method: 'DELETE' });
```

---

## localStorage / sessionStorage — Wrapper seguro

```js
const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('localStorage full or unavailable:', error);
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clear() {
    localStorage.clear();
  },
};
```

---

## Patterns comunes

### Debounce
```js
function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Uso: búsqueda en tiempo real
const handleSearch = debounce((query) => {
  fetchResults(query);
}, 300);
```

### Throttle
```js
function throttle(fn, limit = 100) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// Uso: scroll handler
window.addEventListener('scroll', throttle(handleScroll, 100));
```

### Event delegation
```js
// ✅ Un solo listener para muchos elementos
document.querySelector('.list').addEventListener('click', (e) => {
  const item = e.target.closest('[data-action]');
  if (!item) return;

  const action = item.dataset.action;
  const id = item.dataset.id;

  switch (action) {
    case 'edit': editItem(id); break;
    case 'delete': deleteItem(id); break;
  }
});
```

---

## Anti-patrones (NUNCA hagas esto)

```js
// ❌ Callbacks anidados (callback hell)
getData(function(a) {
  getMore(a, function(b) {
    andMore(b, function(c) { /**/ });
  });
});

// ✅ async/await
const a = await getData();
const b = await getMore(a);
const c = await andMore(b);

// ❌ == (comparación débil)
if (x == null) {}  // true para null Y undefined

// ✅ === (comparación estricta)
if (x === null || x === undefined) {}
// o mejor:
if (x == null) {} // esta es la ÚNICA excepción válida para ==

// ❌ for...in para arrays
for (const i in array) {} // incluye propiedades heredadas

// ✅ for...of o métodos funcionales
for (const item of array) {}
array.forEach((item) => {});

// ❌ Mutar parámetros
function addItem(list, item) {
  list.push(item); // muta el original
  return list;
}

// ✅ Inmutabilidad
function addItem(list, item) {
  return [...list, item]; // nuevo array
}

// ❌ console.log en producción
console.log('DEBUG:', data);

// ✅ Logging estructurado
logger.info('User created', { userId: user.id, action: 'create' });
```

---

## Performance

- Usa `requestAnimationFrame` para animaciones DOM
- Usa `IntersectionObserver` para lazy loading (no scroll events)
- Usa `AbortController` para cancelar fetch en cleanup
- Prefiere `Map` y `Set` sobre objetos/arrays para lookups frecuentes
- Usa `WeakMap`/`WeakRef` para evitar memory leaks en caches
- Usa `structuredClone` en vez de `JSON.parse(JSON.stringify(x))`
- Code splitting con `import()` dinámico para reducir bundle inicial
