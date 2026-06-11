# Plantilla Next.js (App Router + SQL Server/PostgreSQL sin ORM)

Esta plantilla proporciona la estructura inicial para una aplicación web con Next.js 14+ utilizando App Router, TypeScript, validaciones seguras con Zod y consultas SQL puras parametrizadas.

## 📁 Estructura del Proyecto

```
app/
  globals.css          # Estilos CSS globales
  layout.tsx           # Layout base (Layout raíz)
  page.tsx             # Página principal
  actions.ts           # Acciones del servidor (Server Actions) con validación
lib/
  db.ts                # Conexiones nativas y seguras a base de datos
package.json
tsconfig.json
next.config.mjs
```

## ⚡ Reglas clave de desarrollo en Next.js

1. **Server Components por defecto:** Todos los componentes dentro de `app/` son Server Components. Usa interactividad (`"use client"`) únicamente en los archivos hoja donde sea necesario.
2. **Acciones del Servidor (`use server`):** Realiza mutaciones y lógica de negocio del lado del servidor de forma directa y limpia, eliminando la necesidad de crear APIs `/api/...` internas.
3. **Seguridad SQL:** Queda estrictamente prohibido usar ORMs. Usa consultas parametrizadas puras y el driver nativo provisto en `lib/db.ts`.
4. **Validaciones en el Servidor:** Valida siempre los datos recibidos del cliente utilizando `Zod` antes de procesar cualquier consulta a la base de datos.
