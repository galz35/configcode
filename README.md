# configcode — Framework Universal para Agentes IA de Código

> Configuración reutilizable que hace que cualquier agente IA (OpenCode, Cursor, Cline, Gemini, Claude) trabaje con calidad profesional en cualquier proyecto.

## 🚀 Inicio rápido

1. Clona este repo en tu proyecto o como submódulo:
   ```bash
   git clone https://github.com/galz35/configcode.git .opencode
   ```

2. Copia el memory-bank a tu proyecto y llénalo:
   ```bash
   cp -r .opencode/memory-bank/ ./memory-bank/
   ```

3. El agente IA leerá automáticamente las reglas, docs y contexto.

## 📁 Estructura

| Ruta | Propósito |
|------|-----------|
| `rules/GOLDEN_RULES.md` | Reglas obligatorias: SQL puro, seguridad, convenciones, logging |
| `agents/*.md` | Subagentes especializados (`@backend-dev`, `@flutter-dev`, `@frontend-dev`, etc.) |
| `commands/*.md` | Comandos slash (`/review`, `/test`, `/scaffold`, `/deploy`, etc.) |
| `docs/**/*.md` | Guías de referencia por tecnología (React, NestJS, Flutter, CSS, JS, UX, SQL, etc.) |
| `tools/*.ts` | Herramientas de validación automática (nestjs-check, flutter-check, security-check) |
| `memory-bank/` | Templates de contexto persistente para que el agente entienda tu proyecto |
| `templates/` | Scaffolding de proyectos nuevos (Express API, React+Vite, Flutter) |
| `compatibility/` | Guías para usar configcode en diferentes IDEs |
| `optional/` | Extensiones opcionales (Rust, Skills por modelo) |

## 🤖 Agentes disponibles

| Agente | Especialidad |
|--------|-------------|
| `@backend-dev` | Express/NestJS/Next.js + SQL puro (pg/mssql) |
| `@frontend-dev` | React/Next.js + TypeScript + Vite |
| `@flutter-dev` | Flutter/Dart + Riverpod |
| `@sql-expert` | PostgreSQL + SQL Server |
| `@designer` | UI/UX review + accesibilidad |
| `@tester` | Unit, integration, E2E testing |
| `@qa-reviewer` | Code review + bugs + seguridad |
| `@security-auditor` | OWASP Top 10 + auditoría |
| `@devops-engineer` | Docker, CI/CD, deploy |
| `@architect` | Diseño de sistemas y arquitectura |

## ⚡ Comandos rápidos

| Comando | Acción |
|---------|--------|
| `/review` | QA completa del código |
| `/secure` | Auditoría de seguridad |
| `/test` | Correr y analizar tests |
| `/scaffold` | Generar estructura de proyecto nuevo |
| `/deploy` | Generar pipeline CI/CD |
| `/docker` | Generar Dockerfile + docker-compose |
| `/design` | Revisión UI/UX |
| `/flutter-create` | Crear código Flutter |
| `/flutter-check` | Analizar y corregir Flutter |
| `/sql` | SQL expert mode |
| `/api-test` | Test de API/endpoints |
| `/memory-update` | Actualizar Memory Bank |

## 📚 Documentación técnica

| Tecnología | Docs |
|------------|------|
| React | `docs/react/` — Patrones, paquetes, performance |
| Next.js | `docs/nextjs/` — App Router, Server Actions, Rendering, SEO |
| CSS | `docs/css/` — Metodologías, responsive, animaciones, dark mode |
| JavaScript | `docs/javascript/` — ES2024+, async, módulos, performance |
| UX Design | `docs/ux-design/` — Proceso, principios, accesibilidad, sistemas de diseño |
| NestJS | `docs/nestjs/` — Módulos, guards, SQL puro |
| Flutter | `docs/flutter/` — Widgets, estado, platform, performance, testing |
| SQL Server | `docs/sql-server/` — Queries, SPs, optimización, patrones avanzados |
| PostgreSQL | `docs/sql-postgres/` — Queries, PL/pgSQL, RLS, FTS |
| Security | `docs/security/` — OWASP, auth, encryption, headers |
| Testing | `docs/testing/` — Unit, integration, E2E, load testing |
| DevOps | `docs/devops/` — Docker, CI/CD, deploy, monitoreo |
| Git | `docs/git/` — Convenciones, branching, hooks |

## 🔧 Flujo de trabajo

```
1. Lee memory-bank/     → Entiende el proyecto
2. Lee rules/           → Conoce las reglas obligatorias
3. Lee docs/            → Carga conocimiento técnico
4. Ejecuta la tarea     → Planea → Ejecuta → Valida
5. Actualiza memory-bank → Registra el progreso
```

## 📦 Versionado

- **v2.0.0** — Framework universal, Memory Bank, docs expandidos, multi-IDE
- **v1.0.0** — Versión inicial con agentes, reglas y docs base
