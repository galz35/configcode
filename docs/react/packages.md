# React Packages Deep Dive

Librerias esenciales y como usarlas al maximo.

## TanStack Query v5 (Server State)

```typescript
// query-client.ts - Configuracion global
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min fresh
      gcTime: 30 * 60 * 1000,          // 30 min garbage collect (antes cacheTime)
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorMessage) {
        toast.error(query.meta.errorMessage as string);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _, __, mutation) => {
      if (mutation.meta?.errorMessage) {
        toast.error(mutation.meta.errorMessage as string);
      }
    },
  }),
});

// hooks/useUsers.ts - Hook especializado
export function useUsers(page: number) {
  return useQuery({
    queryKey: ['users', { page }],
    queryFn: () => usersApi.getAll(page),
    select: (data) => data.items,      // transforma la respuesta
    placeholderData: keepPreviousData, // mantiene datos viejos mientras carga nuevos
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getById(id),
    enabled: !!id,                      // no ejecuta si no hay id
  });
}

// Mutations con optimistic update
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDTO }) =>
      usersApi.update(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel queries in flight
      await queryClient.cancelQueries({ queryKey: ['users', id] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<User>(['users', id]);

      // Optimistic update
      queryClient.setQueryData(['users', id], (old: User) => ({
        ...old,
        ...data,
      }));

      return { previous };
    },

    onError: (err, { id }, context) => {
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(['users', id], context.previous);
      }
    },

    onSettled: (_, __, { id }) => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Infinite query para scroll infinito
export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => feedApi.getPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor ?? undefined,
  });
}

// Prefetch para navegacion rapida
export function usePrefetchUsers() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: ['users', { page: 1 }],
      queryFn: () => usersApi.getAll(1),
      staleTime: 60000,
    });
  };
}
// En el componente: const prefetch = usePrefetchUsers();
// <Link onMouseEnter={prefetch} to="/users">Users</Link>

// Mutation con formulario
export function useCreateUserForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
      navigate(`/users/${newUser.id}`);
    },
    onError: (error: ApiError) => {
      toast.error(error.message);
    },
  });
}
```

## Zustand (Client State)

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isLoading: false,

        login: async (email, password) => {
          set({ isLoading: true });
          try {
            const { user, token } = await authApi.login(email, password);
            set({ user, token, isLoading: false });
          } catch (error) {
            set({ isLoading: false });
            throw error;
          }
        },

        logout: () => {
          set({ user: null, token: null });
          // Tambien limpiar queries de TanStack
          queryClient.clear();
        },

        setUser: (user) => set({ user }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ token: state.token }), // solo persistir token
      }
    ),
    { name: 'AuthStore' }
  )
);

// stores/cart.store.ts - Con slices
interface CartSlice {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const createCartSlice: StateCreator<CartSlice> = (set, get) => ({
  items: [],
  get itemCount() { return get().items.reduce((sum, i) => sum + i.quantity, 0); },
  get total() { return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0); },

  addItem: (product, qty = 1) => set((state) => {
    const idx = state.items.findIndex(i => i.productId === product.id);
    if (idx >= 0) {
      const items = [...state.items];
      items[idx] = { ...items[idx], quantity: items[idx].quantity + qty };
      return { items };
    }
    return { items: [...state.items, { productId: product.id, name: product.name, price: product.price, quantity: qty }] };
  }),

  removeItem: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),

  clearCart: () => set({ items: [] }),
});

// stores/ui.store.ts - UI state
interface UISlice {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const createUISlice: StateCreator<UISlice> = (set) => ({
  sidebarOpen: true,
  theme: 'system',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
});

// Combinar slices
export const useAppStore = create<CartSlice & UISlice>()(
  devtools((...a) => ({
    ...createCartSlice(...a),
    ...createUISlice(...a),
  }))
);
```

## React Hook Form + Zod

```typescript
// schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

// types.ts
export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;

// components/forms/LoginForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';

export const LoginForm: FC = () => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
    mode: 'onBlur', // validar al salir del campo
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onError: (error: ApiError) => {
      if (error.statusCode === 401) {
        setError('root', { message: 'Invalid email or password' });
      } else if (error.errors) {
        // Errores de validacion del servidor por campo
        for (const [field, message] of Object.entries(error.errors)) {
          setError(field as keyof LoginForm, { message: message as string });
        }
      }
    },
  });

  const onSubmit = handleSubmit((data) => loginMutation.mutate(data));

  // Watch fields for dynamic UI
  const emailValue = watch('email');

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField
        label="Email"
        error={errors.email?.message}
      >
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          className={errors.email ? 'border-red-500' : ''}
        />
        {emailValue.length > 0 && !errors.email && (
          <CheckIcon className="text-green-500" />  // validacion en tiempo real
        )}
      </FormField>

      <FormField
        label="Password"
        error={errors.password?.message}
      >
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
        />
      </FormField>

      <label className="flex items-center gap-2">
        <input {...register('rememberMe')} type="checkbox" />
        Remember me
      </label>

      {errors.root && (
        <Alert variant="error">{errors.root.message}</Alert>
      )}

      <Button type="submit" loading={isSubmitting} disabled={loginMutation.isPending}>
        {loginMutation.isPending ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  );
};
```

## Axios Interceptors + Retry + Logging

```typescript
// lib/api.ts
import axios, { type AxiosError, type AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth interceptor
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response + refresh token interceptor
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config!;
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // Share refresh promise if already in progress
      if (!refreshPromise) {
        refreshPromise = authApi.refreshToken().then((t) => {
          const token = t.accessToken;
          useAuthStore.getState().setUser(t.user);
          refreshPromise = null;
          return token;
        }).catch((err) => {
          useAuthStore.getState().logout();
          refreshPromise = null;
          throw err;
        });
      }

      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }

    // Transform error to app-friendly format
    const appError: ApiError = {
      message: error.response?.data?.message || 'Network error',
      statusCode: error.response?.status ?? 0,
      errors: error.response?.data?.errors,
    };
    return Promise.reject(appError);
  }
);
```

## React Error Boundary

```typescript
// components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.props.onError?.(error, info);
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" className="p-8 text-center">
          <h2>Something went wrong</h2>
          <p className="text-gray-500">{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// con Suspense para lazy components
<ErrorBoundary onError={(e) => trackError(e)} fallback={<ErrorPage />}>
  <Suspense fallback={<PageSkeleton />}>
    <LazyAdminPanel />
  </Suspense>
</ErrorBoundary>
```

## React Router Data Router (v6.4+)

```typescript
// router.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    loader: async () => {
      const user = await authApi.getMe();
      return { user };
    },
    children: [
      {
        index: true,
        element: <Dashboard />,
        loader: async () => {
          const stats = await dashboardApi.getStats();
          return { stats };
        },
      },
      {
        path: 'users',
        element: <UsersLayout />,
        loader: ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page')) || 1;
          return queryClient.fetchQuery({
            queryKey: ['users', { page }],
            queryFn: () => usersApi.getAll(page),
          });
        },
        children: [
          { index: true, element: <UserList /> },
          {
            path: ':userId',
            element: <UserDetail />,
            loader: ({ params }) =>
              queryClient.ensureQueryData({
                queryKey: ['users', params.userId!],
                queryFn: () => usersApi.getById(params.userId!),
              }),
            action: async ({ request, params }) => {
              const formData = await request.formData();
              await usersApi.update(params.userId!, Object.fromEntries(formData));
              return null;
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
]);

// En App.tsx: <RouterProvider router={router} />
```
