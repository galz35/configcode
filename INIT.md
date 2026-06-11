# Inicio obligatorio — Léeme primero

Cada sesión en cualquier proyecto DEBE seguir este flujo:

## 1. Lee el contexto del proyecto

Si existe un directorio `memory-bank/` en la raíz del proyecto, léelo completo:
- `memory-bank/projectbrief.md` — Qué es el proyecto
- `memory-bank/techContext.md` — Stack técnico
- `memory-bank/systemPatterns.md` — Arquitectura y patrones
- `memory-bank/activeContext.md` — En qué se está trabajando
- `memory-bank/progress.md` — Qué está hecho y qué falta

## 2. Lee las reglas obligatorias

```
.opencode/rules/GOLDEN_RULES.md
```

Estas reglas son **inquebrantables**. Se aplican en cada sesión, cada proyecto.

## 3. Lee los docs técnicos relevantes

Antes de escribir código en X tecnología, lee `.opencode/docs/X/`:

| Tecnología | Docs |
|------------|------|
| React | `.opencode/docs/react/` |
| CSS | `.opencode/docs/css/` |
| JavaScript | `.opencode/docs/javascript/` |
| UX/Diseño | `.opencode/docs/ux-design/` |
| NestJS/Express | `.opencode/docs/nestjs/` |
| Flutter | `.opencode/docs/flutter/` |
| PostgreSQL | `.opencode/docs/sql-postgres/` |
| SQL Server | `.opencode/docs/sql-server/` |
| Seguridad | `.opencode/docs/security/` |
| Testing | `.opencode/docs/testing/` |
| DevOps | `.opencode/docs/devops/` |
| Git | `.opencode/docs/git/` |

## 4. Al finalizar, valida

| Proyecto | Comando |
|----------|---------|
| Backend (NestJS/Express) | `npx tsc --noEmit` |
| Frontend (React+Vite) | `npx tsc --noEmit` |
| Flutter | `flutter analyze lib/` |

## 5. Actualiza el Memory Bank

Después de completar la tarea, actualiza:
- `memory-bank/activeContext.md` con el trabajo realizado
- `memory-bank/progress.md` con el estado actual

## 6. Para tareas complejas

Lee `.opencode/docs/complex-tasks.md` y sigue el protocolo:
1. Planear primero (sin código)
2. Dividir en pasos atómicos
3. Validar cada paso antes de avanzar

Usa los subagentes de `.opencode/agents/` invocándolos con `@agent` + nombre:
- `@frontend-dev` → React/TypeScript
- `@backend-dev` → NestJS/Express + SQL puro
- `@sql-expert` → PostgreSQL + SQL Server
- `@flutter-dev` → Flutter/Dart
- `@tester` → Testing
- `@security-auditor` → Seguridad
- `@designer` → UI/UX
- `@qa-reviewer` → Code review
- `@devops-engineer` → Docker, CI/CD, deploy
- `@architect` → Diseño de sistemas
