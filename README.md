# Proyecto de Análisis de Imágenes con Node.js y PostgreSQL

Este proyecto es una aplicación Node.js que utiliza PostgreSQL como base de datos y PGAdmin para la administración de la base de datos. Todo el sistema se puede levantar fácilmente usando Docker Compose.

## Instrucciones rápidas

1. **Clona este repositorio:**

2. **Crear y Levantar todos los servicios:**
   docker build -t imagga-app . (Crear)

   docker compose up --build (Levantar)

   Esto iniciará:
   - La aplicación Node.js en `http://localhost:3000`
   - PostgreSQL en el contenedor `postgres`
   - PGAdmin en `http://localhost:8080` (usuario: `admin@admin.com`, contraseña: `admin`)

3. **Detén todos los servicios:**
   En otra terminal, dentro de la carpeta del proyecto:
   ```sh
   docker compose down
   ```

## Acceso a PGAdmin

- URL: [http://localhost:8080](http://localhost:8080)
- Usuario: `admin@admin.com`
- Contraseña: `admin`

Para conectar PGAdmin a la base de datos PostgreSQL, usa estos datos:
- **Host:** `postgres`
- **Puerto:** `5432`
- **Usuario:** `postgres`
- **Contraseña:** `123456`
- **Base de datos:** `image_analysis`

## Estructura del proyecto

- `app.js`: Código principal de la aplicación Node.js
- `database.js`: Configuración de la base de datos
- `Dockerfile`: Imagen de la app
- `docker-compose.yml`: Orquestación de servicios
- `public/`: Archivos estáticos (frontend)
- `uploads/`: Carpeta para archivos subidos

## Notas
- Todos los datos de la base de datos se almacenan en un volumen persistente (`postgres_data`).
- Si cambias variables de entorno, recuerda reconstruir los contenedores con `--build`.