---
description: Run flutter analyze and fix any issues in the codebase
agent: flutter-dev
subtask: true
---

Ejecuta flutter analyze en el proyecto:

!`flutter analyze`

Para cada warning/error encontrado:
1. Lee el archivo problematico
2. Corrige el issue basado en los patrones de `.opencode/docs/flutter/`
3. Re-ejecuta analyze para verificar que se corrigio

Tambien verifica:
- `flutter test` si hay tests
- `dart format --set-exit-if-changed lib/ test/` para formateo

Reporta que issues se encontraron y como se corrigieron.
