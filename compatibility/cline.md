# Integración Automática con Cline / Roo Cline

Cline lee de forma nativa las instrucciones personalizadas de tu proyecto a través del archivo `.clinerules` ubicado en la raíz.

---

## 1. Instalación Rápida

Para activar las directrices de `configcode` en un proyecto abierto con Cline, copia el archivo `.clinerules` a la raíz de tu proyecto:

```bash
# Copia el archivo de reglas de Cline a tu proyecto de destino
cp .opencode/.clinerules ./
```

Al iniciar una nueva conversación de chat, Cline leerá de forma automática el archivo `.clinerules` y configurará sus directrices del sistema primarias en consecuencia.

---

## 2. Instrucciones Clave Ejecutadas
Al cargar este archivo, Cline sabrá inmediatamente:
1. **Reglas de Oro:** Que está estrictamente prohibido usar ORMs y que se debe priorizar el uso de SQL puro y parametrizado.
2. **Sistema Memory Bank:** Que debe leer y mantener actualizados los archivos en `memory-bank/` al comenzar y finalizar cada hito o tarea.
3. **Mecanismo Anti-Lazy:** Que debe escribir la implementación funcional completa del código sin abreviar ni omitir fragmentos utilizando comentarios.
