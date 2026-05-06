# Flutter Platform-Specific Guide

## Method Channels (Avanzado)

Usar **Pigeon** para codigo fuertemente tipado en platform channels. Evita errores de runtime.

### Pigeon (Type-Safe Platform Channels)

```dart
// pigeon/messages.dart - Definicion compartida
import 'package:pigeon/pigeon.dart';

@ConfigurePigeon(
  PigeonOptions(
    dartOut: 'lib/platform/messages.g.dart',
    dartOptions: DartOptions(),
    kotlinOut: 'android/app/src/main/kotlin/com/example/app/Messages.g.kt',
    kotlinOptions: KotlinOptions(package: 'com.example.app'),
    swiftOut: 'ios/Runner/Messages.g.swift',
    swiftOptions: SwiftOptions(),
  ),
)

// Definir API host (que llama Flutter → Native)
@HostApi()
abstract class BiometricApi {
  @async bool authenticate(String reason);
  @async bool isAvailable();
}

// Definir API flutter (Native → Flutter callbacks)
@FlutterApi()
abstract class BiometricCallback {
  void onAuthSuccess();
  void onAuthError(String error);
}

// flutter pub run pigeon --input pigeon/messages.dart
```

```dart
// Flutter side: usar el API generado
final api = BiometricApi();
final available = await api.isAvailable();
if (available) {
  final result = await api.authenticate('Para acceder a tu cuenta');
  if (result) {
    BiometricCallback().onAuthSuccess();
  }
}
```

```kotlin
// Android: MainActivity.kt
class MainActivity : FlutterActivity() {
  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)

    // Registrar API host
    BiometricApi.setUp(flutterEngine.dartExecutor.binaryMessenger, BiometricApiHandler())

    // Registrar API flutter (para callbacks)
    BiometricCallback.setUp(flutterEngine.dartExecutor.binaryMessenger, BiometricCallbackImpl())
  }
}

class BiometricApiHandler : BiometricApi {
  override fun authenticate(reason: String, result: Result<Boolean>) {
    // Implementar con BiometricManager
    val biometricManager = BiometricManager.from(context)
    when (biometricManager.canAuthenticate(BIOMETRIC_STRONG)) {
      BiometricManager.BIOMETRIC_SUCCESS -> {
        // Mostrar prompt biometrico
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
          .setTitle("Autenticacion")
          .setDescription(reason)
          .setNegativeButtonText("Cancelar")
          .build()

        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            result.success(true)
          }
          override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            context.runOnUiThread { result.success(false) }
          }
          override fun onAuthenticationFailed() { /* ignored */ }
        })
        prompt.authenticate(promptInfo)
      }
      else -> result.success(false)
    }
  }

  override fun isAvailable(): Boolean {
    val manager = BiometricManager.from(context)
    return manager.canAuthenticate(BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
  }
}
```

```swift
// iOS: AppDelegate.swift
import UIKit
import Flutter
import LocalAuthentication

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller = window?.rootViewController as! FlutterViewController
    let messenger = controller.binaryMessenger

    BiometricApiSetup.setUp(binaryMessenger: messenger, api: BiometricApiHandler())
    BiometricCallbackSetup.setUp(binaryMessenger: messenger, api: BiometricCallbackImpl())

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

class BiometricApiHandler: NSObject, BiometricApi {
  func authenticate(reason: String) async throws -> Bool {
    let context = LAContext()
    var error: NSError?

    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
      return false
    }

    return try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
  }

  func isAvailable() throws -> Bool {
    let context = LAContext()
    var error: NSError?
    return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
  }
}
```

## Android-Specific

### Notifications (FCM)

```dart
// android/app/build.gradle
// implementation 'com.google.firebase:firebase-messaging:23.x.x'

// lib/services/notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  final _fcm = FirebaseMessaging.instance;

  Future<void> init() async {
    // Pedir permiso (iOS requiere esto)
    final settings = await _fcm.requestPermission(
      alert: true, badge: true, sound: true,
    );

    // Token FCM para enviar notificaciones
    final token = await _fcm.getToken();
    // Enviar token a backend: POST /api/devices { token }

    // Foreground: mostrar notificacion local
    FirebaseMessaging.onMessage.listen((msg) {
      _showLocalNotification(msg);
    });

    // Background tap: navegar a la pantalla correcta
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _handleNavigation(msg.data);
    });

    // App cerrada → abierta por notificacion
    final initialMsg = await _fcm.getInitialMessage();
    if (initialMsg != null) {
      _handleNavigation(initialMsg.data);
    }
  }

  void _handleNavigation(Map<String, dynamic> data) {
    final type = data['type'];
    final id = data['id'];
    // GoRouter: context.go('/${type}/${id}');
  }
}

// android/app/src/main/AndroidManifest.xml
// <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
// <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

### File Picker / Camera

```dart
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';

class MediaService {
  final _picker = ImagePicker();

  Future<File?> pickImage(ImageSource source) async {
    // Pedir permiso primero
    final status = source == ImageSource.camera
      ? await Permission.camera.request()
      : await Permission.photos.request();

    if (!status.isGranted) return null;

    final XFile? file = await _picker.pickImage(
      source: source,
      maxWidth: 1920,
      maxHeight: 1920,
      imageQuality: 85,
    );

    return file != null ? File(file.path) : null;
  }

  Future<List<File>> pickMultipleFiles({List<String>? allowedExtensions}) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: allowedExtensions != null ? FileType.custom : FileType.any,
      allowedExtensions: allowedExtensions,
    );

    return result?.paths.whereType<String>().map(File.new).toList() ?? [];
  }

  // Subir a servidor con Dio
  Future<String> uploadFile(File file) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: file.uri.pathSegments.last),
    });

    final response = await dio.post('/upload', data: formData);
    return response.data['url'];
  }
}
```

## iOS-Specific

### Keychain (Secure Storage)

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();

// iOS usa Keychain, Android usa EncryptedSharedPreferences
await storage.write(key: 'token', value: token);
final token = await storage.read(key: 'token');
await storage.delete(key: 'token');

// Options especificas de iOS
await storage.write(
  key: 'token',
  value: token,
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
    accountName: 'myapp_token',
  ),
);

// Options Android
await storage.write(
  key: 'token',
  value: token,
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
);
```

### iOS-Specific Settings (Info.plist)

```xml
<!-- Permisos de camara y fotos -->
<key>NSCameraUsageDescription</key>
<string>Necesitamos acceso a la camara para fotos de perfil</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Necesitamos acceso a tus fotos para seleccionar una imagen</string>

<!-- Biometria -->
<key>NSFaceIDUsageDescription</key>
<string>Usamos autenticacion biometrica para proteger tu cuenta</string>

<!-- Ubicacion -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Usamos tu ubicacion para mostrar contenido cercano</string>
```

## Android-Specific Settings (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>

<!-- Configurar app para release -->
<application
  android:label="MyApp"
  android:icon="@mipmap/ic_launcher"
  android:usesCleartextTraffic="false">
</application>
```

## Platform Detection

```dart
import 'dart:io';

class PlatformHelper {
  static bool get isIOS => Platform.isIOS;
  static bool get isAndroid => Platform.isAndroid;
  static bool get isWeb => kIsWeb;
  static bool get isDesktop => Platform.isMacOS || Platform.isWindows || Platform.isLinux;

  // Widget especifico por plataforma
  static Widget platformWidget({
    required Widget android,
    required Widget ios,
    Widget? desktop,
  }) {
    if (isIOS) return ios;
    if (isAndroid) return android;
    return desktop ?? const SizedBox.shrink();
  }

  // Estilo especifico por plataforma
  static EdgeInsets get safeAreaInsets {
    if (isIOS) return EdgeInsets.only(top: 44); // notch iOS
    if (isAndroid) return EdgeInsets.only(top: 24); // status bar Android
    return EdgeInsets.zero;
  }

  // Cupertino vs Material
  static Widget adaptiveLoadingIndicator() {
    if (isIOS) return const CupertinoActivityIndicator();
    return const CircularProgressIndicator();
  }
}

// Uso con PlatformWidget
Scaffold(
  appBar: PlatformHelper.isIOS
    ? CupertinoNavigationBar(middle: Text('Title'))
    : AppBar(title: Text('Title')),
  body: /* ... */,
)
```

## Build Config per Platform

```bash
# Build release con flavors
flutter build apk --flavor production --release
flutter build ios --flavor production --release
flutter build appbundle --release

# iOS: Podfile necesita configurarse
# ios/Podfile
platform :ios, '15.0'
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['ENABLE_BITCODE'] = 'NO'
    end
  end
end

# Android: ProGuard rules en android/app/proguard-rules.pro
# -keep class com.example.app.** { *; }
```
