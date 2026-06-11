# Compatibilidad Multi-IDE

Este directorio contiene las guías de integración para cargar las reglas, agentes y comandos de `configcode` en diferentes herramientas y entornos de desarrollo de IA.

---

## Entornos Compatibles

### 1. [Cursor](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/compatibility/cursor.md)
Aprende a integrar las reglas de oro directamente en la carpeta `.cursor/rules/` para que Cursor las aplique de forma automática al generar código.

### 2. [Cline / Roo Cline](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/compatibility/cline.md)
Aprende a configurar el archivo `.clinerules` en la raíz de tu proyecto para guiar el comportamiento y herramientas permitidas al agente Cline.

### 3. [Gemini / Antigravity](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/compatibility/gemini.md)
Guía para maximizar el uso de este framework en entornos que utilizan la extensión de Gemini en VS Code u otras interfaces de Antigravity.

---

## Principio de Portabilidad
El diseño de `configcode` es agnóstico del IDE. Al mantener las reglas escritas en Markdown estructurado, cualquier IA que soporte carga de contexto puede leer e interpretar de manera unificada las pautas de este repositorio.
