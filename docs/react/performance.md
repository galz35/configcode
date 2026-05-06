# React Performance Guide

## useMemo vs useCallback vs React.memo

```tsx
// Cuando SI usar useMemo:
// 1. Computacion cara (sort, filter, reduce sobre arrays grandes)
const sortedUsers = useMemo(
  () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
  [users]
);

// 2. Objeto/array que se pasa a React.memo
const filterParams = useMemo(
  () => ({ status, role, search }),
  [status, role, search]
);
<MemoFilter params={filterParams} />

// 3. Derivar datos que dependen de props que cambian poco
const expensiveResult = useMemo(
  () => processLargeDataset(rawData, config),
  [rawData, config]
);

// Cuando NO usar useMemo:
// - Calculos baratos (suma, multiplicacion, length)
// - Valores primitivos (strings, numbers)
// - Referencias que cambian en cada render de todos modos

// Cuando SI usar useCallback:
// 1. Funcion pasada a React.memo
const handleClick = useCallback((id: string) => {
  onSelect(id);
}, [onSelect]);
<MemoButton onClick={handleClick} />

// 2. Funcion en useEffect dependency
const fetchData = useCallback(async () => {
  const result = await api.getData(filter);
  setData(result);
}, [filter]);
useEffect(() => { fetchData(); }, [fetchData]);

// Cuando NO usar useCallback:
// - Funcion pasada a elementos HTML nativos (<button onClick>)
// - Funcion que cambia sus deps en cada render
// - Componentes que no son React.memo

// React.memo: Comparacion superficial de props
const ExpensiveComponent = memo(function ExpensiveComponent({ data, onAction }: Props) {
  return /* JSX pesado */;
}, (prev, next) => {
  // Custom comparator: solo re-renderiza si cambia data.id
  return prev.data.id === next.data.id
      && prev.onAction === next.onAction;
});
```

## Virtualization (TanStack Virtual)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTable({ data, columns }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,          // altura estimada de fila
    overscan: 10,                    // filas extra fuera de vista
    getItemKey: (index) => data[index].id,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = data[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TableRow item={item} columns={columns} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Infinite scroll con virtualizer
function VirtualFeed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const allItems = data?.pages.flatMap(p => p.items) ?? [];

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  // Cargar mas cuando llegamos al final
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    if (lastItem && lastItem.index >= allItems.length - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, allItems.length, fetchNextPage]);

  return (
    <div ref={scrollRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(v => (
          v.index < allItems.length
            ? <FeedItem key={allItems[v.index].id} item={allItems[v.index]} /* ... */ />
            : <div key="loader"><Spinner /></div>
        ))}
      </div>
    </div>
  );
}
```

## React 18+ Concurrent Features

```tsx
// useTransition: Priorizar UI interactiva sobre calculo pesado
function SearchPage() {
  const [query, setQuery] = useState('');
  const [deferredQuery, setDeferredQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);  // URGENTE: input se actualiza inmediato
    startTransition(() => {
      setDeferredQuery(e.target.value);  // NO URGENTE: filtro puede esperar
    });
  };

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <Results query={deferredQuery} />
    </>
  );
}

// useDeferredValue: Version diferida de un valor
function AutoComplete({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);
  const suggestions = useMemo(
    () => searchMassiveIndex(deferredQuery),
    [deferredQuery]
  );

  return (
    <ul style={{ opacity: query !== deferredQuery ? 0.5 : 1 }}>
      {suggestions.map(s => <li key={s.id}>{s.text}</li>)}
    </ul>
  );
}

// Suspense + lazy boundaries
<Suspense fallback={<Skeleton />}>
  <Profile userId={id} />
</Suspense>

// Transitions + Suspense (evita flicker)
function TabContainer() {
  const [tab, setTab] = useState('posts');
  const [isPending, startTransition] = useTransition();

  function switchTab(next: string) {
    startTransition(() => setTab(next));
  }

  return (
    <div>
      <button onClick={() => switchTab('posts')}>Posts</button>
      <button onClick={() => switchTab('comments')}>Comments</button>
      {isPending ? <Skeleton /> : <TabContent tab={tab} />}
    </div>
  );
}
```

## Code Splitting

```tsx
// Lazy loaded routes
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Reports = lazy(() => import('./pages/Reports'));

// Prefetch estrategico
const handleHover = () => {
  const modulePromise = import('./pages/AdminPanel');
  // modulePromise se ejecuta en background, listo cuando navegas
};

// Loading state para chunk loading
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route
      path="/admin/*"
      element={
        <ErrorBoundary fallback={<ErrorPage />}>
          <AdminPanel />
        </ErrorBoundary>
      }
    />
  </Routes>
</Suspense>

// Route-based splitting en Vite
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react'],
          admin: ['./src/pages/AdminPanel'],
        },
      },
    },
  },
});
```

## Image & Asset Optimization

```tsx
// Responsive images con srcset
<img
  src={image.small}
  srcSet={`${image.small} 400w, ${image.medium} 800w, ${image.large} 1200w`}
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt={image.alt}
  loading="lazy"
  decoding="async"
  width={1200}
  height={800}
/>

// LQIP (Low Quality Image Placeholder) a WebP
function ProgressiveImage({ src, blurHash, alt }: { src: string; blurHash: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden bg-gray-200">
      <canvas
        ref={r => { if (r) drawBlurHash(r, blurHash); }}
        className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

// AVIF/WebP fallback
<picture>
  <source srcSet={image.avif} type="image/avif" />
  <source srcSet={image.webp} type="image/webp" />
  <img src={image.fallback} alt={image.alt} />
</picture>

// Icon SVGs inline (evita requests)
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" />
    </svg>
  );
}
```

## Prevent Unnecessary Re-renders

```tsx
// PROBLEMA: Inline objects = nuevos refs cada render
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <>
      <MemoChild style={{ color: 'red' }} />          // MAL: nuevo objeto cada render
      <MemoChild items={data.filter(x => x.active)} /> // MAL: nuevo array cada render
      <button onClick={() => setCount(count + 1)}>    // MAL: nueva funcion cada render
        Increment
      </button>
    </>
  );
}

// SOLUCION 1: Extraer fuera del componente
const CHILD_STYLE = { color: 'red' } as const;

// SOLUCION 2: useMemo para computaciones caras
const activeItems = useMemo(() => data.filter(x => x.active), [data]);

// SOLUCION 3: useCallback para funciones pasadas a memo
const increment = useCallback(() => setCount(c => c + 1), []);

function ParentFixed() {
  return (
    <>
      <MemoChild style={CHILD_STYLE} />
      <MemoChild items={activeItems} />
      <button onClick={increment}>Increment</button>
    </>
  );
}

// SOLUCION 4: Extraer a componente (mejor que useMemo en muchos casos)
function ItemList({ data }: { data: Item[] }) {
  const activeItems = data.filter(x => x.active); // se recalcula solo cuando data cambia
  return <MemorizedList items={activeItems} />;
}

// SOLUCION 5: Children como composicion (evita renders del padre)
function ParentComposition() {
  const [count, setCount] = useState(0);

  return (
    <ExpensiveWrapper>
      <CheapContent count={count} />         // ExpensiveWrapper NO se re-renderiza
    </ExpensiveWrapper>
  );
}
// ExpensiveWrapper recibe children como prop → no se re-renderiza si children no cambia
```

## Production Build Optimization

```tsx
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-transform-remove-console'], // solo en produccion
      },
    }),
    visualizer({ open: true }), // analiza el bundle
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react')) return 'react-vendor';
          if (id.includes('node_modules/@tanstack')) return 'query-vendor';
          if (id.includes('node_modules/recharts')) return 'charts';
        },
      },
    },
    chunkSizeWarningLimit: 500, // KB
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
  },
});
```
