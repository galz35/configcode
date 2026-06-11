# Plantillas de Docker y Docker Compose

Esta guía recopila configuraciones de Docker optimizadas para producción y desarrollo local utilizando multi-stage builds y buenas prácticas de seguridad.

---

## 1. Node.js (Express / NestJS) - Producción

Esta plantilla utiliza una compilación en dos fases (Multi-Stage) y ejecuta la aplicación final usando un usuario sin privilegios (`node`), reduciendo la superficie de vulnerabilidad.

```dockerfile
# --- FASE 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copiar manifiestos
COPY package*.json ./

# Instalar dependencias completas (incluyendo devDependencies)
RUN npm ci

# Copiar el código fuente
COPY . .

# Compilar TypeScript a JavaScript de producción
RUN npm run build

# Remover devDependencies y limpiar caché
RUN npm prune --production && npm cache clean --force

# --- FASE 2: Runner ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copiar solo lo estrictamente necesario desde la fase build
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Usar usuario no administrativo provisto por la imagen de Node Alpine
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

---

## 2. Rust - Producción (Binario optimizado)

Compilar en Rust es costoso, por lo que usamos la caché de Cargo y entregamos una imagen final basada en Alpine extremadamente liviana (~15MB en total).

```dockerfile
# --- FASE 1: Builder ---
FROM rust:1.75-alpine AS builder

# Instalar librerías nativas necesarias para compilación
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static

WORKDIR /usr/src/app

# Truco para cachear dependencias antes de copiar el código fuente
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src/

# Copiar código real
COPY src ./src

# Forzar rebuild del código del usuario y no de las dependencias compiladas
RUN touch src/main.rs
RUN cargo build --release

# --- FASE 2: Runner ---
FROM alpine:3.19 AS runner

RUN apk add --no-cache ca-certificates libgcc libssl3

WORKDIR /usr/src/app

# Copiar el binario compilado
COPY --from=builder /usr/src/app/target/release/mi-app-rust ./app

# Crear usuario seguro
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

CMD ["./app"]
```

---

## 3. Flutter Web - Producción (Nginx)

Despliegue de aplicación compilada para entorno web con Nginx para servir los archivos estáticos de forma ultra-rápida.

```dockerfile
# --- FASE 1: Compilador Flutter ---
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y curl git unzip xz-utils zip libglu1-mesa && rm -rf /var/lib/apt/lists/*

# Descargar Flutter SDK
RUN git clone https://github.com/flutter/flutter.git -b stable /usr/local/flutter
ENV PATH="/usr/local/flutter/bin:/usr/local/flutter/bin/cache/dart-sdk/bin:${PATH}"

# Correr flutter doctor y habilitar web
RUN flutter doctor
RUN flutter config --enable-web

WORKDIR /app
COPY . .

# Compilar la aplicación web
RUN flutter pub get
RUN flutter build web --release

# --- FASE 2: Servidor Nginx ---
FROM nginx:1.25-alpine AS runner

# Limpiar default webroot
RUN rm -rf /usr/share/nginx/html/*

# Copiar archivos compilados
COPY --from=builder /app/build/web /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

---

## 4. Docker Compose para Desarrollo Local

El siguiente `docker-compose.yml` levanta un entorno local completo de desarrollo con bases de datos SQL Server y PostgreSQL, con variables seguras y almacenamiento de datos persistente.

```yaml
version: '3.8'

services:
  # Base de Datos SQL Server Local
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: mssql-db-dev
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=YourSecurePassword123!
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql
    networks:
      - dev-network

  # Base de Datos PostgreSQL Local (Opcional)
  postgres:
    image: postgres:16-alpine
    container_name: postgres-db-dev
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgrespass
      - POSTGRES_DB=dev_database
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - dev-network

  # Servidor Redis para Cache/Sesiones (Opcional)
  redis:
    image: redis:7-alpine
    container_name: redis-cache-dev
    ports:
      - "6379:6379"
    networks:
      - dev-network

volumes:
  mssql_data:
    driver: local
  postgres_data:
    driver: local

networks:
  dev-network:
    driver: bridge
```

---

## 5. Prácticas Clave en Docker

- **Ignorar archivos innecesarios:** Crea siempre un archivo `.dockerignore` al lado de tu `Dockerfile` para no mandar a la imagen carpetas como `node_modules`, `dist`, `.git`, `.env` ni logs locales.
- **Mantenerse actualizado:** Utiliza tags de versiones específicas de las imágenes base (ej: `node:20-alpine` en lugar de `node:latest`) para evitar que nuevas versiones de imágenes rompan tus builds de forma inesperada.
- **Seguridad en imágenes:** Corre herramientas de escaneo como `trivy` o `docker scout` en tu pipeline para auditar las imágenes en busca de vulnerabilidades antes de subirlas al registro (Docker Hub, AWS ECR, Azure ACR).
