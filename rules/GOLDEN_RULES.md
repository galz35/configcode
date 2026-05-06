# REGLAS DE ORO - Siempre activas

Estas reglas se inyectan automaticamente en cada sesion. Son obligatorias.

## 1. PROHIBIDO ORMs

NUNCA uses TypeORM, Prisma, Sequelize, Drizzle, Knex, Entity Framework ni ningun ORM o query builder.

USA ESTO:
- PostgreSQL en Nest.js → `pg` (node-postgres) con queries parametrizadas: `pool.query('SELECT... WHERE id = $1', [id])`
- SQL Server en Nest.js → `mssql` (node-mssql) con parametros: `request.input('id', sql.Int, id)`
- PostgreSQL en Rust → `sqlx` con bind: `sqlx::query("...").bind(id)`
- SQL Server en Rust → `tiberius` con parametros
- Siempre RETURNING en INSERT/UPDATE: `INSERT INTO users (...) VALUES (...) RETURNING *`
- Preferir stored procedures y funciones PL/pgSQL / T-SQL

## 2. SIEMPRE QUERIES PARAMETRIZADAS

NUNCA concatenes strings del usuario en SQL.
- MAL: `` `SELECT * FROM users WHERE email = '${email}'` ``
- BIEN: `pool.query('SELECT * FROM users WHERE email = $1', [email])`
- Para nombres de tabla/columna dinamicos: whitelist O `QUOTENAME`/`quote_ident`, nunca input directo

## 3. ANTES DE CODIGO → LEER DOCS

Antes de escribir codigo, usa Read para cargar el archivo correspondiente de `.opencode/docs/`:
- React → `.opencode/docs/react/index.md`
- Nest.js → `.opencode/docs/nestjs/index.md`  
- Rust → `.opencode/docs/rust/index.md`
- PostgreSQL → `.opencode/docs/sql-postgres/index.md`
- SQL Server → `.opencode/docs/sql-server/index.md`
- Flutter → `.opencode/docs/flutter/index.md` (mas `.opencode/docs/flutter/packages.md`, `.opencode/docs/flutter/performance.md`, `.opencode/docs/flutter/platform.md`, `.opencode/docs/flutter/testing.md`)
- Testing → `.opencode/docs/testing/index.md`
- Seguridad → `.opencode/docs/security/index.md`

## 4. AGENTES Y COMANDOS DISPONIBLES

Usa `@agent` para invocar subagentes especializados:
- `@frontend-dev` → React/TypeScript (Qwen 3.6)
- `@backend-dev` → NestJS + SQL puro (GLM 5.1)
- `@sql-expert` → PostgreSQL + SQL Server (GLM 5.1)
- `@rust-dev` → Rust + sqlx/tiberius (DeepSeek V4)
- `@flutter-dev` → Flutter/Dart avanzado (DeepSeek V4)
- `@tester` → Unit/integration/e2e (Qwen 3.6)
- `@qa-reviewer` → Code quality + bugs (GLM 5.1)
- `@security-auditor` → OWASP Top 10 (GLM 5.1)
- `@designer` → UI/UX review (MiMo V2 Omni)

Comandos rapidos:
- `/review` → QA completa
- `/secure` → Auditoria de seguridad
- `/sql` → SQL expert mode
- `/test` → Correr tests y analizar
- `/api-test` → Test de API/endpoints
- `/flutter-create` → Crear codigo Flutter
- `/flutter-check` → Analizar y corregir Flutter
- `/design` → UI/UX review

## 5. SEGURIDAD

- NUNCA hardcodear secrets, API keys, passwords en codigo
- NUNCA loguear datos sensibles (passwords, tokens, cookies)
- CORS con whitelist de origenes, nunca `origin: true`
- Rate limiting en endpoints de auth
- bcrypt o argon2 para passwords, minimo salt rounds 12

## 6. SI NO SABES → PREGUNTA

Si dudas sobre una tecnologia o version reciente, PREGUNTAME antes de actuar.
Es mejor confirmar que arreglar despues.

## 7. CARGA EL SKILL DE TU MODELO — OBLIGATORIO

AL INICIO DE CADA SESION, ejecuta `skill("NOMBRE_DEL_MODELO")`. No es opcional.

| Modelo | Comando |
|--------|---------|
| DeepSeek V4 Pro | `skill("deepseek-v4-pro")` |
| DeepSeek V4 Flash | `skill("deepseek-v4-flash")` |
| Qwen 3.6 Plus | `skill("qwen3")` |
| GLM 5.1 | `skill("glm-5")` |
| Kimi K2.6 | `skill("kimi-k2")` |
| MiMo V2 Omni | `skill("mimo-v2-omni")` |

Si no sabes cuál eres, usa el skill que mejor describa tu comportamiento o pregunta. Pero NO continúes sin haberlo cargado.
