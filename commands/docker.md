# Comando: /docker

Este comando analiza el repositorio actual, identifica el stack tecnológico y genera archivos `Dockerfile` y `docker-compose.yml` optimizados y seguros para producción y desarrollo local.

---

## 1. Funcionamiento del Comando

Al invocar `/docker`, el agente debe:
1. Inspeccionar la raíz del proyecto para detectar el stack (presencia de `package.json`, `Cargo.toml`, `pubspec.yaml`, etc.).
2. Crear un archivo `Dockerfile` multi-stage optimizado para producción en la raíz del proyecto.
3. Crear un archivo `docker-compose.yml` con servicios auxiliares (como SQL Server, Postgres, Redis) configurados.
4. Crear un archivo `.dockerignore` para omitir dependencias pesadas y archivos locales.

---

## 2. Invocación de Agentes

Para completar este comando, se debe invocar a:
- `@devops-engineer` para diseñar y escribir los archivos de configuración de contenedores, garantizando las mejores prácticas de seguridad de red y optimización de capas de almacenamiento.

---

## 3. Ejemplo de Salida Generada

El comando genera e inyecta archivos basados en las plantillas de:
- [Plantillas Docker y Compose](file:///d:/PROYECTOS_PORTAL/SolicitudEmpleo/configcode/docs/devops/docker.md)
