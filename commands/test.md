---
description: Run tests and analyze failures. Fixes only test code, never production code.
agent: tester
subtask: true
---

Ejecuta los tests del proyecto y analiza los resultados:

!`npm test 2>&1 || true`

Para cada test fallido:
1. Explica por que falla
2. Si es un bug en el test, sugiere la correccion (SOLO en el test, no en produccion)
3. Si es un bug en produccion, reportalo pero NO lo arregles

NO modifiques codigo de produccion. Solo sugerencias.
