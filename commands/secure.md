---
description: Security audit of code or project. Checks OWASP Top 10, SQL injection, auth, secrets.
agent: security-auditor
subtask: true
---

Audita la seguridad del siguiente codigo/proyecto:

$ARGUMENTS

Sigue el checklist OWASP Top 10. Especial atencion a:
- SQL injection (queries parametrizadas)
- Secrets expuestos
- Autenticacion y autorizacion
- CORS y headers de seguridad

Reporta cada hallazgo con severidad (CRITICO/ALTO/MEDIO/BAJO) y solucion.
