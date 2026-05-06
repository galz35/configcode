# Inicio obligatorio — Léeme primero

Cada sesión en este proyecto DEBE seguir este flujo:

## 1. Identifica qué modelo eres

| Eres este modelo | Ejecuta este comando |
|-----------------|---------------------|
| DeepSeek V4 Pro | `skill("deepseek-v4-pro")` |
| DeepSeek V4 Flash | `skill("deepseek-v4-flash")` |
| Qwen 3.6 Plus | `skill("qwen3")` |
| GLM 5.1 | `skill("glm-5")` |
| Kimi K2.6 | `skill("kimi-k2")` |
| MiMo V2 Omni | `skill("mimo-v2-omni")` |

Si no sabes cuál eres, ejecuta el que creas correcto o pregunta.

## 2. Lee las reglas obligatorias

```
.opencode/rules/GOLDEN_RULES.md
```

## 3. Lee los docs técnicos relevantes

Antes de escribir código en X tecnología, lee `.opencode/docs/X/`:

- Flutter → `.opencode/docs/flutter/`
- NestJS → `.opencode/docs/nestjs/`
- PostgreSQL → `.opencode/docs/sql-postgres/`
- React → `.opencode/docs/react/`
- SQL Server → `.opencode/docs/sql-server/`
- Seguridad → `.opencode/docs/security/`
- Testing → `.opencode/docs/testing/`

## 4. Al finalizar, valida

| Proyecto | Comando |
|----------|---------|
| Backend (NestJS) | `npx tsc --noEmit` |
| Flutter | `flutter analyze lib/` |

## 5. Para tareas complejas

Usa los subagentes de `.opencode/agents/` invocándolos con `@agent` + nombre:
- `@flutter-dev` → Flutter/Dart avanzado
- `@backend-dev` → NestJS + SQL puro
- `@sql-expert` → PostgreSQL + SQL Server
- `@tester` → Testing
- `@security-auditor` → Seguridad
- `@designer` → UI/UX
- `@qa-reviewer` → Code review
