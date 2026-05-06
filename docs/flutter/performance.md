# Flutter Performance Guide

## Build Optimization

### const constructors
```dart
// MAL: Reconstruccion innecesaria
Padding(padding: EdgeInsets.all(16), child: Text('Hello'))  // se recrea cada build
// BIEN: const = compilado, nunca se recrea
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'))

// Regla: TODO lo que no cambia debe ser const
// Linter: prefer_const_constructors, prefer_const_literals
```

### RepaintBoundary
```dart
// Aisla widgets que se redibujan frecuentemente del resto
RepaintBoundary(
  child: AnimatedWidgetEnorme(), // solo este repinta
)

// Usar cuando:
// - ListView con items pesados
// - Animaciones locales que no afectan al resto
// - CustomPaint tiene canvas complejos
```

### Build Method Size
```dart
// MAL: build() de 200 lineas
@override
Widget build(BuildContext context) {
  return Column(children: [
    _header(),  // 40 lineas
    _body(),    // 80 lineas
    _footer(),  // 50 lineas
  ]);
}

// BIEN: Extraer en widgets (StatelessWidget con const)
class _HeaderSection extends StatelessWidget {
  const _HeaderSection(); // const!
  @override
  Widget build(BuildContext context) => Container(...);
}
```

### Sealed classes para estado
```dart
// Pattern matching evita checkeo manual
@override
Widget build(BuildContext context) => switch (state) {
  AsyncInitial() => const SizedBox.shrink(),
  AsyncLoading() => const Center(child: CircularProgressIndicator()),
  AsyncData(:final data) => DataView(data: data),
  AsyncError(:final message) => ErrorView(message: message),
};
```

## Isolates (Multi-hilo)

```dart
// CPU-bound: parse JSON enorme, encryption, image processing
import 'dart:isolate';

// Metodo 1: compute() (short-lived isolate)
final result = await compute(heavyComputation, inputData);

String heavyComputation(Map<String, dynamic> input) {
  // Este codigo corre en otro isolate
  return expensiveProcess(input);
}

// Metodo 2: Isolate.run() (Dart 2.19+)
final result = await Isolate.run(() => heavyComputation(inputData));

// Metodo 3: Isolate persistente (comunicacion bidireccional)
class WorkerIsolate {
  late final Isolate _isolate;
  late final SendPort _sendPort;
  final _receivePort = ReceivePort();

  Future<void> spawn() async {
    _isolate = await Isolate.spawn(_entryPoint, _receivePort.sendPort);
    _sendPort = await _receivePort.first as SendPort;
  }

  Future<T> compute<T>(Map<String, dynamic> input) {
    final responsePort = ReceivePort();
    _sendPort.send([input, responsePort.sendPort]);
    return responsePort.first as T;
  }

  static void _entryPoint(SendPort sendPort) {
    final port = ReceivePort();
    sendPort.send(port.sendPort);

    port.listen((message) {
      final input = message[0];
      final replyTo = message[1] as SendPort;
      replyTo.send(heavyComputation(input));
    });
  }

  void dispose() {
    _isolate.kill(priority: Isolate.immediate);
    _receivePort.close();
  }
}
```

## Memory Management

```dart
// MAL: Fugas de memoria
class LeakyWidget extends StatefulWidget {
  @override
  State<LeakyWidget> createState() => _LeakyWidgetState();
}

class _LeakyWidgetState extends State<LeakyWidget> {
  late final StreamSubscription _sub;
  late final AnimationController _ctrl;
  late final TextEditingController _textCtrl;

  @override
  void initState() {
    super.initState();
    _sub = someStream.listen((_) {});
    _ctrl = AnimationController(vsync: this);
    _textCtrl = TextEditingController();
    // FALTAN los dispose()!!! = memory leak
  }

  // BIEN: Siempre dispose
  @override
  void dispose() {
    _sub.cancel();           // streams
    _ctrl.dispose();         // animation controllers
    _textCtrl.dispose();     // text controllers
    _scrollCtrl.dispose();   // scroll controllers
    _focusNode.dispose();    // focus nodes
    super.dispose();
  }
}

// Image cache management
class AppInit extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Limitar cache de imagenes
    PaintingBinding.instance.imageCache.maximumSize = 200; // default: 100
    PaintingBinding.instance.imageCache.maximumSizeBytes = 50 << 20; // 50 MB

    return const MyApp();
  }
}
```

## List Optimization

```dart
// MAL: ListView con items no constantes
ListView.builder(
  itemCount: items.length,
  itemBuilder: (_, i) => HeavyWidget(item: items[i]), // sin key
)

// BIEN: Keys para preservar estado
ListView.builder(
  itemCount: items.length,
  itemBuilder: (_, i) => HeavyWidget(
    key: ValueKey(items[i].id),  // preserva estado entre rebuilds
    item: items[i],
  ),
)

// BIEN: addAutomaticKeepAlives para tabs
ListView.builder(
  addAutomaticKeepAlives: true,  // default: true
  itemBuilder: (_, i) => TabContent(key: PageStorageKey(i), tab: i),
)

// BIEN: Separar items pesados en widgets con const
class HeavyItem extends StatelessWidget {
  const HeavyItem({super.key, required this.item}); // const!
  @override
  Widget build(BuildContext context) => /* ... */;
}
```

## Deferred Loading (Lazy Imports)

```dart
// pubspec.yaml
// deferred-components en vez de dependencies

// Import diferido
import 'heavy_screen.dart' deferred as heavy;

// Carga bajo demanda
Future<void> loadHeavyScreen() async {
  await heavy.loadLibrary();
  // Ahora usar: heavy.HeavyScreen()
}

// Widget con loading state
class DeferredScreenLoader extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: heavy.loadLibrary(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.done) {
          return heavy.HeavyScreen();
        }
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      },
    );
  }
}
```

## Image Performance

```dart
// MAL: NetworkImage sin cache
Image.network(url)  // no cache, no placeholder, no error

// BIEN: CachedNetworkImage
CachedNetworkImage(
  imageUrl: url,
  placeholder: (_, __) => const ShimmerWidget(),
  errorWidget: (_, __, ___) => const Icon(Icons.broken_image),
  memCacheWidth: 300,       // max ancho en cache (redimensiona)
  memCacheHeight: 300,      // max alto en cache
  maxWidthDiskCache: 600,   // max ancho en disco
  fadeInDuration: const Duration(milliseconds: 300),
)

// FadeInImage (nativo, sin paquete extra)
FadeInImage(
  placeholder: const AssetImage('assets/placeholder.png'),
  image: NetworkImage(url),
  fadeInDuration: const Duration(milliseconds: 200),
)

// Pre-cachear imagenes antes de que se necesiten
Future<void> precacheImages() async {
  await Future.wait([
    precacheImage(const AssetImage('assets/bg.png'), context),
    precacheImage(const NetworkImage('https://...'), context),
  ]);
}
```

## Shader Compilation (Jank)

```dart
// Solucion al "first frame jank" en iOS
// main.dart
void main() {
  // Warm up shader compilation antes de runApp
  if (kReleaseMode) {
    runApp(const WarmingUpWidget());
    // Esperar un frame, luego app real
    WidgetsBinding.instance.addPostFrameCallback((_) {
      runApp(const MyApp());
    });
  } else {
    runApp(const MyApp());
  }
}

// O usar --cache-sksl en release
// flutter run --profile --cache-sksl
// flutter build apk --bundle-sksl-path=flutter_01.sksl.json
```

## Frame Budget (16ms)

```dart
// Monitorear rebuilds
// Flutter DevTools → Performance → Track Rebuilds

// Evitar build() en widgets ancestrales
// MAL: context.watch en nivel muy alto
@override
Widget build(BuildContext context) {
  final cart = context.watch<CartProvider>(); // TODA la app se reconstruye
  return Scaffold(...);
}

// BIEN: Watch solo donde se necesita
@override
Widget build(BuildContext context) {
  return Scaffold(
    body: const ProductList(),
    bottomBar: Builder(
      builder: (ctx) {
        final count = ctx.select<CartProvider, int>((c) => c.itemCount);
        return Badge(count: count, child: const Icon(Icons.cart));
      },
    ),
  );
}

// BIEN: Usar AnimatedBuilder para animaciones en vez de setState
AnimatedBuilder(
  animation: _controller,
  builder: (_, child) => Transform.rotate(
    angle: _controller.value * 2 * pi,
    child: child,  // child NO se reconstruye!
  ),
  child: const HeavyWidget(), // se construye UNA vez
)
```

## Beware: Common Performance Killers

```dart
// KILLER 1: Opacity widget con child pesado
// MAL: Opacity pinta child en buffer separado = caro
Opacity(opacity: 0.5, child: HeavyWidget())
// BIEN: Si el child no cambia, usa la propiedad opacity del propio widget
Text('Faded', style: TextStyle(color: Colors.black.withOpacity(0.5)))

// KILLER 2: Clip sin necesidad
// MAL: ClipRRect hace clipping en GPU
ClipRRect(borderRadius: BorderRadius.circular(8), child: Image(...))
// BIEN: Si la imagen cubre todo el area, usa BoxDecoration
Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), image: ...))

// KILLER 3: ColorFilter con Opacity en cada frame
// MAL: Se recrea el shader cada vez
ColorFiltered(colorFilter: ColorFilter.mode(Colors.red.withOpacity(0.5), BlendMode.srcIn), child: ...)
// BIEN: Usar shader precompilado o evitar animaciones continuas

// KILLER 4: BackdropFilter (blur) en scroll
// MAL: BackdropFilter dentro de ListView
// BIEN: Evitar blur en listas con scroll. O usar StaticBackdrop.
```
