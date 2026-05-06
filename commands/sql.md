---
description: SQL expert mode - optimize queries, create procedures, design schema
agent: sql-expert
subtask: true
---

$ARGUMENTS

IMPORTANTE: Usa SQL PURO (nunca ORMs). Queries parametrizadas. Si es PostgreSQL usa $1, $2; si es SQL Server usa @param.

Si necesitas crear/modificar tablas o procedimientos, genera migraciones idempotentes (IF NOT EXISTS).
