# Guía de Git, Commits Convencionales y Branching

Esta guía establece las convenciones de Git para asegurar un historial de cambios legible, automatización de versiones (Semantic Versioning) y flujos de trabajo eficientes en equipo.

---

## 1. Convención de Commits (Conventional Commits)

Es obligatorio seguir el estándar de **Conventional Commits 1.0.0**. Esto permite generar de forma automática los archivos `CHANGELOG.md` e incrementar correctamente el número de versión (major, minor, patch).

### Estructura del Commit:
```text
<tipo>(<alcance opcional>): <descripción corta y clara en imperativo>

[cuerpo opcional detallando el por qué]

[pie opcional para reportar breaking changes o cerrar issues (ej: Closes #12)]
```

### Tipos Permitidos:
- **`feat`**: Una nueva característica para el usuario (agrega funcionalidad).
- **`fix`**: Corrección de un bug.
- **`docs`**: Cambios exclusivos en la documentación.
- **`style`**: Cambios de estilo en el código que no afectan su lógica (formato, espaciado, punto y coma omitido).
- **`refactor`**: Cambio en el código que no arregla un bug ni añade una característica (reorganizar estructura).
- **`perf`**: Mejora de rendimiento.
- **`test`**: Añadir o modificar tests (unitarios, integración, E2E).
- **`build`**: Cambios que afectan el sistema de compilación o dependencias externas (ej. npm, maven, cargo).
- **`ci`**: Cambios en configuraciones de CI/CD (GitHub Actions, GitLab CI).
- **`chore`**: Tareas repetitivas que no modifican archivos de código ni de tests (ej. actualizar `.gitignore`).

### Ejemplos Correctos:
```text
feat(auth): implementar inicio de sesión con Google OAuth2
fix(sql): corregir timeout en stored procedure de reportes anuales
docs(readme): actualizar instrucciones de despliegue local en docker
style: formatear archivos con prettier
refactor(users): unificar servicios de creación de usuario administrador y cliente
```

---

## 2. Estrategia de Ramas (Branching Strategy)

Dependiendo de la escala del proyecto, se utilizará una de las siguientes dos metodologías:

### Opción A: Trunk-Based Development (Recomendado para equipos rápidos / CD)
- **Concepto:** Una única rama principal (`main` o `master`).
- **Flujo:** Los desarrolladores crean ramas cortas (`feature/*` o `bugfix/*`) que duran de 1 a 2 días como máximo.
- **Merge:** Se integran a `main` constantemente mediante Pull Requests aprobadas e integradas por CI/CD.
- **Ventaja:** Minimiza los "merge hells" y asegura que todo el equipo trabaja sobre el código más reciente.

### Opción B: Git Flow (Recomendado para software con ciclos de release formal)
- **Ramas Principales:**
  - `main`: Código en producción listo y estable.
  - `develop`: Código de integración de la siguiente versión en desarrollo.
- **Ramas de Soporte:**
  - `feature/*`: Desarrollar nuevas funcionalidades (nacen de `develop`, regresan a `develop`).
  - `release/*`: Preparación de una nueva versión en producción (nace de `develop`, regresa a `main` y `develop`).
  - `hotfix/*`: Solucionar errores críticos en producción inmediatamente (nace de `main`, regresa a `main` y `develop`).

---

## 3. Plantilla de Pull Request (PR Template)

Para estandarizar las revisiones de código, agrega el archivo `.github/pull_request_template.md` en tu repositorio.

```markdown
## Descripción
<!-- ¿Qué hace este cambio? Describe brevemente el problema y tu solución. -->

## Tipo de Cambio
- [ ] Nueva funcionalidad (feat)
- [ ] Corrección de error (fix)
- [ ] Refactorización de código (refactor)
- [ ] Documentación (docs)
- [ ] Otro (especificar):

## ¿Cómo se probó?
<!-- Describe las pruebas que realizaste para verificar los cambios. -->
- [ ] Pruebas unitarias
- [ ] Pruebas manuales
- [ ] Pruebas de integración

## Checklist antes de solicitar revisión:
- [ ] Mi código sigue las pautas de estilo de este proyecto.
- [ ] He realizado una auto-revisión de mi propio código.
- [ ] He documentado las funciones nuevas.
- [ ] No dejo console.log o prints innecesarios en el código.
```

---

## 4. Git Hooks con Husky y lint-staged

Para evitar que se suban commits con errores de estilo, tests fallidos o formato de commit incorrecto, configuramos Git Hooks locales.

### Instalación Rápida (Node.js):
```bash
# Instalar dependencias
npm install husky lint-staged --save-dev

# Inicializar Husky
npx husky init
```

### Configuración de commit-msg (Validador de Conventional Commits):
Instalamos `@commitlint/cli` y `@commitlint/config-conventional`:
```bash
npm install @commitlint/cli @commitlint/config-conventional --save-dev
```
Crear archivo `commitlint.config.js` en la raíz:
```javascript
module.exports = { extends: ['@commitlint/config-conventional'] };
```
Crear hook en `.husky/commit-msg`:
```bash
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}'
```

### Configuración de pre-commit (lint-staged):
Configurar `.husky/pre-commit` para correr lint-staged:
```bash
npx husky add .husky/pre-commit 'npx lint-staged'
```
Y en tu `package.json` agregas:
```json
"lint-staged": {
  "*.ts": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.css": [
    "prettier --write"
  ]
}
```
Esto asegura que **solo los archivos que modificaste (staged)** sean formateados y revisados antes de subir el commit, ahorrando mucho tiempo en el pipeline de CI/CD.
