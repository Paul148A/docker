#!/usr/bin/env node

/**
 * Script para iniciar la aplicación localmente sin Docker
 * Maneja la creación automática de base de datos y tablas
 */

require("dotenv").config();
const { spawn } = require('child_process');
const { Pool } = require('pg');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.blue) {
  console.log(`${color}[SETUP]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function error(message) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function warning(message) {
  console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

async function checkPostgreSQL() {
  log('Verificando conexión a PostgreSQL...');
  
  // Primero intentar conectar a la base de datos por defecto
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
  });

  try {
    const client = await adminPool.connect();
    await client.query('SELECT 1');
    client.release();
    success('Conexión a PostgreSQL exitosa');
    
    // Verificar/crear base de datos
    await createDatabaseIfNeeded(adminPool);
    await adminPool.end();
    
    return true;
  } catch (err) {
    error(`No se pudo conectar a PostgreSQL: ${err.message}`);
    error('Asegúrate de que:');
    console.log('  1. PostgreSQL esté instalado y ejecutándose');
    console.log('  2. Las credenciales en .env sean correctas');
    console.log('  3. El usuario tenga permisos para crear bases de datos');
    console.log('');
    console.log('Para instalar PostgreSQL:');
    console.log('  - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib');
    console.log('  - macOS: brew install postgresql && brew services start postgresql');
    console.log('  - Windows: https://www.postgresql.org/download/');
    
    await adminPool.end();
    return false;
  }
}

async function createDatabaseIfNeeded(adminPool) {
  const dbName = process.env.DB_NAME || 'image_analysis';
  
  try {
    // Verificar si la base de datos existe
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      log(`Creando base de datos: ${dbName}`);
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      success(`Base de datos ${dbName} creada exitosamente`);
    } else {
      success(`Base de datos ${dbName} ya existe`);
    }
  } catch (err) {
    error(`Error manejando base de datos: ${err.message}`);
    throw err;
  }
}

async function createTables() {
  log('Verificando/creando tablas...');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'image_analysis',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
  });

  const createTablesSQL = `
    -- Crear tabla para almacenar análisis de imágenes
    CREATE TABLE IF NOT EXISTS image_analysis (
        id SERIAL PRIMARY KEY,
        upload_id VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255),
        file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Crear tabla para almacenar las etiquetas/tags
    CREATE TABLE IF NOT EXISTS image_tags (
        id SERIAL PRIMARY KEY,
        analysis_id INTEGER REFERENCES image_analysis(id) ON DELETE CASCADE,
        tag_name VARCHAR(255) NOT NULL,
        confidence DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Crear índices para mejorar rendimiento
    CREATE INDEX IF NOT EXISTS idx_image_analysis_upload_id ON image_analysis(upload_id);
    CREATE INDEX IF NOT EXISTS idx_image_tags_analysis_id ON image_tags(analysis_id);
    CREATE INDEX IF NOT EXISTS idx_image_analysis_created_at ON image_analysis(created_at);
  `;

  try {
    await pool.query(createTablesSQL);
    success('Tablas creadas/verificadas correctamente');
    await pool.end();
    return true;
  } catch (err) {
    error(`Error creando tablas: ${err.message}`);
    await pool.end();
    return false;
  }
}

function startApplication() {
  log('Iniciando aplicación...');
  
  const app = spawn('node', ['app.js'], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  app.on('error', (err) => {
    error(`Error iniciando aplicación: ${err.message}`);
    process.exit(1);
  });

  app.on('close', (code) => {
    if (code !== 0) {
      error(`Aplicación terminó con código: ${code}`);
      process.exit(code);
    }
  });

  // Manejar señales para terminar gracefully
  process.on('SIGINT', () => {
    log('Cerrando aplicación...');
    app.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    log('Cerrando aplicación...');
    app.kill('SIGTERM');
  });
}

async function main() {
  console.log(`${colors.cyan}🚀 Iniciando aplicación de análisis de imágenes${colors.reset}`);
  console.log('');

  // Verificar archivo .env
  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'your_password') {
    warning('Parece que no has configurado el archivo .env correctamente');
    warning('Copia .env.example a .env y configura tus credenciales');
    console.log('');
  }

  try {
    // Verificar PostgreSQL
    const pgReady = await checkPostgreSQL();
    if (!pgReady) {
      process.exit(1);
    }

    // Crear tablas
    const tablesReady = await createTables();
    if (!tablesReady) {
      process.exit(1);
    }

    console.log('');
    success('¡Base de datos lista!');
    console.log('');
    log('La aplicación estará disponible en: http://localhost:3000');
    console.log('');

    // Iniciar aplicación
    startApplication();

  } catch (err) {
    error(`Error en la inicialización: ${err.message}`);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { checkPostgreSQL, createTables };