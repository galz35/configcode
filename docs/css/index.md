# CSS — Guía de Referencia Completa

## Metodologías

### BEM (Block Element Modifier) — Recomendado
```css
/* Block */
.card {}

/* Element */
.card__title {}
.card__body {}
.card__footer {}

/* Modifier */
.card--featured {}
.card--disabled {}
.card__title--large {}
```

### Utility-First (Tailwind-style)
```css
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 1rem; }
.text-primary { color: var(--color-primary); }
```

### CSS Modules (React)
```tsx
import styles from './Button.module.css';
// Genera clases únicas: Button_primary_x7d2
<button className={styles.primary}>Click</button>
```

---

## Design Tokens — Variables CSS

SIEMPRE usa variables CSS para valores reutilizables. NUNCA hardcodees colores, tipografía o espaciado.

```css
:root {
  /* === Colores === */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-light: #dbeafe;
  --color-secondary: #7c3aed;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #0891b2;

  /* Neutrales */
  --color-bg: #ffffff;
  --color-bg-secondary: #f8fafc;
  --color-bg-tertiary: #f1f5f9;
  --color-text: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-border: #e2e8f0;
  --color-border-focus: var(--color-primary);

  /* === Tipografía === */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* === Espaciado (múltiplos de 4px) === */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */

  /* === Bordes === */
  --radius-sm: 0.25rem;  /* 4px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-2xl: 1.5rem;  /* 24px */
  --radius-full: 9999px;

  --border-width: 1px;
  --border: var(--border-width) solid var(--color-border);

  /* === Sombras === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* === Transiciones === */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* === Z-index === */
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-tooltip: 70;
  --z-toast: 80;
}
```

---

## Dark Mode

```css
/* Approach 1: prefers-color-scheme (automático) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-bg-secondary: #1e293b;
    --color-bg-tertiary: #334155;
    --color-text: #f8fafc;
    --color-text-secondary: #cbd5e1;
    --color-text-muted: #64748b;
    --color-border: #334155;
  }
}

/* Approach 2: data-attribute (manual toggle) — PREFERIDO */
[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;
  --color-text: #f8fafc;
  --color-text-secondary: #cbd5e1;
  --color-text-muted: #64748b;
  --color-border: #334155;
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
}
```

```js
// Toggle dark mode
const toggleTheme = () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

// Init on load
const savedTheme = localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);
```

---

## Responsive Design — Mobile First

SIEMPRE diseña mobile-first: estilos base para móvil, media queries para desktop.

```css
/* Breakpoints estándar */
/* Mobile: base (< 640px) */
/* Tablet: >= 640px */
/* Desktop: >= 1024px */
/* Wide: >= 1280px */

.container {
  width: 100%;
  padding-inline: var(--space-4);
  margin-inline: auto;
}

@media (min-width: 640px) {
  .container { max-width: 640px; }
}

@media (min-width: 1024px) {
  .container { max-width: 1024px; }
}

@media (min-width: 1280px) {
  .container { max-width: 1200px; }
}
```

### Container queries (moderno)
```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card { flex-direction: row; }
}
```

---

## Layout — Flexbox y Grid

### Flexbox patterns
```css
/* Centering */
.center { display: flex; justify-content: center; align-items: center; }

/* Space between */
.between { display: flex; justify-content: space-between; align-items: center; }

/* Stack vertical */
.stack { display: flex; flex-direction: column; gap: var(--space-4); }

/* Inline */
.inline { display: flex; align-items: center; gap: var(--space-2); }
```

### Grid patterns
```css
/* Auto-fit responsive grid */
.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

/* Fixed columns */
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); }

/* Sidebar layout */
.sidebar-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-6);
}

/* Holy grail */
.page-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
```

---

## Componentes comunes

### Botones
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  border-radius: var(--radius-md);
  border: var(--border);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
}

.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn--secondary {
  background: transparent;
  color: var(--color-text);
  border-color: var(--color-border);
}
.btn--secondary:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}
.btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}

.btn--danger {
  background: var(--color-error);
  color: white;
  border-color: var(--color-error);
}

/* Tamaños */
.btn--sm { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
.btn--lg { padding: var(--space-3) var(--space-6); font-size: var(--text-base); }
```

### Inputs / Forms
```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.form-input {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  border: var(--border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-input--error {
  border-color: var(--color-error);
}

.form-error {
  font-size: var(--text-xs);
  color: var(--color-error);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
```

### Cards
```css
.card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.card__title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.card__body {
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}

.card__footer {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: var(--border);
}
```

### Modals
```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  animation: fade-in var(--transition-fast);
}

.modal {
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 500px;
  max-height: 90dvh;
  overflow-y: auto;
  z-index: var(--z-modal);
  animation: slide-up var(--transition-base);
}

.modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: var(--border);
}

.modal__body { padding: var(--space-6); }

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: var(--border);
}
```

---

## Animaciones

### Keyframes comunes
```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  50% { opacity: 0.5; }
}

/* Skeleton loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg,
    var(--color-bg-secondary) 25%,
    var(--color-bg-tertiary) 50%,
    var(--color-bg-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}
```

### Accesibilidad de animaciones
```css
/* SIEMPRE respetar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Tipografía

```css
/* Reset tipográfico */
body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--color-text);
}

h1 { font-size: var(--text-4xl); }
h2 { font-size: var(--text-3xl); }
h3 { font-size: var(--text-2xl); }
h4 { font-size: var(--text-xl); }
h5 { font-size: var(--text-lg); }

/* Prose */
.prose {
  max-width: 65ch;
  line-height: var(--leading-relaxed);
}

.prose p + p { margin-top: var(--space-4); }
.prose h2 { margin-top: var(--space-8); margin-bottom: var(--space-4); }
.prose h3 { margin-top: var(--space-6); margin-bottom: var(--space-3); }
.prose ul, .prose ol { padding-left: var(--space-6); }
.prose li + li { margin-top: var(--space-2); }

/* Truncation */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## Reset CSS moderno

```css
/* Modern CSS Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -moz-text-size-adjust: none;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  scroll-behavior: smooth;
}

body {
  min-height: 100dvh;
  line-height: var(--leading-normal);
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
  color: inherit;
}

button { cursor: pointer; }

a { color: inherit; text-decoration: none; }

ul[role="list"], ol[role="list"] { list-style: none; }

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## Anti-patrones (NUNCA hagas esto)

```css
/* ❌ MAL: Colores hardcodeados */
.card { background: #fff; color: #333; border: 1px solid #ddd; }

/* ✅ BIEN: Variables */
.card { background: var(--color-bg); color: var(--color-text); border: var(--border); }

/* ❌ MAL: Tamaños mágicos */
.title { font-size: 18.5px; margin: 13px 7px; }

/* ✅ BIEN: Tokens del sistema */
.title { font-size: var(--text-lg); margin: var(--space-3) var(--space-2); }

/* ❌ MAL: !important */
.header { z-index: 999999 !important; }

/* ✅ BIEN: Z-index organizado */
.header { z-index: var(--z-sticky); }

/* ❌ MAL: position absolute para layout */
.sidebar { position: absolute; left: 0; top: 60px; width: 250px; }

/* ✅ BIEN: Grid/Flexbox */
.layout { display: grid; grid-template-columns: 250px 1fr; }

/* ❌ MAL: Ignorar prefers-reduced-motion */
.bounce { animation: bounce 1s infinite; }

/* ✅ BIEN: Respetar accesibilidad */
.bounce { animation: bounce 1s infinite; }
@media (prefers-reduced-motion: reduce) {
  .bounce { animation: none; }
}
```

---

## Performance

- Usa `content-visibility: auto` para secciones fuera del viewport
- Usa `will-change` solo cuando mides que ayuda, no "por si acaso"
- Prefiere `transform` y `opacity` para animaciones (GPU-accelerated)
- Evita layout shifts: siempre declara `width` y `height` en imágenes
- Usa `font-display: swap` para web fonts
- Minifica CSS en producción
- Elimina CSS no utilizado con PurgeCSS/LightningCSS
