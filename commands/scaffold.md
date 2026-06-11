# Comando: /scaffold

Este comando automatiza la inicialización de la estructura base de directorios y archivos de configuración para un proyecto nuevo de acuerdo al stack seleccionado.

---

## 1. Funcionamiento del Comando

Al invocar `/scaffold <stack>`, el agente debe:
1. Validar el argumento del `<stack>` (Valores permitidos: `express-api`, `react-vite`, `flutter-app`).
2. Copiar los archivos y estructura base correspondientes de `templates/<stack>/` en el directorio de trabajo del usuario.
3. Copiar las configuraciones base de compatibilidad de IDE (como `.cursorrules` o `.clinerules`) según corresponda.
4. Inicializar el Memory Bank (`memory-bank/`) creando plantillas vacías para que el usuario documente el alcance del proyecto.

---

## 2. Invocación de Agentes

Para completar este comando, delega en:
- `@architect` para coordinar el andamiaje inicial del proyecto y asegurar el cumplimiento de la estructura.
- `@devops-engineer` para verificar la existencia del `.dockerignore` y `.gitignore` correctos para el stack.

---

## 3. Ejemplo de Uso

```bash
/scaffold react-vite
```

**Resultado:**
- Creación de carpetas `src/components`, `src/hooks`, `src/services`, `src/state`.
- Creación de `vite.config.ts`, `tsconfig.json`, `package.json`, `.gitignore`.
- Inicialización de `memory-bank/` en la raíz del proyecto.
