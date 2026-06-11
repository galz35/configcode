# Memory Bank — Contexto Persistente del Proyecto

El Memory Bank es un sistema de archivos que le da al agente IA **contexto completo** de tu proyecto sin que tengas que explicarle todo cada vez.

## Cómo funciona

1. **Copia** esta carpeta `memory-bank/` a la raíz de tu proyecto
2. **Llena** cada archivo con la información de tu proyecto
3. El agente IA **lee estos archivos al inicio** de cada sesión

## Archivos

| Archivo | Propósito | Cuándo actualizar |
|---------|-----------|-------------------|
| `projectbrief.md` | Qué es el proyecto, para quién, por qué existe | Al inicio. Rara vez cambia |
| `techContext.md` | Stack, frameworks, versiones, dependencias | Cuando agregas/cambias tecnología |
| `systemPatterns.md` | Arquitectura, patrones, estructura de carpetas | Cuando refactorizas o cambias la arquitectura |
| `activeContext.md` | En qué estás trabajando ahora, blockers | Al inicio de cada sesión de trabajo |
| `progress.md` | Qué está hecho, qué falta | Al finalizar cada tarea |

## Regla de oro

- **NUNCA** guardes secrets, API keys o passwords aquí
- **SIEMPRE** actualiza `progress.md` cuando completes algo
- **SIEMPRE** actualiza `activeContext.md` al empezar a trabajar
