# Flutter App Template

Plantilla premium para desarrollo de aplicaciones móviles multiplataforma utilizando Flutter, Riverpod, GoRouter y almacenamiento Offline-First.

## Estructura de Proyecto Sugerida

El agente o arquitecto debe estructurar el código en `lib/` bajo el siguiente patrón de Clean Architecture:

```text
lib/
├── main.dart
├── core/                  # Utilidades compartidas, red, almacenamiento
│   ├── network/           # Configuración de Dio
│   └── theme/             # Paleta de colores Material 3
└── features/              # Módulos de negocio (ej. autenticación, perfil)
    └── auth/
        ├── data/          # Modelos, Repositorios remotos/locales
        ├── domain/        # Entidades, Casos de uso
        └── presentation/  # Widgets, Screens, Providers de Riverpod
```

## Configuración Inicial

1. **Obtener Dependencias:**
   ```bash
   flutter pub get
   ```

2. **Generar Modelos (si usas build_runner):**
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

3. **Ejecutar Pruebas:**
   ```bash
   flutter test
   ```
