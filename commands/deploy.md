# Comando: /deploy

Este comando genera e implementa pipelines de automatización CI/CD (GitHub Actions / GitLab CI) y scripts de despliegue según el entorno configurado.

---

## 1. Funcionamiento del Comando

Al invocar `/deploy`, el agente debe:
1. Detectar el repositorio y la tecnología utilizada en el proyecto.
2. Crear un pipeline de Integración Continua (CI) en `.github/workflows/verify.yml` para compilar, linter y pasar las pruebas automáticas en cada PR.
3. Generar scripts opcionales de despliegue con PM2 o configuraciones de proxy inverso (Nginx/IIS) según las necesidades del usuario.

---

## 2. Invocación de Agentes

Para completar este comando, se debe invocar a:
- `@devops-engineer` para estructurar los YAML de integración y redactar las instrucciones de despliegue seguras.

---

## 3. Ejemplo de Uso

```bash
/deploy github-actions
```

**Resultado:**
- Creación de `.github/workflows/verify.yml` con linter, tests y build automatizados.
- Sugerencia de secretos necesarios para el repositorio (ej. tokens de Docker Hub, llaves SSH).
- Creación de plantilla `ecosystem.config.js` para despliegues con PM2.
