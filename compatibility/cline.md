# Integración con Cline / Roo Cline

Cline (anteriormente Claude Dev) lee las instrucciones personalizadas de la raíz de tu proyecto en cada nueva sesión de chat.

---

## 1. Reglas en `.clinerules`

Para que Cline adopte el framework de `configcode` de forma transparente:

1. Copia el contenido del archivo `rules/GOLDEN_RULES.md` de este repositorio.
2. Crea un archivo llamado `.clinerules` en la raíz de tu proyecto de destino.
3. Pega el contenido de las reglas.

Al iniciar el chat, Cline leerá de forma automática el archivo `.clinerules` y lo agregará como instrucciones del sistema permanentes, respetando la prohibición de ORMs, el uso de SQL parametrizado, y la lectura obligatoria del Memory Bank.

---

## 2. Inicialización del Memory Bank con Cline
Cline es experto en mantener y actualizar el Memory Bank de forma autónoma. Al iniciar una tarea, puedes indicarle:
> *"Lee el memory-bank del proyecto, revisa el activeContext y dime cuál es el siguiente paso."*
 Al finalizar el trabajo, puedes ejecutar:
> *"Actualiza el memory bank con los cambios realizados."* (Lo cual disparará el comportamiento del comando `/memory-update`).
