---
description: Run tests and analyze failures. Fixes only test code, never production code.
agent: tester
subtask: true
---

Ejecuta los tests del proyecto y analiza los resultados.
Si es un proyecto Node.js, ejecuta: `npm test` o `npm run test`
Si es un proyecto Flutter, ejecuta: `flutter test`
Si es un proyecto Rust, ejecuta: `cargo test`

Para cada test fallido:
1. Explica por qué falla.
2. Si es un bug en el test, sugiere la corrección (SOLO en el test, no en producción).
3. Si es un bug en producción, repórtalo pero NO lo arregles.

NO modifiques código de producción. Solo sugerencias.
