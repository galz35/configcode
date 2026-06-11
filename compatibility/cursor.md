# Integración con Cursor

Cursor permite definir reglas globales y locales para guiar al modelo de lenguaje mientras editas el código.

---

## 1. Reglas por Archivo (`.cursorrules`)

Para activar las Reglas de Oro de `configcode` de forma local en tu proyecto abierto con Cursor:

1. Crea una carpeta llamada `.cursor` en la raíz de tu proyecto.
2. Crea una subcarpeta llamada `rules/` (es decir, `.cursor/rules/`).
3. Copia el archivo `rules/GOLDEN_RULES.md` renombrándolo a `.cursor/rules/golden-rules.mdc` o agrégalo directamente como `.cursorrules` en la raíz de tu proyecto.

### Ejemplo de `.cursorrules` recomendado:
```markdown
# Reglas de Proyecto (Cursor)

- Lee siempre el memory-bank/ al iniciar para entender el contexto.
- Queda PROHIBIDO usar ORMs (Prisma, TypeORM, Drizzle, etc.). Escribe consultas parametrizadas directas.
- Sigue las convenciones de Conventional Commits para Git.
- Aplica principios SOLID y Clean Code.
```

---

## 2. Uso de Agentes en Cursor
Puedes invocar las pautas de un agente específico haciendo mención del archivo utilizando el caracter `@` de Cursor en el chat:
- `@backend-dev.md` para consultas de NestJS/Express.
- `@designer.md` para refinar estilos de componentes React/Vite.
- `@sql-expert.md` para optimización de stored procedures.
