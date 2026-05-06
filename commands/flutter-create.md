---
description: Create Flutter code (widgets, screens, features) with patterns from docs
agent: flutter-dev
subtask: true
---

$ARGUMENTS

Antes de generar codigo, DEBES leer:
- `.opencode/docs/flutter/index.md` - Patrones base
- `.opencode/docs/flutter/packages.md` - Paquetes comunes  
- `.opencode/docs/flutter/performance.md` - Optimizacion
- `.opencode/docs/flutter/platform.md` - Android/iOS

ESTANDARES:
- const constructors SIEMPRE que sea posible
- if (!mounted) return despues de await en StatefulWidget
- Keys: ValueKey(item.id), nunca index
- super.key en constructores
- Siempre dispose controllers, streams, listeners

DESPUES de generar el codigo, verifica con `flutter analyze` que no haya errores.
