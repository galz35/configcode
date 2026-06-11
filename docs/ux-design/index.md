# Guía de Principios de Diseño UX y Sistemas de Diseño

Esta guía establece los principios de Experiencia de Usuario (UX) y las bases visuales que cualquier agente de IA o desarrollador debe seguir para construir aplicaciones web y móviles premium, visualmente impactantes y altamente accesibles.

---

## 1. Principios de Experiencia de Usuario (UX)

### Claridad y Enfoque (Simplicidad Visual)
- **Eliminar ruido:** Menos es más. Cada elemento en la interfaz debe tener un propósito claro.
- **Jerarquía Visual:** Usa variaciones de tamaño, peso y color para guiar la mirada del usuario a lo más importante. El botón de acción principal (CTA) debe ser inmediatamente visible.
- **Ley de Fitts:** Los elementos de interacción frecuentes (como botones de acción) deben ser grandes y fáciles de alcanzar, especialmente en dispositivos móviles.

### Consistencia y Familiaridad
- **Patrones estándar:** No reinventes la rueda a menos que sea necesario. Usa menús de navegación, barras de búsqueda y flujos de checkout familiares.
- **Consistencia Interna:** Mantén consistentes los colores, fuentes, espaciados y comportamiento de componentes en toda la aplicación.

### Feedback Inmediato e Interactivo
- **Estados de carga elegantes:** Utiliza skeletons animados en lugar de spinners aburridos de "Cargando...".
- **Micro-interacciones:** Agrega sutiles animaciones al pasar el cursor (hover), hacer clic (active) o completar una acción (e.g., checkmarks animados al guardar).
- **Mensajes de retroalimentación (Toasts/Snackbars):** Confirma las acciones del usuario de forma no intrusiva.

---

## 2. Paletas de Colores y Estética Premium

Evita los colores primarios puros y aburridos (como `#FF0000` o `#0000FF`). En su lugar, utiliza paletas refinadas y dinámicas.

### Sistema de Color en HSL
El formato HSL (Hue, Saturation, Lightness) facilita la creación de variantes coherentes para hover, foco y temas claro/oscuro.

| Rol | Light Mode (CSS HSL) | Dark Mode (CSS HSL) | Uso |
| :--- | :--- | :--- | :--- |
| **Primary** | `hsl(250, 84%, 54%)` (Índigo) | `hsl(250, 95%, 70%)` (Lavanda brillante) | CTA principal, links, focos |
| **Secondary** | `hsl(200, 95%, 45%)` (Azul océano) | `hsl(200, 90%, 65%)` (Azul cian) | Acciones secundarias, badges |
| **Success** | `hsl(142, 72%, 29%)` (Verde esmeralda) | `hsl(142, 69%, 58%)` (Verde menta) | Estados correctos, toast de éxito |
| **Warning** | `hsl(38, 92%, 50%)` (Ámbar) | `hsl(38, 100%, 65%)` (Ámbar brillante) | Advertencias, alertas |
| **Destructive**| `hsl(0, 84%, 60%)` (Coral rojo) | `hsl(0, 90%, 70%)` (Rojo neón suave) | Borrar, errores críticos |
| **Background** | `hsl(210, 40%, 98%)` (Blanco grisáceo) | `hsl(222, 47%, 11%)` (Azul pizarra oscuro) | Fondo de la aplicación |
| **Surface** | `hsl(0, 0%, 100%)` (Blanco) | `hsl(222, 47%, 16%)` (Azul pizarra medio) | Tarjetas, modales, inputs |
| **Border** | `hsl(214, 32%, 91%)` (Gris claro) | `hsl(217, 32%, 25%)` (Gris azulado oscuro) | Bordes de inputs, divisores |

### Reglas para Dark Mode Sleek (No Negro Puro)
1. **Fondo Base:** Evita `#000000` absoluto para el fondo base. Prefiere tonos pizarra u oscuros saturados como `hsl(222, 47%, 11%)` (`#0f172a`). Esto reduce la fatiga visual y da profundidad.
2. **Elevación de Capas:** A mayor elevación (tarjetas, modales), el color de fondo debe ser ligeramente más claro:
   - Fondo: `hsl(222, 47%, 11%)`
   - Tarjeta: `hsl(222, 47%, 16%)`
   - Popover/Modal: `hsl(222, 47%, 22%)`
3. **Contraste de Texto:** Usa texto principal en `hsl(210, 40%, 98%)` y texto secundario en `hsl(215, 20%, 65%)`.

---

## 3. Tipografía y Jerarquía Visual

### Fuentes Recomendadas (Google Fonts)
- **Sans-Serif Modernas (Interfaz/UI):** *Inter*, *Outfit*, *Plus Jakarta Sans*, *Cabinet Grotesk*.
- **Display (Títulos llamativos):** *Syne*, *Clash Display*, *Lexend*.
- **Monospace (Código/Datos):** *JetBrains Mono*, *Fira Code*.

### Jerarquía Tipográfica Escalar
Establece una escala tipográfica clara (e.g., Major Third o Perfect Fourth).

```css
:root {
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
  --text-5xl: 3rem;       /* 48px */
}
```

---

## 4. Design Tokens & Grid System

Utiliza siempre variables CSS (Design Tokens) para el espaciado, bordes y sombras para mantener un diseño coherente.

```css
:root {
  /* Espaciado (Multiplos de 8px / 4px) */
  --spacing-1: 0.25rem;  /* 4px */
  --spacing-2: 0.5rem;   /* 8px */
  --spacing-3: 0.75rem;  /* 12px */
  --spacing-4: 1rem;     /* 16px */
  --spacing-6: 1.5rem;   /* 24px */
  --spacing-8: 2rem;     /* 32px */
  --spacing-12: 3rem;    /* 48px */

  /* Bordes Redondeados (Border Radius) */
  --radius-sm: 0.375rem; /* 6px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-2xl: 1.5rem;  /* 24px */
  --radius-full: 9999px; /* Píldora / Círculo */

  /* Sombras (Box Shadow) - Soft and realistic */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

### Layout Grid y Contenedores
- **Mobile First:** Diseña para móviles (`< 640px`) y escala hacia arriba.
- **Grilla Responsiva:** Usa CSS Grid para layouts complejos y Flexbox para componentes de una sola dirección.
- **Max Width:** Limita el ancho de lectura del contenido principal para evitar fatiga visual (`max-width: 65ch` para texto, `max-width: 1200px` para dashboards).

---

## 5. Accesibilidad (WCAG 2.2) y Usabilidad

El diseño premium no solo entra por los ojos, sino que debe ser usable por todos.

### Checklist de Accesibilidad Rápida
- [ ] **Contraste de Color:** El texto normal debe tener un contraste mínimo de **4.5:1** contra el fondo. El texto grande (`>18pt` o `bold >14pt`) debe tener **3:1**.
- [ ] **Tamaño de Target Táctil:** En móviles, todos los elementos interactivos (botones, inputs, enlaces) deben medir al menos **44x44 CSS pixels** para evitar clics accidentales.
- [ ] **Indicadores de Enfoque (`:focus-visible`):** Nunca remuevas el borde de enfoque (`outline: none`) sin proveer un estilo de foco personalizado, accesible y visible mediante teclado.
- [ ] **Semántica HTML:** Usa etiquetas apropiadas (`<button>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<aside>`) para que los lectores de pantalla puedan estructurar la página.
- [ ] **Atributos `aria-*`:** Provee `aria-label` para botones que solo contienen íconos e indica estados interactivos (`aria-expanded="true"`, `aria-checked`, etc.).
- [ ] **Navegación por Teclado:** Asegúrate de que el usuario pueda interactuar con toda la web usando solo la tecla `Tab` y `Enter`.

---

## 6. Referencia a Sistemas de Diseño del Mercado

Cuando desarrolles proyectos específicos, alinea los componentes visuales a las siguientes guías de interfaz:

1. **Google Material Design 3 (Material You):**
   - Enfoque en personalización por color dinámico y bordes muy redondeados.
   - Ideal para Flutter y apps Android.
   - [Documentación Oficial](https://m3.material.io/)
2. **Apple Human Interface Guidelines (HIG):**
   - Enfoque en minimalismo, tipografía limpia (San Francisco) y transiciones realistas de física de fluidos.
   - Excelente para iOS y macOS.
   - [Documentación Oficial](https://developer.apple.com/design/human-interface-guidelines/)
3. **Tailwind UI / Shadcn UI:**
   - Estética moderna de desarrollo web rápido. Enfoque en bordes rectos/suaves, colores neutros profundos y animaciones fluidas hechas con Radix UI primitives.
   - [shacdn/ui](https://ui.shadcn.com/)
