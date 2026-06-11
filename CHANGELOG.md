# Changelog

## [2.0.0] - 2026-06-11

### Añadido
- **Memory Bank**: Sistema de contexto persistente (`memory-bank/`)
- **Docs nuevos**: Next.js (App Router, Server Actions, SEO), CSS, JavaScript, UX Design, DevOps, Docker, Git, SQL Server avanzado, Security avanzado
- **Agentes nuevos**: `@devops-engineer`, `@architect`
- **Comandos nuevos**: `/scaffold`, `/docker`, `/deploy`, `/memory-update`
- **Tools nuevos**: `security-check.ts`, `project-info.ts`
- **Templates**: Scaffolding para Express API, React+Vite, Flutter
- **Multi-IDE**: Compatibilidad con Cursor, Cline, Gemini
- **Reglas v2**: Git conventions, error handling, logging, documentación

### Modificado
- README.md reescrito como framework universal (ya no atado a proyecto específico)
- INIT.md universal (ya no atado a modelos específicos)
- Todos los agentes existentes mejorados con más contexto y referencias
- GOLDEN_RULES.md expandido con 5 nuevas secciones
- `docs/nestjs/index.md` reescrito para eliminar referencias a ORMs y enfocarlo 100% a SQL Server (mssql) y PostgreSQL (pg) nativo con pools y transacciones puras.

### Movido a `optional/`
- Rust (agent, docs, tool) → `optional/rust/`
- Skills por modelo (deepseek, qwen, glm, kimi, mimo) → `optional/skills/`

## [1.0.0] - 2026-06-01

### Añadido
- Versión inicial con 9 agentes, 8 comandos, 4 tools
- Documentación técnica: React, NestJS, Flutter, Rust, SQL, Security, Testing
- GOLDEN_RULES.md con reglas base
- Skills por modelo de IA
