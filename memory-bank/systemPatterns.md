# System Patterns — Configcode v2

## Estructura del Framework

El repositorio se organiza bajo el siguiente patrón de directorios:

```text
configcode/
├── rules/             # Reglas de oro globales
├── agents/            # Definiciones de agentes especializados (Markdown con front-matter)
├── commands/          # Comandos rápidos ejecutables por la IA
├── docs/              # Guías de documentación por tecnología
├── tools/             # Scripts TypeScript de validación automática
├── templates/         # Estructuras base para iniciar proyectos
├── compatibility/     # Guías de configuración para Cursor, Cline y Gemini
└── memory-bank/       # Plantillas de contexto de proyecto
```

## Convenciones de Desarrollo
1. **Reglas de Oro:** Todas las directrices son mandatorias. El desarrollo prohíbe el uso de ORMs y exige consultas parametrizadas.
2. **Documentación:** Toda guía técnica nueva debe incluir explicaciones de patrones y antipatrones con código real de ejemplo.
3. **Agentes:** Los agentes de IA se declaran con metadatos YAML en su cabecera (front-matter) para indicar su temperatura y permisos recomendados.
