# Flutter + Dart Reference

## Table of Contents
- [Widget Patterns](#widgets)
- [State Management](#state)
- [Navigation](#navigation)
- [Forms & Validation](#forms)
- [HTTP & API](#api)
- [Local Storage](#storage)
- [Platform Channels](#channels)
- [Animations](#animations)
- [Testing](#testing)
- [Project Structure](#structure)
- [Common Pitfalls](#pitfalls)
- [InheritedWidget & Data Flow](#inherited)
- [CustomPaint & CustomPainter](#custompainter)
- [Overlay & Tooltips](#overlay)
- [Keyboard & Focus Management](#keyboard)
- [Error Handling & Crash Reporting](#crash)

---

## Widget Patterns

### Stateless Widget Template

```dart
class UserCard extends StatelessWidget {
  final User user;
  final VoidCallback? onTap;

  const UserCard({
    super.key,
    required this.user,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundImage: NetworkImage(user.avatarUrl),
                radius: 24,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### Stateful Widget Pattern

```dart
class CounterScreen extends StatefulWidget {
  const CounterScreen({super.key});

  @override
  State<CounterScreen> createState() => _CounterScreenState();
}

class _CounterScreenState extends State<CounterScreen> {
  int _count = 0;

  @override
  void initState() {
    super.initState();
    // One-time setup: listeners, initial load, etc.
  }

  @override
  void dispose() {
    // Cleanup: cancel timers, close streams, dispose controllers
    super.dispose();
  }

  void _increment() {
    setState(() {
      _count++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Counter')),
      body: Center(
        child: Text('$_count', style: Theme.of(context).textTheme.displayLarge),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _increment,
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

### Common Layout Patterns

```dart
// ListView.builder for dynamic lists
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) {
    return ListTile(
      title: Text(items[index].title),
      trailing: const Icon(Icons.arrow_forward),
    );
  },
);

// GridView with SliverGrid
GridView.builder(
  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    childAspectRatio: 0.75,
    crossAxisSpacing: 12,
    mainAxisSpacing: 12,
  ),
  padding: const EdgeInsets.all(16),
  itemCount: products.length,
  itemBuilder: (context, index) => ProductCard(product: products[index]),
);

// CustomScrollView with Slivers
CustomScrollView(
  slivers: [
    SliverAppBar(
      title: const Text('Feed'),
      floating: true,
      snap: true,
      pinned: true,
    ),
    SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => FeedItem(item: feed[index]),
        childCount: feed.length,
      ),
    ),
  ],
);

// Stack for overlays
Stack(
  children: [
    Image.network(user.coverUrl, width: double.infinity, height: 200, fit: BoxFit.cover),
    Positioned(
      bottom: -30,
      left: 20,
      child: CircleAvatar(radius: 40, backgroundImage: NetworkImage(user.avatarUrl)),
    ),
  ],
);
```

---

## State Management

### Provider (ChangeNotifier)

```dart
// Model
class CartModel extends ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => List.unmodifiable(_items);
  int get itemCount => _items.length;
  double get total => _items.fold(0, (sum, item) => sum + item.price);

  void addItem(Product product, int quantity) {
    final existing = _items.indexWhere((item) => item.product.id == product.id);
    if (existing >= 0) {
      _items[existing] = _items[existing].copyWith(quantity: _items[existing].quantity + quantity);
    } else {
      _items.add(CartItem(product: product, quantity: quantity));
    }
    notifyListeners();
  }

  void removeItem(String productId) {
    _items.removeWhere((item) => item.product.id == productId);
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}

// Provide at top level
void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => CartModel(),
      child: const MyApp(),
    ),
  );
}

// Consume in widgets
class CartBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final count = context.watch<CartModel>().itemCount;  // rebuilds when count changes
    return Badge(count: count, child: const Icon(Icons.shopping_cart));
  }
}

class CartScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();

    return Scaffold(
      appBar: AppBar(title: Text('Cart (${cart.itemCount})')),
      body: cart.items.isEmpty
        ? const EmptyCartView()
        : ListView.builder(
            itemCount: cart.items.length,
            itemBuilder: (ctx, i) => CartItemTile(item: cart.items[i]),
          ),
    );
  }
}

// Access without listening (for callbacks)
class AddToCartButton extends StatelessWidget {
  final Product product;
  const AddToCartButton({required this.product});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () {
        context.read<CartModel>().addItem(product, 1);  // doesn't rebuild
      },
      child: const Text('Add to Cart'),
    );
  }
}
```

### Riverpod

```dart
// Provider for async data (auto-dispose, auto-cache)
final userProvider = FutureProvider.family<User, String>((ref, userId) async {
  final api = ref.watch(apiProvider);
  return api.getUser(userId);
});

// StateNotifier for complex state
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _authRepo;

  AuthNotifier(this._authRepo) : super(const AuthState.initial());

  Future<void> login(String email, String password) async {
    state = const AuthState.loading();
    try {
      final user = await _authRepo.login(email, password);
      state = AuthState.authenticated(user);
    } catch (e) {
      state = AuthState.error(e.toString());
    }
  }

  Future<void> logout() async {
    await _authRepo.logout();
    state = const AuthState.initial();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});

// Usage in widget
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    ref.listen(authProvider, (prev, next) {
      next.whenOrNull(
        authenticated: (_) => Navigator.pushReplacementNamed(context, '/home'),
        error: (msg) => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        ),
      );
    });

    return authState.when(
      initial: () => const LoginForm(),
      loading: () => const CircularProgressIndicator(),
      error: (msg) => LoginForm(errorMessage: msg),
      authenticated: (_) => const SizedBox.shrink(),
    );
  }
}
```

### BLoC Pattern

```dart
// Event
sealed class UserEvent {}
class LoadUsers extends UserEvent {}
class SearchUsers extends UserEvent {
  final String query;
  SearchUsers(this.query);
}

// State
sealed class UserState {}
class UserInitial extends UserState {}
class UserLoading extends UserState {}
class UserLoaded extends UserState {
  final List<User> users;
  UserLoaded(this.users);
}
class UserError extends UserState {
  final String message;
  UserError(this.message);
}

// BLoC
class UserBloc extends Bloc<UserEvent, UserState> {
  final UserRepository _userRepo;

  UserBloc(this._userRepo) : super(UserInitial()) {
    on<LoadUsers>(_onLoadUsers);
    on<SearchUsers>(_onSearchUsers);
  }

  Future<void> _onLoadUsers(LoadUsers event, Emitter<UserState> emit) async {
    emit(UserLoading());
    try {
      final users = await _userRepo.getUsers();
      emit(UserLoaded(users));
    } catch (e) {
      emit(UserError(e.toString()));
    }
  }

  Future<void> _onSearchUsers(SearchUsers event, Emitter<UserState> emit) async {
    emit(UserLoading());
    try {
      final users = await _userRepo.searchUsers(event.query);
      emit(UserLoaded(users));
    } catch (e) {
      emit(UserError(e.toString()));
    }
  }
}

// Widget
class UserListScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => UserBloc(context.read<UserRepository>())..add(LoadUsers()),
      child: const UserListView(),
    );
  }
}

class UserListView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          onChanged: (q) => context.read<UserBloc>().add(SearchUsers(q)),
        ),
      ),
      body: BlocBuilder<UserBloc, UserState>(
        builder: (context, state) => switch (state) {
          UserInitial() => const SizedBox.shrink(),
          UserLoading() => const Center(child: CircularProgressIndicator()),
          UserLoaded(users: final users) => ListView.builder(
              itemCount: users.length,
              itemBuilder: (_, i) => ListTile(title: Text(users[i].name)),
            ),
          UserError(message: final msg) => Center(child: Text('Error: $msg')),
        },
      ),
    );
  }
}
```

---

## Navigation

### Basic Navigation

```dart
// Push
Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const DetailScreen(id: '123')),
);

// Named routes with arguments
MaterialApp(
  routes: {
    '/': (_) => const HomeScreen(),
    '/detail': (_) => const DetailScreen(),
  },
  onGenerateRoute: (settings) {
    if (settings.name == '/user') {
      final userId = settings.arguments as String;
      return MaterialPageRoute(builder: (_) => UserScreen(id: userId));
    }
    return null;
  },
);

// Navigate with named route
Navigator.pushNamed(context, '/detail', arguments: '123');

// Pop with result
Navigator.pop(context, 'result_data');

// Replace current route
Navigator.pushReplacementNamed(context, '/home');

// Clear stack and go to
Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);

// GoRouter (recommended for declarative routing)
final router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (_, __) => const HomeScreen(),
    ),
    GoRoute(
      path: '/user/:id',
      builder: (_, state) => UserScreen(id: state.pathParameters['id']!),
    ),
    ShellRoute(
      builder: (_, __, child) => AppScaffold(child: child),
      routes: [
        GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
        GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      ],
    ),
    GoRoute(
      path: '/login',
      builder: (_, __) => const LoginScreen(),
    ),
  ],
  redirect: (context, state) {
    final isLoggedIn = AuthCheck.isLoggedIn();
    final isLoginRoute = state.matchedLocation == '/login';
    if (!isLoggedIn && !isLoginRoute) return '/login';
    if (isLoggedIn && isLoginRoute) return '/';
    return null;
  },
);
```

---

## Forms & Validation

```dart
class LoginForm extends StatefulWidget {
  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';
    if (!RegExp(r'^[\w-.]+@([\w-]+\.)+[\w-]{2,}$').hasMatch(value)) {
      return 'Invalid email format';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 8) return 'At least 8 characters';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await context.read<AuthNotifier>().login(
        _emailCtrl.text.trim(),
        _passCtrl.text,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: _validateEmail,
            autovalidateMode: AutovalidateMode.onUserInteraction,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passCtrl,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: _validatePassword,
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Login'),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## HTTP & API

```dart
// dio_client.dart
import 'package:dio/dio.dart';

class ApiClient {
  late final Dio _dio;

  ApiClient({required String baseUrl, String? token}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    ));

    _dio.interceptors.addAll([
      LogInterceptor(requestBody: true, responseBody: true),
      InterceptorsWrapper(
        onError: (error, handler) {
          if (error.response?.statusCode == 401) {
            // Trigger refresh token or logout
          }
          handler.next(error);
        },
      ),
    ]);
  }

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParams}) {
    return _dio.get<T>(path, queryParameters: queryParams);
  }

  Future<Response<T>> post<T>(String path, {dynamic data}) {
    return _dio.post<T>(path, data: data);
  }
}

// Using retrofit (generate API client from annotations)
@RestApi(baseUrl: 'https://api.example.com/v1')
abstract class UserApi {
  factory UserApi(Dio dio) = _UserApi;

  @GET('/users')
  Future<List<User>> getUsers();

  @GET('/users/{id}')
  Future<User> getUser(@Path() String id);

  @POST('/users')
  Future<User> createUser(@Body() CreateUserDto dto);

  @PUT('/users/{id}')
  Future<User> updateUser(@Path() String id, @Body() UpdateUserDto dto);

  @DELETE('/users/{id}')
  Future<void> deleteUser(@Path() String id);
}
```

---

## Local Storage

```dart
// SharedPreferences (key-value)
final prefs = await SharedPreferences.getInstance();

// Write
await prefs.setString('token', token);
await prefs.setBool('isDarkMode', true);
await prefs.setInt('userId', 42);

// Read
final token = prefs.getString('token') ?? '';
final isDark = prefs.getBool('isDarkMode') ?? false;

// Hive (structured data - fast, type-safe)
@HiveType(typeId: 0)
class User extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String email;

  @HiveField(2)
  String name;
}

// Initialize
await Hive.initFlutter();
Hive.registerAdapter(UserAdapter());
final userBox = await Hive.openBox<User>('users');

// Operations
userBox.put('user_1', User(id: '1', email: 'a@b.com', name: 'Alice'));
final user = userBox.get('user_1');

// Drift (SQLite alternative)
// Reactive queries, type-safe, streaming
@UseDao(tables: [Users])
class UserDao extends DatabaseAccessor<AppDatabase> with _$UserDaoMixin {
  UserDao(AppDatabase db) : super(db);

  Future<List<User>> getAllUsers() => select(users).get();
  Future<User?> getUserById(String id) => (select(users)..where((u) => u.id.equals(id))).getSingleOrNull();
  Future<int> insertUser(Insertable<User> user) => into(users).insert(user);
  Stream<List<User>> watchAllUsers() => select(users).watch();
}
```

---

## Platform Channels

```dart
// MethodChannel: Flutter -> Native (one-time calls)

// Flutter side
class BiometricAuth {
  static const _channel = MethodChannel('com.example.app/biometric');

  static Future<bool> authenticate() async {
    try {
      final result = await _channel.invokeMethod<bool>('authenticate');
      return result ?? false;
    } on PlatformException catch (e) {
      throw Exception('Biometric auth failed: ${e.message}');
    }
  }

  static Future<bool> isAvailable() async {
    final result = await _channel.invokeMethod<bool>('isAvailable');
    return result ?? false;
  }
}

// Android side (Kotlin)
// MainActivity.kt
class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.example.app/biometric"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isAvailable" -> {
                    result.success(true) // check biometric manager
                }
                "authenticate" -> {
                    // Show biometric prompt, then:
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }
}

// iOS side (Swift)
// AppDelegate.swift
@main
@objc class AppDelegate: FlutterAppDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let controller = window?.rootViewController as! FlutterViewController
        let channel = FlutterMethodChannel(name: "com.example.app/biometric",
                                            binaryMessenger: controller.binaryMessenger)
        channel.setMethodCallHandler { (call, result) in
            switch call.method {
            case "isAvailable":
                result(true)
            case "authenticate":
                // LAContext evaluatePolicy, then:
                result(true)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}

// EventChannel: Native -> Flutter (streams)
class BatteryLevel {
  static const _channel = EventChannel('com.example.app/battery');

  static Stream<int> get level {
    return _channel.receiveBroadcastStream().map((e) => e as int);
  }
}

// Usage: BatteryLevel.level.listen((level) => print('Battery: $level%'));
```

---

## Animations

```dart
// Implicit Animation (AnimatedContainer)
class AnimatedBox extends StatefulWidget {
  @override
  State<AnimatedBox> createState() => _AnimatedBoxState();
}

class _AnimatedBoxState extends State<AnimatedBox> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _expanded = !_expanded),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        width: _expanded ? 200 : 100,
        height: _expanded ? 200 : 100,
        decoration: BoxDecoration(
          color: _expanded ? Colors.blue : Colors.red,
          borderRadius: BorderRadius.circular(_expanded ? 20 : 0),
        ),
      ),
    );
  }
}

// Explicit Animation (AnimationController)
class FadeInWidget extends StatefulWidget {
  final Widget child;
  const FadeInWidget({required this.child});

  @override
  State<FadeInWidget> createState() => _FadeInWidgetState();
}

class _FadeInWidgetState extends State<FadeInWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _fadeAnimation, child: widget.child);
  }
}

// Staggered animation
class StaggeredListAnimation extends StatefulWidget {
  final List<Widget> children;
  const StaggeredListAnimation({required this.children});

  @override
  State<StaggeredListAnimation> createState() => _StaggeredListAnimationState();
}

class _StaggeredListAnimationState extends State<StaggeredListAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Column(
          children: List.generate(widget.children.length, (index) {
            final start = index * 0.1;
            final end = (index + 1) * 0.25;
            final value = Interval(start, end, curve: Curves.easeOut).transform(_controller.value);
            return Opacity(
              opacity: value,
              child: Transform.translate(
                offset: Offset(0, 50 * (1 - value)),
                child: widget.children[index],
              ),
            );
          }),
        );
      },
    );
  }
}
```

---

## Testing

### Widget Tests

```dart
void main() {
  testWidgets('LoginForm shows validation errors', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: LoginForm())),
    );

    // Tap submit without filling
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('LoginForm validates email format', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: LoginForm())),
    );

    await tester.enterText(find.byType(TextFormField).first, 'invalid');
    await tester.enterText(find.byType(TextFormField).last, 'password123');
    await tester.tap(find.byType(ElevatedButton));
    await tester.pumpAndSettle();

    expect(find.text('Invalid email format'), findsOneWidget);
  });

  testWidgets('UserList renders items after loading', (tester) async {
    // Mock the API
    when(mockApi.getUsers()).thenAnswer((_) async => [
      User(id: '1', name: 'Alice'),
      User(id: '2', name: 'Bob'),
    ]);

    await tester.pumpWidget(
      Provider<UserApi>.value(
        value: mockApi,
        child: const MaterialApp(home: UserListScreen()),
      ),
    );

    // Check loading state
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Wait for data
    await tester.pumpAndSettle();

    // Check items rendered
    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });
}

// Mocking with Mockito
@GenerateMocks([UserApi])
void main() {
  late MockUserApi mockApi;

  setUp(() {
    mockApi = MockUserApi();
  });

  test('UserBloc emits loaded state', () {
    when(mockApi.getUsers()).thenAnswer((_) async => [User(id: '1', name: 'Test')]);

    final bloc = UserBloc(mockApi);

    bloc.add(LoadUsers());

    expectLater(
      bloc.stream,
      emitsInOrder([
        UserLoading(),
        UserLoaded([User(id: '1', name: 'Test')]),
      ]),
    );
  });
}
```

---

## Project Structure

```
lib/
  main.dart                      # Entry point, runApp
  app.dart                       # MaterialApp/CupertinoApp widget
  core/
    config/
      app_config.dart            # Base URL, feature flags
      theme.dart                 # ThemeData configuration
      routes.dart                # GoRouter / named routes
    constants/
      api_endpoints.dart
      app_constants.dart
    error/
      exceptions.dart            # Custom exception classes
      failure.dart              # Failure models (Equatable)
    network/
      api_client.dart           # Dio setup, interceptors
      auth_interceptor.dart
      response_parser.dart
    utils/
      validators.dart
      formatters.dart
      extensions.dart
  features/
    auth/
      data/
        datasources/
          auth_remote_datasource.dart
        models/
          user_model.dart        # JSON serialization
        repositories/
          auth_repository_impl.dart
      domain/
        entities/
          user.dart
        repositories/
          auth_repository.dart   # Abstract interface
        usecases/
          login_usecase.dart
      presentation/
        bloc/
          auth_bloc.dart
          auth_event.dart
          auth_state.dart
        pages/
          login_page.dart
          register_page.dart
        widgets/
          login_form.dart
    dashboard/
      # same structure as auth
  shared/
    widgets/
      custom_app_bar.dart
      loading_indicator.dart
      error_view.dart
      empty_state.dart
    services/
      local_storage_service.dart
      biometric_service.dart
test/
  features/
    auth/
      data/repositories/
        auth_repository_impl_test.dart
      presentation/bloc/
        auth_bloc_test.dart
      presentation/widgets/
        login_form_test.dart
  helpers/
    test_helpers.dart
    fixtures/
      user_fixtures.dart
```

---

## Common Pitfalls

### 1. Build Methods Too Large
```dart
// BAD: build() is 200+ lines
@override
Widget build(BuildContext context) {
  return Column(children: [
    // ... 50 lines of header
    // ... 50 lines of form
    // ... 50 lines of footer
  ]);
}

// GOOD: Extract into widgets
@override
Widget build(BuildContext context) {
  return Column(children: [
    _buildHeader(),
    _buildForm(),
    _buildFooter(),
  ]);
}
Widget _buildHeader() => /* ... */;
Widget _buildForm() => /* ... */;
```

### 2. Calling setState After Dispose
```dart
// BAD: setState after async gap (widget might be disposed)
Future<void> _fetchData() async {
  setState(() => _loading = true);
  final data = await api.getData();  // widget could be gone!
  setState(() { _data = data; _loading = false; });  // CRASH
}

// GOOD: Check mounted
Future<void> _fetchData() async {
  setState(() => _loading = true);
  final data = await api.getData();
  if (!mounted) return;  // Widget disposed, stop here
  setState(() { _data = data; _loading = false; });
}
```

### 3. Rebuilding Unnecessary Widgets
```dart
// BAD: Entire tree rebuilds because context.watch at top level
@override
Widget build(BuildContext context) {
  final cart = context.watch<CartModel>();  // rebuilds on ANY cart change
  return Scaffold(
    appBar: AppBar(title: Text('Shop')),
    body: ProductGrid(),  // doesn't need cart!
    bottomNavigationBar: CartBar(total: cart.total),  // only cares about total
  );
}

// GOOD: Watch only where needed
@override
Widget build(BuildContext context) {
  return Scaffold(
    appBar: AppBar(title: Text('Shop')),
    body: const ProductGrid(),
    bottomNavigationBar: Builder(
      builder: (ctx) {
        final total = ctx.select<CartModel, double>((c) => c.total);  // only rebuilds when total changes
        return CartBar(total: total);
      },
    ),
  );
}
```

### 4. Const Constructors Missing
```dart
// BAD: Missing const = unnecessary rebuild
Padding(padding: EdgeInsets.all(16), child: Text('Hello'))

// GOOD: Use const for compile-time constant widgets
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'))
```

### 5. Keys for Lists
```dart
// BAD: No keys on list items = wrong state preservation
ListView.builder(
  itemBuilder: (_, i) => MyStatefulWidget(item: items[i]),
)

// GOOD: Use ValueKey with a unique identifier
ListView.builder(
  key: PageStorageKey('my_list'),
  itemBuilder: (_, i) => MyStatefulWidget(
    key: ValueKey(items[i].id),
    item: items[i],
  ),
)
```

### 6. Context Before MaterialApp
```dart
// BAD: Accessing Navigator/Theme before MaterialApp exists
void main() {
  runApp(MyApp());
  Navigator.of(context); // NO context exists here!
}

// GOOD: Use navigatorKey for pre-MaterialApp access
final navigatorKey = GlobalKey<NavigatorState>();
void main() {
  runApp(MaterialApp(navigatorKey: navigatorKey, ...));
  navigatorKey.currentState?.pushNamed('/login');
}
```

### 7. Handling Streams Without CancelOnError
```dart
// BAD: StreamSubscription without error handling
_stream.listen((data) => setState(() => _data = data));

// GOOD: Handle errors and cancel properly
_subscription = _stream.listen(
  (data) => setState(() => _data = data),
  onError: (error) => _showError(error),
  cancelOnError: false,
);

@override
void dispose() {
  _subscription.cancel();
  super.dispose();
}
```

---

## InheritedWidget & Data Flow

```dart
// InheritedWidget personalizado (cuando Provider/Riverpod no alcanzan)
class ThemeColors extends InheritedWidget {
  final Color primary;
  final Color background;
  final Color text;
  final Color error;

  const ThemeColors({
    super.key,
    required this.primary,
    required this.background,
    required this.text,
    required this.error,
    required super.child,
  });

  static ThemeColors of(BuildContext context) {
    final result = context.dependOnInheritedWidgetOfExactType<ThemeColors>();
    assert(result != null, 'No ThemeColors found in context');
    return result!;
  }

  @override
  bool updateShouldNotify(ThemeColors oldWidget) {
    return primary != oldWidget.primary ||
           background != oldWidget.background ||
           text != oldWidget.text ||
           error != oldWidget.error;
  }
}

// InheritedModel (solo notifica campos especificos)
class UserSettings extends InheritedModel<UserSetting> {
  final String theme;
  final String language;
  final bool notifications;

  const UserSettings({
    required this.theme,
    required this.language,
    required this.notifications,
    required super.child,
  });

  static UserSettings of(BuildContext context, {UserSetting? aspect}) {
    return InheritedModel.inheritFrom<UserSettings>(context, aspect: aspect);
  }

  @override
  bool updateShouldNotify(UserSettings old) => true;

  @override
  bool updateShouldNotifyDependent(UserSettings old, Set<UserSetting> aspects) {
    for (final aspect in aspects) {
      switch (aspect) {
        case UserSetting.theme: if (theme != old.theme) return true; break;
        case UserSetting.language: if (language != old.language) return true; break;
        case UserSetting.notifications: if (notifications != old.notifications) return true; break;
      }
    }
    return false;
  }
}
```

## CustomPaint & CustomPainter

```dart
// CustomPainter con animacion
class AnimatedProgressPainter extends CustomPainter {
  final double progress; // 0.0 - 1.0
  final Color color;

  AnimatedProgressPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;

    // Background circle
    final bgPaint = Paint()
      ..color = color.withOpacity(0.1)
      ..strokeWidth = 6
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, radius, bgPaint);

    // Progress arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi / 2,              // start from top
      2 * pi * progress,    // sweep angle
      false,
      paint,
    );

    // Percentage text
    final textPainter = TextPainter(
      text: TextSpan(
        text: '${(progress * 100).toInt()}%',
        style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.bold),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2));
  }

  @override
  bool shouldRepaint(AnimatedProgressPainter old) => old.progress != progress;
}

// Usar con RepaintBoundary para aislar del resto
RepaintBoundary(
  child: CustomPaint(
    size: const Size(100, 100),
    painter: AnimatedProgressPainter(progress: _controller.value, color: Colors.blue),
  ),
)
```

## Overlay & Tooltips

```dart
// Overlay para un dropdown/popup personalizado
class CustomDropdown extends StatefulWidget {
  final List<String> items;
  final String? selected;
  final ValueChanged<String> onChanged;

  const CustomDropdown({required this.items, this.selected, required this.onChanged});

  @override
  State<CustomDropdown> createState() => _CustomDropdownState();
}

class _CustomDropdownState extends State<CustomDropdown> {
  final _link = LayerLink();
  OverlayEntry? _overlay;

  void _toggle() {
    if (_overlay != null) {
      _overlay!.remove();
      _overlay = null;
    } else {
      _overlay = _createOverlay();
      Overlay.of(context).insert(_overlay!);
    }
  }

  OverlayEntry _createOverlay() {
    final renderBox = context.findRenderObject() as RenderBox;
    final size = renderBox.size;

    return OverlayEntry(
      builder: (context) => GestureDetector(
        onTap: () { _overlay?.remove(); _overlay = null; },
        behavior: HitTestBehavior.translucent,
        child: Stack(
          children: [
            // Background tap catcher
            const Positioned.fill(child: SizedBox()),

            // Dropdown menu
            Positioned(
              width: size.width,
              child: CompositedTransformFollower(
                link: _link,
                showWhenUnlinked: false,
                offset: Offset(0, size.height + 4),
                child: Material(
                  elevation: 8,
                  borderRadius: BorderRadius.circular(8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: widget.items.map((item) => InkWell(
                      onTap: () {
                        widget.onChanged(item);
                        _overlay?.remove();
                        _overlay = null;
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(item),
                      ),
                    )).toList(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _link,
      child: GestureDetector(
        onTap: _toggle,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(), borderRadius: BorderRadius.circular(8)),
          child: Row(children: [
            Expanded(child: Text(widget.selected ?? 'Select...')),
            const Icon(Icons.arrow_drop_down),
          ]),
        ),
      ),
    );
  }
}
```

## Keyboard & Focus Management

```dart
// FocusNode + FocusScope para navegacion con teclado
class KeyboardNavigation extends StatefulWidget {
  @override
  State<KeyboardNavigation> createState() => _KeyboardNavigationState();
}

class _KeyboardNavigationState extends State<KeyboardNavigation> {
  final _focusNodes = List.generate(5, (_) => FocusNode());
  final _controllers = List.generate(5, (_) => TextEditingController());

  @override
  void dispose() {
    for (var node in _focusNodes) { node.dispose(); }
    for (var ctrl in _controllers) { ctrl.dispose(); }
    super.dispose();
  }

  void _focusNext(int index) {
    if (index < _focusNodes.length - 1) {
      FocusScope.of(context).requestFocus(_focusNodes[index + 1]);
    } else {
      _focusNodes[index].unfocus(); // hide keyboard on last
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (i) => TextField(
        focusNode: _focusNodes[i],
        controller: _controllers[i],
        textInputAction: i < 4 ? TextInputAction.next : TextInputAction.done,
        onSubmitted: (_) => _focusNext(i),
        decoration: InputDecoration(labelText: 'Field ${i + 1}'),
      )),
    );
  }
}

// Keyboard dismiss on scroll
Scrollbar(
  child: ListView.builder(
    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
    itemBuilder: /* ... */,
  ),
)

// RawKeyboardListener (teclas fisicas)
RawKeyboardListener(
  focusNode: _focusNode,
  onKey: (event) {
    if (event is RawKeyDownEvent) {
      if (event.logicalKey == LogicalKeyboardKey.escape) {
        Navigator.of(context).pop();
      }
    }
  },
  child: /* ... */,
)

// Shortcuts + Actions (atajos de teclado)
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Shortcuts(
      shortcuts: {
        LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyS): const _SaveIntent(),
        LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyZ): const _UndoIntent(),
      },
      child: Actions(
        actions: {
          _SaveIntent: CallbackAction<_SaveIntent>(onInvoke: (_) => _save()),
          _UndoIntent: CallbackAction<_UndoIntent>(onInvoke: (_) => _undo()),
        },
        child: Focus(autofocus: true, child: /* tu widget */),
      ),
    );
  }
}
```

## Error Handling & Crash Reporting

```dart
// Global error handler
void main() {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // Reportar a servicio de crash
    CrashReporter.report(details.exception, details.stack);
  };

  // Errores de platform (fuera de Flutter)
  PlatformDispatcher.instance.onError = (error, stack) {
    CrashReporter.report(error, stack);
    return true; // handled
  };

  runApp(const MyApp());
}

// Error boundary widget
class GlobalErrorBoundary extends StatefulWidget {
  final Widget child;
  const GlobalErrorBoundary({required this.child});

  @override
  State<GlobalErrorBoundary> createState() => _GlobalErrorBoundaryState();
}

class _GlobalErrorBoundaryState extends State<GlobalErrorBoundary> {
  @override
  void initState() {
    super.initState();
    ErrorWidget.builder = (details) {
      return Material(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 16),
              Text('Something went wrong', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(details.exceptionAsString(), style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => setState(() {}), // rebuild to recover
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    };
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

// Async error handling pattern
Future<T> safeAsync<T>(Future<T> Function() callback, {String? context}) async {
  try {
    return await callback();
  } catch (e, stack) {
    // Log error
    debugPrint('Error${context != null ? " in $context" : ""}: $e\n$stack');
    rethrow;
  }
}

// Dio error mapper para API errors
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? errors; // validation errors by field

  ApiException(this.message, {this.statusCode, this.errors});

  factory ApiException.fromDioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError) {
      return ApiException('No internet connection', statusCode: 0);
    }

    final statusCode = e.response?.statusCode;
    final data = e.response?.data;

    if (data is Map) {
      if (statusCode == 422 && data['errors'] is Map) {
        return ApiException(
          data['message'] ?? 'Validation failed',
          statusCode: 422,
          errors: Map<String, dynamic>.from(data['errors']),
        );
      }
      return ApiException(
        data['message'] ?? 'Something went wrong',
        statusCode: statusCode,
      );
    }

    return ApiException('Network error', statusCode: statusCode);
  }
}

// UI error display pattern
class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final bool fullScreen;

  const ErrorView({required this.message, this.onRetry, this.fullScreen = false});

  @override
  Widget build(BuildContext context) {
    final content = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.error_outline, size: fullScreen ? 64 : 48, color: Colors.grey[400]),
        const SizedBox(height: 16),
        Text(message, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey[600])),
        if (onRetry != null) ...[
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ],
    );

    if (fullScreen) {
      return Scaffold(body: Center(child: content));
    }
    return Center(child: content);
  }
}
```
