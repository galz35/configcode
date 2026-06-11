# REGLAS DE ORO — Versión 2.0 (Siempre Activas)

Estas reglas definen los estándares obligatorios de desarrollo para cualquier Agente de IA o desarrollador interactuando con este repositorio. Son independientes del IDE (funcionan en OpenCode, Cursor, Cline, Gemini, Antigravity, etc.).

---

## 1. SISTEMA DE CONTEXTO: MEMORY BANK
- **Obligatorio:** Al inicio de cada sesión o al abordar una nueva tarea, debes leer los archivos ubicados en `memory-bank/` (empezando por `README.md` y `activeContext.md`).
- **Persistencia:** Mantén actualizado el archivo `memory-bank/progress.md` al finalizar tareas significativas para asegurar la continuidad del trabajo.

---

## 2. PROHIBIDO ORMs
- **NUNCA** utilices TypeORM, Prisma, Sequelize, Drizzle, Knex, Entity Framework, Hibernate ni ningún otro ORM o Query Builder.
- **TECNOLOGÍA RECOMENDADA:**
  - **Node.js (NestJS / Express):** Use driver nativo `pg` (PostgreSQL) o `mssql` (SQL Server) con consultas parametrizadas puras.
  - **Rust:** Use `sqlx` (con binds) o `tiberius` (SQL Server).
  - **Flutter:** Use SQLite nativo o consultas directas al backend.
- **RETURNING:** Usa siempre la cláusula `RETURNING` en sentencias `INSERT` o `UPDATE` para recuperar los datos grabados sin hacer una segunda consulta:
  ```sql
  INSERT INTO Solicitudes (PostulanteID, Puesto) VALUES (@pId, @puesto) RETURNING *;
  ```
- **Lógica en BD:** Prefiere el uso de Procedimientos Almacenados (Stored Procedures) y Funciones de Base de Datos para lógica de datos compleja.

---

## 3. SEGURIDAD Y QUERIES PARAMETRIZADAS
- **Inyecciones SQL:** Nunca concatenes variables directamente en cadenas SQL. Usa siempre variables de sustitución parametrizadas (`$1`, `@param`).
- **Secrets:** Queda prohibido hardcodear contraseñas, API keys, tokens o cadenas de conexión. Usa variables de entorno (`.env`).
- **Headers:** Usa Helmet en Node para inyectar cabeceras de seguridad y configura correctamente CSP y CORS con listas de origen restringidas.
- **Auditoría:** Revisa frecuentemente la guía de seguridad en [advanced.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/security/advanced.md) antes de publicar APIs.

---

## 4. CONVENCIONES DE GIT
- **Mensajes de Commit:** Sigue el estándar de **Conventional Commits 1.0.0** (ej: `feat(auth): ...`, `fix(sql): ...`, `docs(ux): ...`).
- **Ramas:** Crea ramas de duración corta (`feature/*`, `bugfix/*`) y fusiónalas mediante Pull Requests validadas por CI/CD.
- Revisa las reglas completas de Git en [index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/git/index.md).

---

## 5. CÓDIGO LIMPIO, LOGGING Y ERRORES
- **Principios SOLID:** Aplica los principios SOLID explicados en [solid.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/clean-code/solid.md).
- **Manejo de Errores:** Nunca dejes bloques `catch` vacíos. Utiliza bloques `try-catch` estructurados que retornen códigos de estado legibles para el cliente y logs detallados para el servidor.
- **Logging en Producción:** Queda prohibido el uso de `console.log` sueltos en producción. Utiliza librerías de structured logging (como Winston o Pino en Node) para guardar registros en formato JSON.
- **Documentación de Código:** Toda función pública, clase, endpoint o componente complejo debe incluir un comentario explicativo (JSDoc, DartDoc, etc.) describiendo sus parámetros, retornos y comportamiento.

---

## 6. DOCUMENTACIÓN TÉCNICA DE REFERENCIA
Antes de programar en un entorno específico, lee su guía correspondiente en `docs/`:
- **CSS / Estilos:** [css/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/css/index.md)
- **JavaScript / Node:** [javascript/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/javascript/index.md)
- **Next.js (App Router):** [nextjs/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/nextjs/index.md)
- **UX / UI / Proceso:** [ux-design/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/ux-design/index.md) y [process.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/ux-design/process.md)
- **DevOps / Despliegue:** [devops/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/devops/index.md) y [docker.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/devops/docker.md)
- **Git / Commits:** [git/index.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/git/index.md)
- **SQL Server Avanzado:** [sql-server/advanced.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/sql-server/advanced.md)
- **Clean Code / SOLID:** [clean-code/solid.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/clean-code/solid.md)

---

## 7. AGENTES Y DELEGACIÓN
Usa `@agent` para invocar subagentes especializados si están soportados por tu herramienta actual:
- `@architect` → Diseño de arquitectura, selección técnica e inicialización.
- `@backend-dev` → Desarrollo del API con Express/NestJS, lógica y SQL.
- `@frontend-dev` → Interfaces web con React, TypeScript y CSS.
- `@flutter-dev` → Apps móviles híbridas nativas.
- `@sql-expert` → Diseño de bases de datos, Stored Procedures y Query Performance.
- `@devops-engineer` → Contenedores Docker, CI/CD, configuración de proxy y despliegue.
- `@security-auditor` → Auditoría de código, análisis de dependencias y vulnerabilidades.
- `@designer` → UI/UX premium, CSS tokens, micro-animaciones y layouts.
- `@tester` y `@qa-reviewer` → Pruebas y revisión de calidad de código final.
