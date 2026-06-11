# Guía de Next.js (App Router) y Componentes de Servidor

Esta guía establece los estándares de desarrollo para Next.js utilizando **App Router** (versión 13+ / 14 / 15), priorizando el rendimiento, la optimización SEO y la correcta división entre servidor y cliente.

---

## 1. Arquitectura: Server vs. Client Components

Next.js App Router introduce los React Server Components (RSC). Por defecto, todos los componentes dentro de la carpeta `app/` son Server Components.

### React Server Components (RSC) ✅ (Por defecto)
- **Cuándo usarlos:** Para la estructura de la página, obtención de datos (fetching) directa de base de datos o APIs, procesamiento pesado, y SEO.
- **Beneficios:** Reducen el tamaño del bundle de JS en el cliente (cero JS en el cliente para el componente) y mejoran la carga inicial (FCP).
- **Ejemplo:**
  ```tsx
  // app/usuarios/page.tsx (Server Component por defecto)
  import { queryPg } from "@/lib/db";

  export default async function UsuariosPage() {
    // Fetch directo en el servidor sin useEffect o useState
    const result = await queryPg("SELECT * FROM Usuarios");
    const usuarios = result.rows;

    return (
      <main>
        <h1>Lista de Usuarios</h1>
        <ul>
          {usuarios.map((user) => (
            <li key={user.id}>{user.nombre}</li>
          ))}
        </ul>
      </main>
    );
  }
  ```

### Client Components ⚡ (Con `"use client"`)
- **Cuándo usarlos:** Cuando necesitas interactividad del usuario (clicks, formularios), Hooks de React (`useState`, `useEffect`, `useContext`) o APIs del navegador (geolocalización, localStorage).
- **Regla de Oro:** Mantén los componentes de cliente en las hojas del árbol de componentes (lo más pequeños posible) para no comprometer el rendimiento.
- **Ejemplo:**
  ```tsx
  "use client"; // Obligatorio en la primera línea

  import { useState } from "react";

  export default function CounterButton() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount(count + 1)}>Clicks: {count}</button>;
  }
  ```

---

## 2. Enrutamiento y Colocación (Routing & Colocation)

Next.js utiliza enrutamiento basado en carpetas físicas.

- **`layout.tsx`**: Define la estructura común compartida para una ruta y sus subrutas (preserva el estado en las navegaciones).
- **`page.tsx`**: El contenido único de la ruta accesible públicamente.
- **`loading.tsx`**: Se muestra automáticamente mediante React Suspense mientras el componente `page.tsx` termina de cargar sus promesas de servidor.
- **`error.tsx`**: Maneja errores inesperados en runtime capturando excepciones mediante un Error Boundary en el cliente.

### Estructura típica de ruta:
```text
app/
├── layout.tsx         # Layout raíz (Navbar, Footer, HTML/Body)
├── page.tsx           # Dashboard / Inicio
└── clientes/
    ├── page.tsx       # /clientes
    ├── loading.tsx    # Esqueleto de carga para /clientes
    ├── error.tsx      # Control de fallos para /clientes
    └── [id]/
        └── page.tsx   # /clientes/123 (Ruta dinámica)
```

---

## 3. Obtención y Mutación de Datos (Server Actions)

### Data Fetching
Evita el uso de APIs secundarias para alimentar tus propios componentes de servidor si puedes realizar la consulta directamente.
- **Caching nativo:** Next.js extiende la API `fetch` para cachear peticiones automáticamente.
  - Caching por defecto (Estático): `fetch('url')`
  - Deshabilitar caché (Dinámico): `fetch('url', { cache: 'no-store' })` o `revalidatePath()`
  - Revalidar temporalmente (ISR): `fetch('url', { next: { revalidate: 3600 } })`

### Server Actions (Mutación segura)
Permiten ejecutar funciones asíncronas directamente en el servidor invocadas desde el cliente. Es obligatorio para mutaciones (formularios).

**Ejemplo de Server Action (`app/actions.ts`):**
```typescript
"use server"; // Indica que todo el archivo se ejecuta en el servidor

import { queryPg } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function crearCliente(formData: FormData) {
  const nombre = formData.get("nombre");
  
  // Consulta directa parametrizada
  await queryPg("INSERT INTO Clientes (Nombre) VALUES ($1)", [nombre]);
  
  // Limpia la caché y actualiza la UI
  revalidatePath("/clientes");
}
```

---

## 4. Antipatrones Críticos a Evitar

- **Antipatrón ❌:** Poner `"use client"` en la parte superior del layout raíz (`layout.tsx`). Esto convierte a toda tu aplicación en una SPA tradicional de React, perdiendo las ventajas del App Router.
- **Antipatrón ❌:** Usar `getServerSideProps` o `getStaticProps` dentro de la carpeta `app/`. Estas APIs son exclusivas del antiguo *Pages Router* y fallarán.
- **Antipatrón ❌:** Almacenar secretos en variables de entorno accesibles al cliente (ej: prefijo `NEXT_PUBLIC_`). Los secrets solo deben leerse en Server Components o Server Actions.
