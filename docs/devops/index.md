# Guía DevOps, Despliegue y Monitoreo

Esta guía establece los estándares de infraestructura, automatización (CI/CD), contenedores, despliegue y monitoreo de aplicaciones para entornos de desarrollo, staging y producción.

---

## 1. Estrategia de Contenedores (Docker)

El uso de Docker es obligatorio para garantizar la paridad entre entornos de desarrollo y producción.

- **Imágenes Multi-Stage:** Utiliza siempre compilaciones multi-stage para compilar los binarios en un entorno limpio y luego copiar solo el output necesario a una imagen de ejecución ligera (como Alpine o Distroless). Esto reduce drásticamente el peso de las imágenes y la superficie de ataque.
- **Docker Compose para Local:** Provee siempre un archivo `docker-compose.yml` para levantar la base de datos (SQL Server, Postgres, Redis) y cualquier servicio satélite necesario para ejecutar la aplicación localmente con un solo comando.
- **Variables de Entorno:** Nunca guardes credenciales o secretos en el Dockerfile o la imagen. Utiliza siempre variables de entorno pasadas al contenedor en runtime.

*(Ver la guía específica en [docker.md](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/devops/docker.md) para ejemplos de configuración).*

---

## 2. Automatización CI/CD (GitHub Actions)

Los pipelines de Integración Continua (CI) y Entrega Continua (CD) deben ser rápidos, deterministas y seguros.

### Pipeline Base (CI)
Toda PR o push a `main`/`develop` debe disparar el pipeline de verificación:

```yaml
name: Verify Application

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install Dependencies
        run: npm ci
        
      - name: Lint Code
        run: npm run lint
        
      - name: Run Tests
        run: npm run test:cov
        
      - name: Compile Code
        run: npm run build
```

### Reglas de CI/CD:
1. **No saltarse pasos:** El pipeline debe fallar si hay errores de linter, typecheck o tests.
2. **Secretos seguros:** Los tokens de deploy y contraseñas de producción deben guardarse como Secrets en GitHub (nunca en texto plano en el repo).
3. **Caché activa:** Utiliza siempre la caché del manejador de paquetes (`npm`, `cargo`, `pub`) para agilizar las compilaciones de CI.

---

## 3. Servidores Web y Proxies Inversos

En producción, la aplicación nunca debe exponerse directamente a internet en su puerto nativo (ej: 3000, 5000). Se debe usar un Proxy Inverso por delante.

### Nginx (Recomendado para Linux)
Usa Nginx para manejar la terminación SSL/TLS, compresión Gzip, HTTP/2, y redirigir las peticiones al backend.

**Configuración típica de Nginx (`/etc/nginx/sites-available/app`):**
```nginx
server {
    listen 80;
    server_name app.dominio.com;
    return 301 https://$host$request_uri; # Redirigir HTTP a HTTPS
}

server {
    listen 443 ssl http2;
    server_name app.dominio.com;

    ssl_certificate /etc/letsencrypt/live/app.dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.dominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Compresión gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        proxy_pass http://localhost:3000; # Dirección interna del backend Node/Rust
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### IIS (Internet Information Services - Recomendado para Windows Server)
Si la infraestructura está basada en Windows Server:
1. Instalar **Application Request Routing (ARR)** y **URL Rewrite**.
2. Habilitar el proxy en ARR Application Request Routing Cache -> Server Settings -> Enable proxy.
3. Configurar la regla de Url Rewrite en el archivo `web.config` del sitio web para mapear las llamadas del puerto 80/443 al puerto local de tu API Node.js/Rust (ej. `http://localhost:3000`).

---

## 4. Gestión de Procesos (PM2)

Para aplicaciones Node.js en producción (Linux/Windows) sin contenedorización completa, usa **PM2** para mantener el proceso vivo, balancear la carga y auto-reiniciar en caso de caída.

### Archivo de Configuración (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [
    {
      name: 'node-express-api',
      script: 'dist/main.js',
      instances: 'max', // Levanta una instancia por núcleo de CPU (cluster mode)
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G', // Reinicia si el proceso consume más de 1GB
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

**Comandos básicos de PM2:**
```bash
# Iniciar app en producción
pm2 start ecosystem.config.js --env production

# Guardar lista de procesos para revivir al reiniciar el servidor
pm2 save

# Ver logs en tiempo real
pm2 logs

# Ver dashboard de monitoreo rápido
pm2 monit
```

---

## 5. SSL, Seguridad y Certificados

- **Let's Encrypt / Certbot:** Configura renovación automática de certificados SSL con Certbot cada 90 días en Linux.
  ```bash
  sudo certbot --nginx -d app.dominio.com
  ```
- **HSTS (HTTP Strict Transport Security):** Fuerza a los navegadores a usar solo conexiones HTTPS configurando las cabeceras correspondientes en tu proxy inverso.
- **SSL Labs:** Valida que la configuración de tu SSL obtenga calificación **A+** ejecutando la auditoría en [SSL Labs](https://www.ssllabs.com/ssltest/).

---

## 6. Monitoreo, Alertas y Logs

- **Structured Logging:** Imprime los logs en formato JSON estructurado en producción (no uses `console.log` sueltos). Esto permite parsearlos fácilmente con recolectores de logs (Winston/Pino en Node, Tracing en Rust).
- **APM (Application Performance Monitoring):**
  - **Sentry:** Para captura de errores en tiempo real y trazas en frontend, backend y móvil.
  - **Prometheus + Grafana:** Para métricas de servidor (CPU, RAM, disco) y métricas de API (tiempos de respuesta, volumen de peticiones, códigos HTTP).
- **Health Checks:** Expón un endpoint simple `/health` o `/status` que verifique la conexión con la Base de Datos y caché (Redis) para que los balanceadores de carga sepan cuándo rotar o retirar un servidor de la red.
