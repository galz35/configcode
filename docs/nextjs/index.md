# Guía Completa de Next.js (App Router)

Referencia técnica avanzada para Next.js con **App Router** (v14 / v15+). Cubre arquitectura de renderizado, obtención de datos, optimización de rendimiento, SEO, middleware, patrones avanzados y antipatrones críticos.

---

## 1. Arquitectura: Server vs. Client Components

Next.js App Router introduce los React Server Components (RSC). **Por defecto, todos los componentes dentro de `app/` son Server Components.**

### React Server Components (RSC) ✅ — Usar por defecto
- Se ejecutan **exclusivamente** en el servidor. No envían JavaScript al navegador.
- Pueden acceder directamente a bases de datos, APIs internas y secrets del entorno.
- Mejoran drásticamente el Largest Contentful Paint (LCP) y reducen el Time to Interactive (TTI).

```tsx
// app/solicitudes/page.tsx — Server Component (por defecto, sin directiva)
import { queryMssql } from "@/lib/db";
import sql from "mssql";

// Metadata SEO dinámica (solo posible en Server Components)
export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: "Solicitudes de Empleo",
    description: "Panel de gestión de solicitudes activas",
  };
}

export default async function SolicitudesPage() {
  // Consulta directa parametrizada — cero useEffect, cero useState
  const result = await queryMssql(
    "SELECT TOP 50 s.*, p.Nombre FROM Solicitudes s JOIN Postulantes p ON s.PostulanteID = p.ID ORDER BY s.FechaCreacion DESC",
    []
  );

  return (
    <main>
      <h1>Solicitudes Recientes</h1>
      <table>
        <thead>
          <tr><th>ID</th><th>Postulante</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {result.recordset.map((row: any) => (
            <tr key={row.SolicitudID}>
              <td>{row.SolicitudID}</td>
              <td>{row.Nombre}</td>
              <td>{new Date(row.FechaCreacion).toLocaleDateString("es-HN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

### Client Components ⚡ — Solo cuando es estrictamente necesario
Agrega `"use client"` **únicamente** cuando necesites:
- Hooks de React (`useState`, `useEffect`, `useRef`, `useContext`).
- Event handlers del DOM (`onClick`, `onChange`, `onSubmit`).
- APIs del navegador (`window`, `document`, `localStorage`, `geolocation`).

**Regla de Oro:** Los Client Components deben ser las **hojas** del árbol de componentes. Nunca conviertas un layout o una página entera en Client Component.

```tsx
"use client"; // Componente pequeño y específico

import { useState, useTransition } from "react";
import { eliminarSolicitud } from "@/app/actions";

interface Props {
  solicitudId: number;
}

export function BotonEliminar({ solicitudId }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await eliminarSolicitud(solicitudId);
    });
  };

  return (
    <button onClick={handleClick} disabled={isPending} aria-busy={isPending}>
      {isPending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
```

---

## 2. Enrutamiento, Colocación y Archivos Especiales

Next.js utiliza enrutamiento basado en carpetas físicas dentro de `app/`.

### Archivos especiales de ruta

| Archivo | Función | ¿Es Server o Client? |
|:---|:---|:---|
| `layout.tsx` | Estructura compartida que preserva estado entre navegaciones. | Server (por defecto) |
| `page.tsx` | Contenido único de la ruta. Es lo que hace la URL accesible. | Server (por defecto) |
| `loading.tsx` | Esqueleto de carga automático (se integra con `<Suspense>`). | Server |
| `error.tsx` | Error Boundary para la ruta. Captura errores en runtime. | **Client** (`"use client"` obligatorio) |
| `not-found.tsx` | Pantalla de 404 personalizada para la ruta. | Server |
| `template.tsx` | Como layout pero **no preserva estado** (recrea instancia en cada navegación). | Server |

### Estructura profesional de proyecto
```text
app/
├── layout.tsx               # Layout raíz (HTML, Body, Navbar, Footer, Providers)
├── page.tsx                 # Página de inicio /
├── loading.tsx              # Skeleton global
├── not-found.tsx            # 404 global
├── error.tsx                # Error boundary global ("use client")
├── globals.css              # Estilos globales con design tokens HSL
│
├── (auth)/                  # Route Group (sin afectar la URL)
│   ├── login/page.tsx       # /login
│   └── registro/page.tsx    # /registro
│
├── dashboard/
│   ├── layout.tsx           # Layout con sidebar exclusivo del dashboard
│   ├── page.tsx             # /dashboard
│   └── solicitudes/
│       ├── page.tsx         # /dashboard/solicitudes
│       ├── loading.tsx      # Skeleton para solicitudes
│       └── [id]/
│           ├── page.tsx     # /dashboard/solicitudes/123
│           └── not-found.tsx
│
├── api/                     # Route Handlers (endpoints REST)
│   └── health/route.ts      # GET /api/health
│
└── actions.ts               # Server Actions centralizados
```

### Route Groups `(nombre)`
Los paréntesis **no generan segmentos de URL**. Sirven para agrupar lógicamente rutas que comparten un layout sin que afecte la ruta pública (ej: `(auth)` agrupa login y registro bajo un layout sin navbar).

### Rutas Dinámicas
| Patrón | Ejemplo de URL | Acceso al parámetro |
|:---|:---|:---|
| `[id]` | `/solicitudes/42` | `params.id` → `"42"` |
| `[...slug]` | `/docs/a/b/c` | `params.slug` → `["a","b","c"]` |
| `[[...slug]]` | `/docs` o `/docs/a/b` | Opcional (puede ser `undefined`) |

---

## 3. Obtención de Datos (Data Fetching)

### Principio fundamental
En App Router, **nunca crees un endpoint API solo para alimentar tus propios Server Components**. Realiza la consulta directamente en el componente de servidor.

### Estrategias de Caché en `fetch()`

| Estrategia | Código | Cuándo usarla |
|:---|:---|:---|
| **Estático** (ISG) | `fetch('url')` | Datos que rara vez cambian (catálogos, configuración). |
| **ISR** (Revalidación) | `fetch('url', { next: { revalidate: 3600 } })` | Datos que cambian cada cierto tiempo (lista de empleados). |
| **Dinámico** (SSR) | `fetch('url', { cache: 'no-store' })` | Datos en tiempo real (solicitudes activas, estados). |

### Streaming con `<Suspense>` (Carga progresiva)
No bloquees la renderización completa de la página por un componente lento. Envuelve los componentes que consultan datos lentos en `<Suspense>` para que el resto de la página se envíe inmediatamente al navegador.

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { TablaReportes } from "@/components/tabla-reportes"; // Server Component lento
import { SkeletonTabla } from "@/components/skeleton-tabla";

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      
      {/* La cabecera aparece de inmediato */}
      <section>
        <p>Bienvenido al panel de control.</p>
      </section>

      {/* La tabla se renderiza cuando los datos estén listos */}
      <Suspense fallback={<SkeletonTabla filas={5} columnas={4} />}>
        <TablaReportes />
      </Suspense>
    </main>
  );
}
```

---

## 4. Mutación de Datos: Server Actions

Las Server Actions son funciones asíncronas que se ejecutan en el servidor, invocadas directamente desde formularios o botones del cliente. Eliminan la necesidad de crear endpoints REST manuales para operaciones CRUD.

```typescript
// app/actions.ts
"use server";

import { queryMssql } from "@/lib/db";
import sql from "mssql";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Esquema de validación con Zod (siempre validar inputs del lado del servidor)
const SolicitudSchema = z.object({
  postulante: z.string().min(2, "Nombre muy corto").max(100),
  puesto: z.string().min(2).max(150),
  salario: z.coerce.number().positive("Salario debe ser positivo"),
});

export async function crearSolicitud(formData: FormData) {
  // 1. Validar inputs (nunca confiar en el cliente)
  const parsed = SolicitudSchema.safeParse({
    postulante: formData.get("postulante"),
    puesto: formData.get("puesto"),
    salario: formData.get("salario"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // 2. Consulta SQL parametrizada directa (NUNCA concatenar)
  await queryMssql(
    "INSERT INTO Solicitudes (Postulante, Puesto, SalarioPretencion) VALUES (@postulante, @puesto, @salario)",
    [
      { name: "postulante", type: sql.VarChar, value: parsed.data.postulante },
      { name: "puesto", type: sql.VarChar, value: parsed.data.puesto },
      { name: "salario", type: sql.Decimal, value: parsed.data.salario },
    ]
  );

  // 3. Refrescar la caché de la página afectada y redirigir
  revalidatePath("/dashboard/solicitudes");
  redirect("/dashboard/solicitudes");
}

export async function eliminarSolicitud(id: number) {
  await queryMssql("DELETE FROM Solicitudes WHERE SolicitudID = @id", [
    { name: "id", type: sql.Int, value: id },
  ]);
  revalidatePath("/dashboard/solicitudes");
}
```

---

## 5. Optimización de Rendimiento (Performance)

### Imágenes — `next/image`
- Usa siempre `<Image>` de `next/image` en lugar de `<img>` nativo.
- **LCP:** Agrega la prop `priority` a imágenes que aparecen above the fold (hero banners, logos principales).
- **CLS:** Define siempre `width` y `height` explícitos, o usa `fill` con un contenedor de posición relativa.
- Next.js sirve automáticamente formatos WebP/AVIF optimizados según el navegador.

```tsx
import Image from "next/image";

<Image
  src="/hero-banner.jpg"
  alt="Banner de bienvenida"
  width={1200}
  height={600}
  priority  // Precarga inmediata para mejorar LCP
  className="rounded-lg"
/>
```

### Fuentes — `next/font`
- Usa `next/font/google` para autoalojar fuentes de Google durante el build (cero peticiones externas en runtime).
- Activa `display: 'swap'` para que el texto sea visible mientras la fuente termina de cargar.

```tsx
// app/layout.tsx
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
```

### Carga Dinámica — `next/dynamic`
Para componentes pesados que no son críticos en la carga inicial (como editores de texto, gráficas, mapas).

```tsx
import dynamic from "next/dynamic";

const EditorRichText = dynamic(() => import("@/components/editor-rich-text"), {
  loading: () => <p>Cargando editor...</p>,
  ssr: false, // Solo renderizar en el cliente
});
```

---

## 6. Middleware (Lógica en el Edge)

El middleware se ejecuta **antes** de que la solicitud llegue a tu Server Component o Route Handler. Es ideal para tareas ligeras como autenticación, redirecciones y A/B testing.

```typescript
// middleware.ts (raíz del proyecto)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;

  // Proteger rutas del dashboard
  if (request.nextUrl.pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Solo ejecutar en estas rutas (no en archivos estáticos ni APIs públicas)
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
```

---

## 7. SEO y Metadata API

### Metadata Estática
```tsx
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.dominio.com"),
  title: {
    default: "Mi Aplicación",
    template: "%s | Mi Aplicación", // Plantilla automática para sub-páginas
  },
  description: "Sistema de gestión de solicitudes de empleo",
  openGraph: {
    type: "website",
    locale: "es_HN",
    siteName: "Mi Aplicación",
  },
};
```

### Metadata Dinámica (Páginas de detalle)
```tsx
// app/solicitudes/[id]/page.tsx
export async function generateMetadata({ params }: { params: { id: string } }) {
  const solicitud = await obtenerSolicitud(params.id);
  
  return {
    title: `Solicitud #${solicitud.id} — ${solicitud.puesto}`,
    description: `Solicitud de ${solicitud.postulante} para el puesto de ${solicitud.puesto}`,
  };
}
```

### Archivos SEO automáticos
- **`sitemap.ts`**: Genera `/sitemap.xml` dinámicamente a partir de tus rutas.
- **`robots.ts`**: Genera `/robots.txt` con las reglas para crawlers.
- **`opengraph-image.tsx`**: Genera imágenes de Open Graph dinámicas con JSX.

---

## 8. Route Handlers (API Endpoints)

Para endpoints que consumen terceros externos (webhooks, integraciones, APIs públicas).

```typescript
// app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}

// Ejemplo POST con validación
export async function POST(request: Request) {
  const body = await request.json();
  
  // Validar con Zod antes de procesar
  // ... lógica de negocio ...
  
  return NextResponse.json({ success: true }, { status: 201 });
}
```

---

## 9. Antipatrones Críticos a Evitar

| Antipatrón ❌ | Corrección ✅ |
|:---|:---|
| Poner `"use client"` en `layout.tsx` raíz | Convierte todo en SPA. Mantén layouts como Server Components. |
| Usar `getServerSideProps` / `getStaticProps` | APIs del Pages Router. Usa `async/await` directamente en el componente. |
| Crear un endpoint `/api/datos` para consumirlo desde tu propio Server Component | Consulta directamente en el Server Component. |
| Guardar secrets con prefijo `NEXT_PUBLIC_` | Solo lectura en Server Components o Server Actions. |
| Fetch en `useEffect` para datos iniciales | Usa Server Components o `<Suspense>` con streaming. |
| Un solo `loading.tsx` global para toda la app | Crea `loading.tsx` granulares en cada segmento de ruta para experiencia más fluida. |
| No validar inputs en Server Actions | Siempre valida con Zod en el servidor aunque el cliente valide también. |
