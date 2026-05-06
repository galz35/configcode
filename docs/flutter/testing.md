# Flutter Testing Guide

## Unit Tests

```dart
// test/models/user_test.dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('User.fromJson', () {
    test('parses valid JSON correctly', () {
      final json = {
        'id': '123',
        'email': 'test@test.com',
        'name': 'Test User',
        'role': 'user',
        'created_at': '2024-01-01T00:00:00.000Z',
      };

      final user = User.fromJson(json);

      expect(user.id, '123');
      expect(user.email, 'test@test.com');
      expect(user.role, 'user');
      expect(user.createdAt, isA<DateTime>());
    });

    test('handles missing optional fields', () {
      final json = {
        'id': '123',
        'email': 'test@test.com',
        'name': 'Test',
        'created_at': '2024-01-01T00:00:00.000Z',
      };

      final user = User.fromJson(json);
      expect(user.role, 'user'); // default value
    });
  });

  group('User.copyWith', () {
    test('returns new instance with updated fields', () {
      final user = User(id: '1', email: 'a@b.com', name: 'Alice', role: 'user', createdAt: DateTime.now());
      final updated = user.copyWith(name: 'Bob');

      expect(updated.name, 'Bob');
      expect(updated.email, 'a@b.com'); // unchanged
      expect(updated.id, '1'); // unchanged
    });
  });
}

// test/services/auth_service_test.dart
import 'package:mockito/mockito.dart';
import 'package:mockito/annotations.dart';

@GenerateMocks([AuthRepository, LocalStorage])
import 'auth_service_test.mocks.dart';

void main() {
  late MockAuthRepository mockRepo;
  late MockLocalStorage mockStorage;
  late AuthService service;

  setUp(() {
    mockRepo = MockAuthRepository();
    mockStorage = MockLocalStorage();
    service = AuthService(mockRepo, mockStorage);
  });

  test('login stores token and returns user', () async {
    when(mockRepo.login('test@test.com', 'password')).thenAnswer(
      (_) async => LoginResponse(token: 'abc123', user: testUser),
    );
    when(mockStorage.setString('token', 'abc123')).thenAnswer((_) async {});

    final result = await service.login('test@test.com', 'password');

    expect(result.token, 'abc123');
    verify(mockStorage.setString('token', 'abc123')).called(1);
  });

  test('login throws on invalid credentials', () async {
    when(mockRepo.login('bad@test.com', 'wrong')).thenThrow(
      DioException(requestOptions: RequestOptions(), response: Response(statusCode: 401, requestOptions: RequestOptions())),
    );

    expect(
      () => service.login('bad@test.com', 'wrong'),
      throwsA(isA<AuthException>()),
    );
  });
}
```

## Widget Tests

```dart
// test/widgets/login_form_test.dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LoginForm', () {
    testWidgets('shows validation errors on empty submit', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: LoginForm())),
      );

      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });

    testWidgets('validates email format', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: LoginForm())),
      );

      await tester.enterText(find.byType(TextFormField).first, 'invalid');
      await tester.enterText(find.byType(TextFormField).last, 'password123');
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(find.text('Invalid email format'), findsOneWidget);
    });

    testWidgets('calls onLogin with valid data', (tester) async {
      var called = false;
      String? submittedEmail;

      await tester.pumpWidget(MaterialApp(home: Scaffold(
        body: LoginForm(onLogin: (email, pass) {
          called = true;
          submittedEmail = email;
        }),
      )));

      await tester.enterText(find.byType(TextFormField).first, 'test@test.com');
      await tester.enterText(find.byType(TextFormField).last, 'password123');
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(called, true);
      expect(submittedEmail, 'test@test.com');
    });

    testWidgets('shows loading state during submission', (tester) async {
      final completer = Completer<void>();

      await tester.pumpWidget(MaterialApp(home: Scaffold(
        body: LoginForm(onLogin: (_, __) => completer.future),
      )));

      await tester.enterText(find.byType(TextFormField).first, 'test@test.com');
      await tester.enterText(find.byType(TextFormField).last, 'password123');
      await tester.tap(find.byType(ElevatedButton));
      await tester.pump(); // un frame = loading state

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.byType(ElevatedButton), findsNothing); // reemplazado por loading

      completer.complete();
      await tester.pumpAndSettle();
    });

    testWidgets('toggles password visibility', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: LoginForm())),
      );

      final passwordField = find.byType(TextFormField).last;
      expect(tester.widget<TextFormField>(passwordField).obscureText, true);

      await tester.tap(find.byIcon(Icons.visibility));
      await tester.pump();

      expect(tester.widget<TextFormField>(passwordField).obscureText, false);
    });
  });
}

// test/widgets/user_list_test.dart
void main() {
  testWidgets('shows loading then renders users', (tester) async {
    final mockApi = MockUserApi();
    when(mockApi.getUsers()).thenAnswer((_) async => [
      User(id: '1', name: 'Alice', email: 'a@test.com', role: 'user', createdAt: DateTime.now()),
      User(id: '2', name: 'Bob', email: 'b@test.com', role: 'user', createdAt: DateTime.now()),
    ]);

    await tester.pumpWidget(
      ProviderScope(overrides: [
        userApiProvider.overrideWithValue(mockApi),
      ], child: const MaterialApp(home: UserListScreen())),
    );

    // Loading state
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Wait for data
    await tester.pumpAndSettle();
    expect(find.text('Alice'), findsOneWidget);
    expect(find.text('Bob'), findsOneWidget);

    // Empty state
    // Test again with empty list
    when(mockApi.getUsers()).thenAnswer((_) async => []);
    await tester.pumpWidget(
      ProviderScope(overrides: [
        userApiProvider.overrideWithValue(mockApi),
      ], child: const MaterialApp(home: UserListScreen())),
    );
    await tester.pumpAndSettle();
    expect(find.text('No users found'), findsOneWidget);
  });

  testWidgets('shows error state with retry', (tester) async {
    final mockApi = MockUserApi();
    when(mockApi.getUsers()).thenThrow(Exception('Network error'));

    await tester.pumpWidget(
      ProviderScope(overrides: [
        userApiProvider.overrideWithValue(mockApi),
      ], child: const MaterialApp(home: UserListScreen())),
    );

    await tester.pumpAndSettle();
    expect(find.textContaining('Network error'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);

    // Retry
    when(mockApi.getUsers()).thenAnswer((_) async => []);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('No users found'), findsOneWidget);
  });
}
```

## Integration Tests

```dart
// integration_test/app_test.dart
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full auth flow', (tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();

    // 1. Check landing page
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Login'), findsOneWidget);

    // 2. Navigate to register
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();

    // 3. Fill registration form
    await tester.enterText(find.byType(TextFormField).at(0), 'e2e@test.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'E2E User');
    await tester.enterText(find.byType(TextFormField).at(2), 'Str0ngP@ss!');
    await tester.tap(find.text('Register'));
    await tester.pumpAndSettle();

    // 4. Should navigate to home
    expect(find.text('Home'), findsOneWidget);

    // 5. Logout
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Logout'));
    await tester.pumpAndSettle();

    // 6. Back to landing
    expect(find.text('Welcome'), findsOneWidget);
  });

  testWidgets('product detail and add to cart', (tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pumpAndSettle();

    // Login first
    await tester.tap(find.text('Login'));
    await tester.enterText(find.byType(TextFormField).first, 'e2e@test.com');
    await tester.enterText(find.byType(TextFormField).last, 'Str0ngP@ss!');
    await tester.tap(find.text('Login'));
    await tester.pumpAndSettle();

    // Tap first product
    await tester.tap(find.byType(ProductCard).first);
    await tester.pumpAndSettle();

    // Check detail page
    expect(find.text('Add to Cart'), findsOneWidget);

    // Add to cart
    await tester.tap(find.text('Add to Cart'));
    await tester.pumpAndSettle();

    // Check badge shows 1
    expect(find.text('1'), findsOneWidget);
  });
}
```

## Golden Tests (Screenshot)

```dart
// test/golden/button_golden_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:golden_toolkit/golden_toolkit.dart';

void main() {
  testGoldens('PrimaryButton renders correctly', (tester) async {
    await tester.pumpWidgetBuilder(
      const PrimaryButton(label: 'Submit'),
      surfaceSize: const Size(200, 48),
    );

    await screenMatchesGolden(tester, 'primary_button');
  });

  testGoldens('PrimaryButton disabled state', (tester) async {
    await tester.pumpWidgetBuilder(
      const PrimaryButton(label: 'Submit', enabled: false),
      surfaceSize: const Size(200, 48),
    );

    await screenMatchesGolden(tester, 'primary_button_disabled');
  });

  testGoldens('PrimaryButton loading state', (tester) async {
    await tester.pumpWidgetBuilder(
      const PrimaryButton(label: 'Submit', loading: true),
      surfaceSize: const Size(200, 48),
    );

    await screenMatchesGolden(tester, 'primary_button_loading');
  });
}

// Correr con: flutter test --update-goldens
```

## Test Utilities / Helpers

```dart
// test/helpers/pump_app.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Widget pumpApp(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: child,
      localizationsDelegates: const [
        DefaultMaterialLocalizations.delegate,
        DefaultWidgetsLocalizations.delegate,
      ],
    ),
  );
}

extension PumpApp on WidgetTester {
  Future<void> pumpAppWidget(Widget child,
      {List<Override> overrides = const [], Size surfaceSize = const Size(400, 800)}) async {
    await pumpWidget(pumpApp(child, overrides: overrides));
    binding.window.physicalSizeTestValue = surfaceSize;
    binding.window.devicePixelRatioTestValue = 1.0;
    await pumpAndSettle();
  }
}

// test/helpers/mocks.dart
class MockUserApi extends Mock implements UserApi {}
class MockAuthRepository extends Mock implements AuthRepository {}
class MockLocalStorage extends Mock implements LocalStorage {}

// test/helpers/fixtures.dart
User testUser = User(
  id: 'test-123',
  email: 'test@test.com',
  name: 'Test User',
  role: 'user',
  createdAt: DateTime(2024, 1, 1),
);

Map<String, dynamic> testUserJson = {
  'id': 'test-123',
  'email': 'test@test.com',
  'name': 'Test User',
  'role': 'user',
  'created_at': '2024-01-01T00:00:00.000Z',
};
```

## Test Coverage

```bash
# Correr tests con coverage
flutter test --coverage

# Generar reporte HTML
genhtml coverage/lcov.info -o coverage/html

# Solo tests especificos
flutter test test/widgets/
flutter test --name "shows validation"

# Update golden files
flutter test --update-goldens
```

## CI Integration

```yaml
# .github/workflows/flutter.yml
name: Flutter CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.0'
          channel: 'stable'

      - run: flutter pub get

      - name: Analyze
        run: flutter analyze --no-fatal-infos

      - name: Format check
        run: dart format --set-exit-if-changed lib/ test/

      - name: Unit + Widget tests
        run: flutter test --coverage

      - name: Integration tests (needs emulator)
        run: flutter test integration_test/
        # Requires: android-emulator or iOS simulator setup
```
