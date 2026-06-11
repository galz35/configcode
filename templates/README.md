# Plantillas de Proyectos (Templates)

Este directorio contiene las bases estructurales y de configuración para iniciar nuevos proyectos de desarrollo utilizando las mejores prácticas de arquitectura y las Reglas de Oro del framework.

---

## Plantillas Disponibles

### 1. [Express API](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/templates/express-api/)
- **Stack:** Express + TypeScript + mssql/pg + pino + JWT + Helmet.
- **Enfoque:** API REST limpia sin ORM, manejo de errores robusto, logs estructurados y consultas SQL parametrizadas directas.

### 2. [React Vite](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/templates/react-vite/)
- **Stack:** React 18+ + Vite + TypeScript + Zustand + React Hook Form + CSS Modules.
- **Enfoque:** Componentes funcionales tipados, tokens CSS, temas claro/oscuro e interfaces sumamente pulidas y accesibles.

### 3. [Flutter App](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/templates/flutter-app/)
- **Stack:** Flutter + Riverpod + Dio + GoRouter + Drift/Hive.
- **Enfoque:** Arquitectura limpia en capas (Repository/Data/Presentation), offline-first y widgets responsivos.

---

## Cómo Utilizar una Plantilla

Puedes arrancar un proyecto copiando recursivamente la carpeta de la plantilla o utilizando el comando `/scaffold <nombre-de-plantilla>`.

Ejemplo manual:
```bash
cp -r templates/express-api/* /ruta/a/tu/nuevo-proyecto/
```
