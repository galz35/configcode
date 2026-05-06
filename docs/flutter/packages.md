# Flutter Packages Deep Dive

Paquetes imprescindibles para produccion y como usarlos correctamente.

## Dio (HTTP Client)

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.4.0
  retrofit: ^4.0.0
  retrofit_generator: ^8.0.0  # dev
  build_runner: ^2.4.0         # dev
```

```dart
// dio_client.dart - Cliente HTTP con interceptores
import 'package:dio/dio.dart';

class ApiClient {
  late final Dio dio;
  final _authInterceptor = AuthInterceptor();

  ApiClient({required String baseUrl}) {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
      validateStatus: (status) => status != null && status < 500,
    ));

    dio.interceptors.addAll([
      _authInterceptor,
      LogInterceptor(requestBody: true, responseBody: true, logPrint: (o) => debugPrint(o.toString())),
      RetryInterceptor(dio: dio, retries: 3, retryDelays: const [
        Duration(seconds: 1), Duration(seconds: 2), Duration(seconds: 5),
      ]),
    ]);
  }

  void setToken(String? token) => _authInterceptor.token = token;
}

// auth_interceptor.dart - Token refresh automatico
class AuthInterceptor extends Interceptor {
  String? token;
  bool _isRefreshing = false;
  final _failedQueue = <({RequestOptions options, ErrorInterceptorHandler handler})>[];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401 || _isRefreshing) {
      // Queue the request if already refreshing
      if (_isRefreshing && err.response?.statusCode == 401) {
        _failedQueue.add((options: err.requestOptions, handler: handler));
        return;
      }
      handler.next(err);
      return;
    }

    _isRefreshing = true;
    try {
      final newToken = await refreshToken();
      token = newToken;

      // Retry the original request
      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final response = await dio.fetch(err.requestOptions);
      handler.resolve(response);

      // Process queued requests
      for (var req in _failedQueue) {
        req.options.headers['Authorization'] = 'Bearer $newToken';
        final res = await dio.fetch(req.options);
        req.handler.resolve(res);
      }
    } catch (e) {
      handler.reject(err);
      for (var req in _failedQueue) { req.handler.reject(err); }
    } finally {
      _isRefreshing = false;
      _failedQueue.clear();
    }
  }
}

// retry_interceptor.dart
class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int retries;
  final List<Duration> retryDelays;

  RetryInterceptor({required this.dio, this.retries = 3, required this.retryDelays});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (_shouldRetry(err) && (err.requestOptions.extra['retryCount'] ?? 0) < retries) {
      final retryCount = (err.requestOptions.extra['retryCount'] ?? 0) + 1;
      err.requestOptions.extra['retryCount'] = retryCount;

      final delay = retryDelays[retryCount - 1];
      await Future.delayed(delay);

      try {
        final response = await dio.fetch(err.requestOptions);
        handler.resolve(response);
      } catch (e) {
        handler.next(err);
      }
    } else {
      handler.next(err);
    }
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
           err.type == DioExceptionType.receiveTimeout ||
           err.type == DioExceptionType.connectionError ||
           (err.response?.statusCode != null && err.response!.statusCode! >= 500);
  }
}

// Uso con Retrofit (generacion de codigo)
// @RestApi(baseUrl: 'https://api.example.com/v1')
// abstract class UserApi {
//   factory UserApi(Dio dio) = _UserApi;
//   @GET('/users') Future<List<User>> getUsers();
//   @POST('/users') Future<User> createUser(@Body() CreateUserDto dto);
// }
```

## Riverpod (State Management Avanzado)

```yaml
dependencies:
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0
dev_dependencies:
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
```

```dart
// providers/auth_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_provider.g.dart'; // generado

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  AsyncValue<User?> build() {
    // Check stored session on start
    final stored = ref.watch(localStorageProvider).getString('token');
    if (stored != null) {
      ref.watch(userRepositoryProvider).getMe().then(
        (user) => state = AsyncData(user),
        onError: (e, _) => state = const AsyncData(null),
      );
    }
    return const AsyncData(null);
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final res = await ref.read(authRepositoryProvider).login(email, password);
      await ref.read(localStorageProvider).setString('token', res.token);
      return res.user;
    });
  }

  Future<void> logout() async {
    await ref.read(localStorageProvider).clear();
    state = const AsyncData(null);
  }
}

// providers/user_provider.dart - Familia (parametrizado)
@riverpod
Future<User> user(UserRef ref, String userId) async {
  final repo = ref.watch(userRepositoryProvider);
  return repo.getUser(userId);
}

// providers/product_provider.dart - Lista con paginacion
@riverpod
class ProductList extends _$ProductList {
  int _page = 0;
  bool _hasMore = true;

  @override
  Future<List<Product>> build({String? category}) async {
    _page = 1;
    final result = await ref.read(productRepositoryProvider).getProducts(
      page: _page, category: category,
    );
    _hasMore = result.hasMore;
    return result.items;
  }

  Future<void> loadMore() async {
    if (!_hasMore || state is AsyncLoading) return;

    final current = state.valueOrNull ?? [];
    state = AsyncData(current); // keep current data

    _page++;
    final result = await ref.read(productRepositoryProvider).getProducts(
      page: _page,
      category: category, // from build() param
    );
    _hasMore = result.hasMore;
    state = AsyncData([...current, ...result.items]);
  }
}

// providers/cart_provider.dart - Provider standalone
final cartProvider = NotifierProvider<CartNotifier, CartState>(CartNotifier.new);

class CartNotifier extends Notifier<CartState> {
  @override
  CartState build() => const CartState();

  void addItem(Product product, {int quantity = 1}) {
    final items = Map<String, int>.from(state.items);
    items.update(product.id, (qty) => qty + quantity, ifAbsent: () => quantity);

    final productMap = Map<String, Product>.from(state.products);
    productMap[product.id] = product;

    state = state.copyWith(items: items, products: productMap);
  }

  void removeItem(String productId) {
    final items = Map<String, int>.from(state.items);
    items.remove(productId);
    final productMap = Map<String, Product>.from(state.products);
    productMap.remove(productId);
    state = state.copyWith(items: items, products: productMap);
  }

  double get total {
    return state.items.entries.fold(
      0, (sum, e) => sum + (state.products[e.key]?.price ?? 0) * e.value,
    );
  }
}

// Widget: Usar providers
class UserScreen extends ConsumerWidget {
  const UserScreen({super.key, required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(userProvider(userId));

    return userAsync.when(
      loading: () => const CircularProgressIndicator(),
      error: (e, _) => ErrorView(message: e.toString(), onRetry: () => ref.invalidate(userProvider(userId))),
      data: (user) => UserDetailView(user: user),
    );
  }
}

// Widget: Scroll infinito con paginacion
class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({super.key, this.category});
  final String? category;

  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      ref.read(productListProvider(category: widget.category).notifier).loadMore();
    }
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(productListProvider(category: widget.category));

    return productAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorView(message: e.toString()),
      data: (products) => ListView.builder(
        controller: _scrollCtrl,
        itemCount: products.length + 1,
        itemBuilder: (_, i) {
          if (i == products.length) {
            return const Center(child: CircularProgressIndicator());
          }
          return ProductCard(product: products[i]);
        },
      ),
    );
  }
}
```

## GoRouter (Navegacion Avanzada)

```yaml
dependencies:
  go_router: ^13.0.0
```

```dart
// router.dart
import 'package:go_router/go_router.dart';

final router = GoRouter(
  initialLocation: '/',
  debugLogDiagnostics: true,

  // Auth redirect
  redirect: (context, state) {
    final isLoggedIn = ref.read(authProvider).valueOrNull != null;
    final isAuthRoute = state.matchedLocation.startsWith('/auth');

    if (!isLoggedIn && !isAuthRoute) return '/auth/login';
    if (isLoggedIn && isAuthRoute) return '/';
    return null;
  },

  // Error page
  errorBuilder: (context, state) => NotFoundScreen(error: state.error),

  routes: [
    // Auth routes (no shell)
    GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/auth/register', builder: (_, __) => const RegisterScreen()),

    // Main app shell (bottom nav)
    ShellRoute(
      builder: (_, __, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const HomeScreen(),
          routes: [
            GoRoute(
              path: 'product/:id',
              builder: (_, state) => ProductDetailScreen(
                id: state.pathParameters['id']!,
              ),
            ),
            GoRoute(
              path: 'user/:id',
              builder: (_, state) => UserScreen(id: state.pathParameters['id']!),
              routes: [
                GoRoute(
                  path: 'settings',
                  builder: (_, state) => UserSettingsScreen(
                    userId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
          ],
        ),
        GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
        GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      ],
    ),
  ],
);

// shell.dart - Bottom navigation
class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  int _calculateIndex(GoRouterState state) {
    if (state.matchedLocation.startsWith('/search')) return 1;
    if (state.matchedLocation.startsWith('/cart')) return 2;
    if (state.matchedLocation.startsWith('/profile')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _calculateIndex(GoRouterState.of(context));

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0: context.go('/'); break;
            case 1: context.go('/search'); break;
            case 2: context.go('/cart'); break;
            case 3: context.go('/profile'); break;
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
          NavigationDestination(icon: Icon(Icons.shopping_cart), label: 'Cart'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

// Deep link handling
// Android: AndroidManifest.xml
// <meta-data android:name="flutter_deeplinking_enabled" android:value="true" />
// <intent-filter>
//   <action android:name="android.intent.action.VIEW" />
//   <data android:scheme="https" android:host="myapp.com" />
// </intent-filter>

// iOS: Info.plist
// <key>FlutterDeepLinkingEnabled</key><true/>
```

## Drift (SQLite Local Database)

```yaml
dependencies:
  drift: ^2.17.0
  sqlite3_flutter_libs: ^0.5.0
dev_dependencies:
  drift_dev: ^2.17.0
  build_runner: ^2.4.0
```

```dart
// database.dart
import 'dart:io';
import 'package:drift/native.dart';
import 'package:drift/drift.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

part 'database.g.dart';

// Tabla: Users
class Users extends Table {
  TextColumn get id => text()();
  TextColumn get email => text()();
  TextColumn get name => text()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();
  DateTimeColumn get deletedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

// DAO: UserDao
@DriftAccessor(tables: [Users])
class UserDao extends DatabaseAccessor<AppDatabase> with _$UserDaoMixin {
  UserDao(super.db);

  Future<List<User>> getAllUsers() => select(users).get();
  Future<User?> getUserById(String id) => (select(users)..where((u) => u.id.equals(id))).getSingleOrNull();
  Stream<List<User>> watchAllUsers() => select(users).watch();
  Future<int> insertUser(Insertable<User> user) => into(users).insert(user);
  Future<bool> updateUser(Insertable<User> user) => update(users).replace(user);
  Future<int> deleteUser(String id) => (delete(users)..where((u) => u.id.equals(id))).go();

  // Query personalizada
  Future<List<User>> searchUsers(String query) {
    return (select(users)
      ..where((u) => u.name.like('%$query%') | u.email.like('%$query%'))
      ..where((u) => u.deletedAt.isNull())
      ..orderBy([(u) => OrderingTerm(expression: u.name)]))
    .get();
  }
}

// Database
@DriftDatabase(tables: [Users], daos: [UserDao])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      await m.createAll();
    },
    onUpgrade: (m, from, to) async {},
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'app.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

// Provider
final databaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(() => db.close());
  return db;
});

final userDaoProvider = Provider<UserDao>((ref) {
  return ref.watch(databaseProvider).userDao;
});
```

## Freezed (Data Classes)

```yaml
dependencies:
  freezed_annotation: ^2.4.0
  json_annotation: ^4.9.0
dev_dependencies:
  freezed: ^2.5.0
  json_serializable: ^6.8.0
  build_runner: ^2.4.0
```

```dart
// user.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user.freezed.dart';
part 'user.g.dart';

@freezed
class User with _$User {
  const factory User({
    required String id,
    required String email,
    required String name,
    @Default('user') String role,
    required DateTime createdAt,
    DateTime? deletedAt,
  }) = _User;

  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
}

// Union/sealed class para estados
@freezed
sealed class AsyncState<T> with _$AsyncState<T> {
  const factory AsyncState.initial() = _Initial<T>;
  const factory AsyncState.loading() = _Loading<T>;
  const factory AsyncState.data(T data) = _Data<T>;
  const factory AsyncState.error(String message) = _Error<T>;
}

// Build runner para generar codigo
// dart run build_runner build --delete-conflicting-outputs
```

## Hive (Key-Value Storage Rapido)

```dart
// Inicializar
await Hive.initFlutter();
Hive.registerAdapter(UserAdapter());
Hive.registerAdapter(PreferencesAdapter());

final userBox = await Hive.openBox<User>('users');
final settingsBox = await Hive.openBox<dynamic>('settings');

// Usar
settingsBox.put('isDarkMode', true);
settingsBox.put('lastSync', DateTime.now().toIso8601String());
final isDark = settingsBox.get('isDarkMode', defaultValue: false);

// Escuchar cambios (reactivo)
settingsBox.watch(key: 'isDarkMode').listen((event) {
  // Responder a cambios de configuracion
});
```

## JsonSerializable (Auto serializacion)

```dart
// Cuando no usas freezed, usa json_serializable solo
@JsonSerializable(explicitToJson: true)
class Product {
  final String id;
  final String name;
  final double price;
  @JsonKey(name: 'category_id') final String categoryId;
  @JsonKey(name: 'created_at') final DateTime createdAt;
  @JsonKey(includeFromJson: false, includeToJson: false) final bool isSelected;

  const Product({required this.id, required this.name, required this.price, ...});

  factory Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);
  Map<String, dynamic> toJson() => _$ProductToJson(this);
}
```
