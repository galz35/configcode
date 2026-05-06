# .opencode — Configuración del agente GymPro

Este directorio contiene todo lo necesario para que el agente AI trabaje correctamente en este proyecto.

## Estructura

| Ruta | Propósito |
|------|-----------|
| `rules/GOLDEN_RULES.md` | Reglas obligatorias: SQL puro, queries parametrizadas, leer docs primero |
| `agents/*.md` | Perfiles de subagentes especializados (`@backend-dev`, `@flutter-dev`, etc.) |
| `commands/*.md` | Comandos slash (`/review`, `/flutter-check`, `/test`, etc.) |
| `skills/*/SKILL.md` | Perfiles de habilidad por modelo (deepseek-v4-pro, deepseek-v4-flash, etc.) |
| `tools/*.ts` | Herramientas de validación (nestjs-check, flutter-check) |
| `docs/**/*.md` | Guías de referencia por tecnología (flutter, nestjs, sql, security) |

## Cómo usar este proyecto

El agente DEBE seguir este flujo:

1. **Cargar skill** — `skill("deepseek-v4-flash")`
2. **Leer reglas** — `.opencode/rules/GOLDEN_RULES.md`
3. **Leer docs técnicos** — según la tarea (`.opencode/docs/flutter/`, `.opencode/docs/nestjs/`, etc.)
4. **Usar tools de validación** — `nestjs-check`, `flutter-check` al finalizar
5. **Usar subagentes** — `@flutter-dev`, `@backend-dev`, `@sql-expert` para tareas complejas
