# Integración con Gemini / Antigravity

Gemini (a través de extensiones oficiales en editores) o el entorno de Antigravity utilizan el contexto de archivos abiertos y búsquedas en el workspace para guiar su generación de código.

---

## 1. Reglas en el Workspace

Gemini busca activamente archivos de reglas en la raíz. Para asegurar que Gemini siga las directrices:

1. Mantén la carpeta `rules/` y `memory-bank/` en la raíz del proyecto.
2. Si estás utilizando un prompt del sistema personalizado o un archivo de configuración `.geminirc` (o similar), haz referencia a que el archivo principal de reglas es `rules/GOLDEN_RULES.md`.

---

## 2. Invocación Explícita en Prompts

Cuando le pidas tareas a Gemini, puedes guiarlo referenciando directamente los archivos de documentación del proyecto:

```text
Por favor, crea un nuevo formulario de registro. Sigue las pautas de estilos y HSL de docs/css/index.md y los principios de accesibilidad de docs/ux-design/index.md.
```

Al indicarle las rutas exactas, Gemini cargará los archivos abiertos o los leerá del workspace, garantizando que el diseño final sea consistente con los tokens del framework y no invente estilos ad-hoc.
