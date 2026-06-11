# Integración Automática con Cursor

Cursor soporta un sistema nativo e inteligente de reglas basadas en archivos `.mdc` dentro de la carpeta `.cursor/rules/`.

---

## 1. Instalación Rápida

Para activar todas las reglas del framework en tu proyecto de destino abierto con Cursor, simplemente copia la carpeta `.cursor` a la raíz de tu proyecto:

```bash
# Copia la carpeta de reglas de Cursor a tu proyecto de destino
cp -r .opencode/.cursor/ ./
```

Una vez copiado, Cursor aplicará automáticamente las reglas según el archivo que estés editando:
- **`golden-rules.mdc`**: Se aplica siempre (`alwaysApply: true`) a cualquier archivo e interacción de chat.
- **`backend.mdc`**: Se activa automáticamente al editar archivos TypeScript de backend (`src/**/*.ts`).
- **`frontend.mdc`**: Se activa automáticamente al editar componentes o estilos de frontend (`src/**/*.tsx`, `src/**/*.css`).
- **`flutter.mdc`**: Se activa automáticamente al editar archivos Dart (`lib/**/*.dart`).
- **`sql.mdc`**: Se activa automáticamente al editar scripts SQL (`**/*.sql`).

---

## 2. Invocación de Agentes y Docs
Puedes hacer referencia explícita a las guías o agentes utilizando el comando `@` de Cursor en el chat del editor:
- Usa `@backend-dev.md` para indicarle al chat que adopte el rol de backend.
- Usa `@solid.md` para exigir el cumplimiento del diseño de código limpio en una refactorización.
- Usa `@advanced.md` (de SQL Server) al optimizar un stored procedure específico.
