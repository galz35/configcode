# Comando: /memory-update

Este comando automatiza el mantenimiento de la memoria persistente del agente, asegurando que el estado del proyecto se guarde correctamente al finalizar una sesión de trabajo o completar un hito.

---

## 1. Funcionamiento del Comando

Al invocar `/memory-update`, el agente debe:
1. Analizar el historial de cambios recientes del código y el estado de la tarea en curso.
2. Actualizar el archivo `memory-bank/activeContext.md` con los temas actuales en los que se trabaja y próximos pasos inmediatos.
3. Actualizar `memory-bank/progress.md` marcando los puntos completados como resueltos y moviendo tareas pendientes si es necesario.
4. Si se introdujo un cambio en la pila tecnológica, actualizar `memory-bank/techContext.md` o `memory-bank/systemPatterns.md`.

---

## 2. Invocación de Agentes

Para completar este comando, delega en:
- `@architect` para evaluar que la estructura del sistema refleje el estado actual de los patrones y dependencias técnicas.

---

## 3. Ejemplo de Uso

```bash
/memory-update "Implementada autenticación JWT y corrección de stored procedures de registro"
```
