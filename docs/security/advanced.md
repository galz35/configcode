# Guía de Seguridad Avanzada y OWASP Top 10

Esta guía describe las vulnerabilidades críticas del software web (OWASP Top 10), cómo mitigarlas mediante código seguro, y las prácticas avanzadas de seguridad a nivel de headers, comunicaciones e infraestructura.

---

## 1. OWASP Top 10 y Mitigación en Código

### A01: Control de Acceso Roto (Broken Access Control)
- **Riesgo:** El atacante puede acceder a recursos que no le corresponden modificando IDs en la URL o en la petición (inseguridad horizontal/vertical).
- **Mitigación ✅:**
  - Valida siempre que el usuario autenticado tiene permisos específicos sobre el recurso solicitado (no confíes solo en que el usuario está "logeado").
  - Usa identificadores UUIDv4 en lugar de enteros autoincrementales expuestos en la API para dificultar el scraping automatizado y adivinación de IDs.
  - Implementa control de acceso basado en roles (RBAC) o atributos (ABAC).

### A03: Inyección (Injection - SQL, Command, NoSQL)
- **Riesgo:** Concatenar entradas del usuario directamente en queries de bases de datos o comandos del sistema operativo.
- **Mitigación ✅:**
  - Usa **siempre** consultas parametrizadas (Prepared Statements) o un ORM confiable. Nunca concatenes variables a strings SQL.
  - Limita y sanitiza las entradas del usuario utilizando validación de esquemas estricta (ej: Zod, Joi).

**Antipatrón ❌ (Inyección SQL en Node/JS):**
```javascript
// El atacante puede enviar id = "1 OR 1=1"
const query = `SELECT * FROM Usuarios WHERE Id = ${id}`;
```
**Práctica Recomendada ✅ (Consulta Parametrizada):**
```javascript
const query = 'SELECT * FROM Usuarios WHERE Id = @id';
await request.input('id', sql.Int, id).query(query);
```

### A05: Configuración de Seguridad Incorrecta (Security Misconfiguration)
- **Riesgo:** Dejar servicios con contraseñas por defecto, debuggers habilitados en producción o exponer logs con stack traces completos a clientes externos.
- **Mitigación ✅:**
  - Deshabilita el header `X-Powered-By` para no revelar la tecnología del servidor.
  - Configura las cabeceras HTTP de seguridad a través del uso de middleware como `helmet`.

---

## 2. Cabeceras de Seguridad (HTTP Security Headers)

Es obligatorio configurar las siguientes cabeceras en el proxy inverso (Nginx/IIS) o a nivel de código de servidor (Helmet en Express/NestJS):

| Header | Valor Recomendado | Propósito |
| :--- | :--- | :--- |
| **Content-Security-Policy (CSP)** | `default-src 'self';` (ajustado según necesidades) | Previene ataques de Cross-Site Scripting (XSS) e inyección de datos controlando qué scripts se pueden ejecutar. |
| **Strict-Transport-Security (HSTS)** | `max-age=31536000; includeSubDomains; preload` | Fuerza al navegador a comunicarse únicamente mediante HTTPS seguro durante un año. |
| **X-Frame-Options** | `DENY` o `SAMEORIGIN` | Previene ataques de Clickjacking evitando que tu sitio sea embebido en iframes externos. |
| **X-Content-Type-Options** | `nosniff` | Evita que el navegador intente adivinar el MIME-type del archivo y ejecute scripts maliciosos disfrazados de imágenes. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Limita la cantidad de información enviada en la cabecera Referer al navegar a otros sitios. |

### Configuración con Helmet en Express/TypeScript:
```typescript
import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet()); // Configura por defecto las cabeceras de seguridad más recomendadas
```

---

## 3. Seguridad en Comunicaciones Móviles (SSL Pinning)

Para aplicaciones móviles (Flutter, Swift, Kotlin) que manejan información sensible, es vital evitar ataques de tipo Man-in-the-Middle (MitM) en redes Wi-Fi públicas.

- **SSL Pinning:** Consiste en embeber el certificado SSL (o su clave pública) del servidor dentro de la aplicación móvil.
- **Implementación:** Al realizar peticiones HTTPS, la aplicación rechaza cualquier conexión si el servidor no presenta exactamente el certificado preconfigurado, bloqueando proxies de intercepción como Charles Proxy o Fiddler.

### SSL Pinning en Flutter con Dio:
```dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';

void setupSecureClient() {
  final dio = Dio();
  
  // SHA-256 fingerprint de la clave pública del certificado SSL de tu servidor
  final List<String> allowedFingerprints = [
    "AA BB CC DD EE ... SHA-256 Fingerprint ..."
  ];

  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient(context: SecurityContext(withTrustedRoots: true));
      client.badCertificateCallback = (X509Certificate cert, String host, int port) {
        // Validar el certificado contra los fingerprints permitidos
        final String certFingerprint = getFingerprint(cert.sha256);
        return allowedFingerprints.contains(certFingerprint);
      };
      return client;
    }
  );
}
```

---

## 4. Auditoría de Dependencias y Supply Chain Security

Los atacantes suelen atacar vulnerabilidades en librerías de terceros (paquetes de npm, pub, cargo).

- **npm audit / yarn audit:** Corre estos comandos localmente y en el pipeline de CI/CD para detectar vulnerabilidades en dependencias.
  ```bash
  # Auditar y solucionar de forma segura
  npm audit fix
  
  # Forzar actualización en caso de vulnerabilidades críticas
  npm audit fix --force
  ```
- **OWASP Dependency-Check / Snyk:** Integra herramientas SAST en tus pipelines de desarrollo para bloquear el merge de ramas con vulnerabilidades de seguridad conocidas en su árbol de dependencias.
