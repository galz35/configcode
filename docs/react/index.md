# React + TypeScript Reference

## Table of Contents
- [Component Patterns](#component-patterns)
- [Hooks Reference](#hooks-reference)
- [State Management](#state-management)
- [TypeScript Patterns](#typescript-patterns)
- [Performance](#performance)
- [Routing (React Router v6+)](#routing)
- [Forms](#forms)
- [API Handling](#api-handling)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Common Pitfalls](#common-pitfalls)

---

## Component Patterns

### Functional Component Template

```tsx
import { type FC, type ReactNode } from 'react';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
  onClick?: () => void;
}

export const Button: FC<ButtonProps> = ({
  variant,
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
}) => {
  const baseClasses = 'rounded font-medium transition-colors focus:outline-none focus:ring-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};
```

### Compound Component Pattern

```tsx
interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs compound components must be used within <Tabs>');
  return ctx;
};

const Tabs: FC<{ defaultTab: string; children: ReactNode }> & {
  List: typeof TabsList;
  Tab: typeof Tab;
  Panel: typeof TabPanel;
} = ({ defaultTab, children }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

const TabsList: FC<{ children: ReactNode }> = ({ children }) => (
  <div role="tablist" className="flex border-b">{children}</div>
);

const Tab: FC<{ id: string; children: ReactNode }> = ({ id, children }) => {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button
      role="tab"
      aria-selected={activeTab === id}
      className={`px-4 py-2 ${activeTab === id ? 'border-b-2 border-blue-500' : ''}`}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
};

const TabPanel: FC<{ id: string; children: ReactNode }> = ({ id, children }) => {
  const { activeTab } = useTabs();
  if (activeTab !== id) return null;
  return <div role="tabpanel">{children}</div>;
};

Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
```

### Render Props Pattern

```tsx
interface DataFetcherProps<T> {
  url: string;
  children: (data: { data: T | null; loading: boolean; error: Error | null; refetch: () => void }) => ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return <>{children({ data, loading, error, refetch: fetchData })}</>;
}
```

### HOC Pattern

```tsx
function withAuth<P extends object>(Component: FC<P>, requiredRole?: string) {
  const Wrapped: FC<P> = (props) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!loading && !user) navigate('/login');
      if (!loading && requiredRole && user?.role !== requiredRole) navigate('/unauthorized');
    }, [loading, user, navigate]);

    if (loading || !user) return <FullPageSpinner />;
    if (requiredRole && user.role !== requiredRole) return null;

    return <Component {...props} />;
  };

  Wrapped.displayName = `withAuth(${Component.displayName ?? Component.name})`;
  return Wrapped;
}

const AdminDashboard = withAuth(DashboardPage, 'admin');
```

---

## Hooks Reference

### useState

```tsx
// Lazy initialization for expensive computation
const [items, setItems] = useState<Item[]>(() => {
  const saved = localStorage.getItem('items');
  return saved ? JSON.parse(saved) : [];
});

// Functional update when new state depends on previous
setItems(prev => [...prev, newItem]);

// Batch updates in async handlers
const handleSubmit = async () => {
  setLoading(true);   // React 18+ auto-batches these
  setError(null);     // into a single re-render
  try {
    await save(data);
    setSuccess(true);
  } catch {
    setError('Failed');
  } finally {
    setLoading(false);
  }
};
```

### useEffect

```tsx
// Effect with cleanup
useEffect(() => {
  const controller = new AbortController();
  
  fetch(`/api/users/${id}`, { signal: controller.signal })
    .then(r => r.json())
    .then(setUser)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });
    
  return () => controller.abort();
}, [id]);

// Effect that runs once on mount
useEffect(() => {
  analytics.pageView(window.location.pathname);
}, []); // empty deps = mount only

// Effect with deep comparison for objects
const params = useMemo(() => ({ filter, sort, page }), [filter, sort, page]);
useEffect(() => {
  fetchData(params);
}, [params]); // params is memoized = stable reference
```

### useRef

```tsx
// DOM reference
const inputRef = useRef<HTMLInputElement>(null);
const focusInput = () => inputRef.current?.focus();

// Mutable value that persists without re-renders
const renderCount = useRef(0);
renderCount.current++;

// Previous value tracker
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}

// Interval with stable callback
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

### useMemo

```tsx
// Compute derived data only when deps change
const sortedUsers = useMemo(
  () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
  [users]
);

// Memoize expensive filtering
const filtered = useMemo(() => {
  return items
    .filter(item => item.price >= minPrice)
    .filter(item => item.price <= maxPrice)
    .filter(item => searchTerm === '' || item.name.includes(searchTerm));
}, [items, minPrice, maxPrice, searchTerm]);

// When NOT to useMemo: cheap computations, new props on every render
// BAD: const doubled = useMemo(() => n * 2, [n]); // just compute inline
// BAD: <Item data={useMemo(() => ({ id }), [id])} /> // still new object!
```

### useCallback

```tsx
// Stabilize function reference for child memo components
const handleDelete = useCallback((id: string) => {
  setItems(prev => prev.filter(item => item.id !== id));
}, []); // no deps = stable forever

// When deps are needed, it still changes when deps change
const handleFilter = useCallback((term: string) => {
  setResults(allItems.filter(i => i.name.includes(term)));
}, [allItems]); // changes when allItems changes
```

### useReducer

```tsx
type State = { count: number; loading: boolean; error: string | null };
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set_loading'; payload: boolean }
  | { type: 'set_error'; payload: string };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + 1, error: null };
    case 'decrement': return { ...state, count: state.count - 1, error: null };
    case 'set_loading': return { ...state, loading: action.payload };
    case 'set_error': return { ...state, error: action.payload, loading: false };
    default: return state;
  }
};

const [state, dispatch] = useReducer(reducer, { count: 0, loading: false, error: null });
// dispatch({ type: 'increment' });
```

### useDeferredValue / useTransition (React 18+)

```tsx
// Defer non-urgent state update (keeps UI responsive)
const [query, setQuery] = useState('');
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => filterMassiveList(deferredQuery), [deferredQuery]);

// Explicit transition
const [isPending, startTransition] = useTransition();
const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
  setQuery(e.target.value); // urgent: update input
  startTransition(() => {
    setFilteredResults(search(e.target.value)); // non-urgent: filter
  });
};
// {isPending && <Spinner />} // show while filtering
```

### useId (React 18+)

```tsx
// Generate unique IDs for accessibility (SSR-safe)
const FormField: FC<{ label: string }> = ({ label }) => {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={`${id}-error`} />
    </>
  );
};
```

### Custom Hooks

```tsx
// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Local storage sync hook
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

// API fetch hook
function useFetch<T>(url: string) {
  const [state, dispatch] = useReducer(
    (s: FetchState<T>, a: Partial<FetchState<T>>) => ({ ...s, ...a }),
    { data: null, loading: true, error: null }
  );

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ loading: true });
    
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => dispatch({ data, loading: false }))
      .catch(err => {
        if (err.name !== 'AbortError') dispatch({ error: err, loading: false });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
```

---

## State Management

### Context + useReducer (lightweight global state)

```tsx
// store.tsx
interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  cart: CartItem[];
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'TOGGLE_THEME' }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string };

const initialState: AppState = { user: null, theme: 'light', cart: [] };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload };
    case 'TOGGLE_THEME': return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    case 'ADD_TO_CART': return { ...state, cart: [...state.cart, action.payload] };
    case 'REMOVE_FROM_CART': return { ...state, cart: state.cart.filter(i => i.id !== action.payload) };
    default: return state;
  }
}

// Split dispatch contexts to avoid re-renders
const StateContext = createContext<AppState>(initialState);
const DispatchContext = createContext<Dispatch<AppAction>>(() => {});

const AppProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

const useAppState = () => useContext(StateContext);
const useAppDispatch = () => useContext(DispatchContext);

// Selector hook to avoid full re-renders
function useSelector<T>(selector: (state: AppState) => T): T {
  const state = useContext(StateContext);
  return useMemo(() => selector(state), [state, selector]);
}
```

### Zustand

```tsx
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface BearState {
  bears: number;
  increase: (by?: number) => void;
  decrease: (by?: number) => void;
  reset: () => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        bears: 0,
        increase: (by = 1) => set((state) => ({ bears: state.bears + by })),
        decrease: (by = 1) => set((state) => ({ bears: Math.max(0, state.bears - by) })),
        reset: () => set({ bears: 0 }),
      }),
      { name: 'bear-storage' }
    ),
    { name: 'BearStore' }
  )
);

// Usage: selective subscription to avoid re-renders
const bears = useBearStore((s) => s.bears);
const increase = useBearStore((s) => s.increase);
```

### TanStack Query (React Query) for server state

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query with caching, background refetch, stale time
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => fetch(`/api/users/${userId}`).then(r => r.json()),
  staleTime: 5 * 60 * 1000, // fresh for 5 min
  enabled: !!userId,        // don't run if no userId
  retry: 3,
});

// Mutation with optimistic update
const mutation = useMutation({
  mutationFn: (newUser: CreateUserDTO) =>
    fetch('/api/users', { method: 'POST', body: JSON.stringify(newUser) }).then(r => r.json()),
  onMutate: async (newUser) => {
    await queryClient.cancelQueries({ queryKey: ['users'] });
    const previous = queryClient.getQueryData(['users']);
    queryClient.setQueryData(['users'], (old: User[]) => [...old, { ...newUser, id: 'temp' }]);
    return { previous };
  },
  onError: (err, newUser, context) => {
    queryClient.setQueryData(['users'], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});

// Infinite scroll
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['feed'],
  queryFn: ({ pageParam = 0 }) => fetch(`/api/feed?cursor=${pageParam}`).then(r => r.json()),
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  initialPageParam: 0,
});
```

---

## TypeScript Patterns

### Generic Components

```tsx
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T) => string;
  emptyState?: ReactNode;
}

function List<T>({ items, renderItem, keyExtractor, emptyState }: ListProps<T>) {
  if (items.length === 0) return <>{emptyState ?? <p>No items</p>}</>;
  return (
    <ul>
      {items.map((item, idx) => (
        <li key={keyExtractor(item)}>{renderItem(item, idx)}</li>
      ))}
    </ul>
  );
}

// Usage: List<User> with inferred T
<List
  items={users}
  renderItem={(user) => <UserCard user={user} />}
  keyExtractor={(user) => user.id}
/>
```

### Discriminated Unions for Component State

```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function AsyncView<T>({ state }: { state: AsyncState<T> }) {
  switch (state.status) {
    case 'idle':    return <p>Click to load</p>;
    case 'loading': return <Spinner />;
    case 'error':   return <ErrorBanner message={state.error.message} />;
    case 'success': return <DataView data={state.data} />;
  }
}
```

### Polymorphic Component (as prop)

```tsx
type PolymorphicProps<T extends ElementType = 'div'> = {
  as?: T;
  children: ReactNode;
} & ComponentPropsWithoutRef<T>;

function Box<T extends ElementType = 'div'>({ as, children, ...props }: PolymorphicProps<T>) {
  const Component = as ?? 'div';
  return <Component {...props}>{children}</Component>;
}

// Usage:
<Box as="button" type="button" onClick={handleClick}>Click</Box>
<Box as="section" aria-label="Main">Content</Box>
```

### Template Literal Types for CSS

```tsx
type Color = 'red' | 'blue' | 'green' | 'yellow';
type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type TailwindColor = `${Color}-${Shade}`;
// 'red-500' | 'blue-700' | ...

type Spacing = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16';
type Direction = 't' | 'r' | 'b' | 'l' | 'x' | 'y' | '';
type Margin = `m${Direction}-${Spacing}` | `m${Direction}-auto`;
```

### Utility Types for Props

```tsx
// Require at least one of two props
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>> }[Keys];

interface AlertProps {
  message?: string;
  children?: ReactNode;
  variant: 'info' | 'warning' | 'error';
}
// type Alert = RequireAtLeastOne<AlertProps, 'message' | 'children'>;

// Omit never types from an object
type NonNullableProps<T> = {
  [K in keyof T as T[K] extends null | undefined ? never : K]: T[K];
};

// Deep Partial
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// Prettify to show all properties in hover
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

---

## Performance

### React.memo

```tsx
const ExpensiveList = memo(function ExpensiveList({ items }: { items: Item[] }) {
  return items.map(item => <ExpensiveItem key={item.id} item={item} />);
}, (prev, next) => prev.items.length === next.items.length);

// Memo + useCallback for stable props
const Parent = () => {
  const [count, setCount] = useState(0);
  
  // Without useCallback, onPress changes every render = memo breaks
  const onPress = useCallback((id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, active: !i.active } : i));
  }, []); // empty = stable forever
  
  return <MemoChild onPress={onPress} />;
};

const MemoChild = memo(({ onPress }: { onPress: (id: string) => void }) => {
  return <button onClick={() => onPress('abc')}>Toggle</button>;
});
```

### Virtualization for long lists

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div
            key={vItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${vItem.size}px`,
              transform: `translateY(${vItem.start}px)`,
            }}
          >
            <ItemComponent item={items[vItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Code Splitting / Lazy Loading

```tsx
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// Prefetch on hover/intent
const onMouseEnter = () => {
  const module = import('./pages/AdminDashboard');
};

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Error boundary for lazy components
import { ErrorBoundary } from 'react-error-boundary';
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<Spinner />}>
    <LazyComponent />
  </Suspense>
</ErrorBoundary>
```

### Image Optimization

```tsx
function OptimizedImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  return (
    <div className="relative overflow-hidden bg-gray-200">
      {!loaded && !error && <Skeleton className="absolute inset-0 animate-pulse" />}
      {error && <BrokenImageIcon className="absolute inset-0" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"   // native lazy loading
        decoding="async" // decode off main thread
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        {...props}
      />
    </div>
  );
}
```

### Avoiding Common Performance Issues

```tsx
// BAD: Creating objects/arrays in JSX = new refs every render
<Child style={{ color: 'red' }} />
<Child items={data.filter(x => x.active)} />

// GOOD: Memoize or define outside component
const CHILD_STYLE = { color: 'red' } as const;
const activeItems = useMemo(() => data.filter(x => x.active), [data]);
<Child style={CHILD_STYLE} />
<Child items={activeItems} />

// BAD: Inline function = new ref every render
<button onClick={() => handleClick(id)}>Click</button>

// GOOD: useCallback or data attributes
<button onClick={handleClick} data-id={id}>Click</button>
// OR extract to component:
<ItemButton id={id} onClick={handleClick} />
```

---

## Routing (React Router v6+)

```tsx
import { 
  createBrowserRouter, RouterProvider, Outlet,
  useParams, useSearchParams, useNavigate, useLocation,
  NavLink, Navigate
} from 'react-router-dom';

// Data router (Loader/Action pattern)
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
        loader: async () => {
          const stats = await fetch('/api/stats').then(r => r.json());
          return { stats };
        },
      },
      {
        path: 'users',
        element: <UsersLayout />,
        loader: () => fetch('/api/users').then(r => r.json()),
        children: [
          {
            index: true,
            element: <UserList />,
          },
          {
            path: ':userId',
            element: <UserDetail />,
            loader: ({ params }) => fetch(`/api/users/${params.userId}`).then(r => r.json()),
            action: async ({ request, params }) => {
              const formData = await request.formData();
              return updateUser(params.userId!, Object.fromEntries(formData));
            },
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/old-route',
    element: <Navigate to="/new-route" replace />,
  },
]);

// Hook usage
function UserDetail() {
  const { userId } = useParams<{ userId: string }>();   // :userId from path
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const loaderData = useLoaderData() as User;
  const actionData = useActionData() as ActionResponse | undefined;
  
  const tab = searchParams.get('tab') ?? 'profile';     // /user/1?tab=settings
  
  const goBack = () => navigate(-1);
  const goToSettings = () => navigate(`/users/${userId}/settings`);
  const switchTab = (tab: string) => setSearchParams({ tab });
}
```

---

## Forms

### React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login(data);
      if (!result.ok) {
        setError('root', { message: 'Invalid credentials' });
      }
    } catch {
      setError('root', { message: 'Network error. Try again.' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} />
        {errors.email && <span role="alert">{errors.email.message}</span>}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...register('password')} />
        {errors.password && <span role="alert">{errors.password.message}</span>}
      </div>
      <div>
        <input id="remember" type="checkbox" {...register('rememberMe')} />
        <label htmlFor="remember">Remember me</label>
      </div>
      {errors.root && <div role="alert" className="error">{errors.root.message}</div>}
      <button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

---

## API Handling

### HTTP Client with axios + interceptors

```tsx
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: refresh token on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken } = await refreshToken();
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        logoutUser();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Testing

### Component Tests with Testing Library

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Test wrapper
function AllProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

// Custom render
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

describe('LoginForm', () => {
  it('shows validation errors for empty fields', async () => {
    customRender(<LoginForm />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
  });

  it('calls onSubmit with form data', async () => {
    const onSubmit = vi.fn();
    customRender(<LoginForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'password123',
        rememberMe: false,
      });
    });
  });

  it('shows loading state during submission', async () => {
    const onSubmit = vi.fn(() => new Promise(r => setTimeout(r, 100)));
    customRender(<LoginForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByRole('button')).toBeDisabled();
  });
});

// Async testing
describe('UserList', () => {
  it('renders users after fetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: '1', name: 'Alice' }]),
    } as Response);

    customRender(<UserList />);

    expect(screen.getByRole('status')).toBeInTheDocument(); // loading
    
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Alice');
  });

  it('shows error state', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    customRender(<UserList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });
});
```

### Hook Testing

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { AllProviders } from '../test-utils';

describe('useFetch', () => {
  it('returns loading then data', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    } as Response);

    const { result } = renderHook(() => useFetch('/api/test'), {
      wrapper: AllProviders,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 1 });
  });

  it('handles errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Fail'));

    const { result } = renderHook(() => useFetch('/api/test'), {
      wrapper: AllProviders,
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
```

---

## Project Structure

```
src/
  features/              # Feature-based modules
    auth/
      components/        # Feature-specific components
      hooks/             # Feature-specific hooks
      api/               # Feature-specific API calls
      types/             # Feature-specific types
      utils/             # Feature-specific utilities
      __tests__/         # Feature-specific tests
      index.ts           # Public API barrel export
  shared/                # Shared across features
    components/          # Generic UI components (Button, Modal, etc.)
    hooks/               # Shared hooks (useDebounce, useMediaQuery, etc.)
    utils/               # Pure utility functions
    types/               # Shared TypeScript types
    constants/           # App-wide constants
  lib/                   # Third-party lib configurations
    api.ts               # Axios/fetch setup
    query-client.ts      # React Query config
    router.tsx           # Router configuration
  layouts/               # Layout components
  pages/                 # Page-level components (thin wrappers)
  App.tsx                # Root component
  main.tsx               # Entry point
  vite-env.d.ts          # Vite type declarations
```

---

## Common Pitfalls

### State Update Timing
```tsx
// BAD: Reading stale closure
const [count, setCount] = useState(0);
const handleClick = () => {
  setCount(count + 1);  // count is stale in closures
  setCount(count + 1);  // still uses old count
};
// After one click, count = 1 (not 2)

// GOOD: Functional update
setCount(prev => prev + 1);
setCount(prev => prev + 1); // count = 2
```

### useEffect Infinite Loop
```tsx
// BAD: Object/array as dependency (new reference each render)
useEffect(() => {
  fetchData({ userId, filter: 'active' });
}, [{ userId, filter: 'active' }]); // RUNS EVERY RENDER!

// GOOD: Primitive deps
useEffect(() => {
  fetchData({ userId, filter: 'active' });
}, [userId]); // only when userId changes

// OR: Memoize the object
const params = useMemo(() => ({ userId, filter: 'active' }), [userId]);
useEffect(() => { fetchData(params); }, [params]);
```

### Conditional Hook Calls
```tsx
// BAD: Hooks must be at top level, never in conditions/loops
if (loading) {
  const data = useFetch(); // CRASHES
}

// GOOD: Early return AFTER hooks
const data = useFetch();
if (loading) return <Spinner />;
```

### Refs During Render
```tsx
// BAD: Setting ref during render (unpredictable)
const [items, setItems] = useState([]);
if (items.length === 0) {
  ref.current = 'empty'; // NEVER do this during render
}

// GOOD: Use useEffect for side effects
useEffect(() => {
  if (items.length === 0) ref.current = 'empty';
}, [items]);
```

### Ignoring AbortController
```tsx
// BAD: No cleanup = memory leaks, state on unmounted component
useEffect(() => {
  fetch(url).then(setData);
}, [url]);

// GOOD: Always cleanup async operations
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(err => { if (err.name !== 'AbortError') throw err; });
  return () => controller.abort();
}, [url]);
```

### Prop Drilling
```tsx
// BAD: Passing props through many intermediate components
<Page>
  <Layout user={user} theme={theme}>
    <Header user={user}>
      <UserMenu user={user} theme={theme} /> {/* 4 levels deep */}
    </Header>
  </Layout>
</Page>

// GOOD: Context for truly global state, composition for everything else
<Page>
  <Layout>
    <Header>
      <UserMenu user={user} theme={theme} /> {/* Use context or pass directly */}
    </Header>
  </Layout>
</Page>
// Or use Zustand/Redux for global state
```
