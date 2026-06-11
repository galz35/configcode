# Express API Template

Plantilla premium para desarrollo de APIs REST ultra rápidas usando Express + TypeScript, consultas SQL directas y estructuración modular.

## Configuración Inicial

1. **Instalar Dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Entorno:**
   Crea un archivo `.env` en la raíz con las siguientes variables:
   ```env
   PORT=3000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:3000
   DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
   DB_USER=sa
   DB_PASSWORD=YourPassword123!
   DB_SERVER=localhost
   DB_NAME=master
   ```

3. **Correr en Desarrollo:**
   ```bash
   npm run dev
   ```

4. **Compilar para Producción:**
   ```bash
   npm run build
   npm start
   ```

## Reglas Clave
- **Sin ORMs:** Escribe tus consultas SQL parametrizadas en `src/db.ts` utilizando los helpers provistos.
- **Manejo de Errores:** Lanza instancias de `AppError` en tus servicios para retornar respuestas formateadas al cliente automáticamente.
