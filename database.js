const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'image_analysis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  max: 20, // máximo número de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para inicializar la base de datos
async function initializeDatabase() {
  console.log('🔧 Inicializando base de datos...');
  
  try {
    // Intentar crear la base de datos si no existe
    await createDatabaseIfNotExists();
    
    // Crear las tablas
    await createTables();
    
    console.log('✅ Base de datos inicializada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    throw error;
  }
}

// Función para crear la base de datos si no existe
async function createDatabaseIfNotExists() {
  // Conectar a PostgreSQL sin especificar base de datos
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Base de datos por defecto
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
  });

  try {
    const dbName = process.env.DB_NAME || 'image_analysis';
    
    // Verificar si la base de datos existe
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`📦 Creando base de datos: ${dbName}`);
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Base de datos ${dbName} creada`);
    } else {
      console.log(`✅ Base de datos ${dbName} ya existe`);
    }
  } catch (error) {
    console.log('ℹ️ No se pudo crear la base de datos automáticamente:', error.message);
    console.log('🔍 Asegúrate de que la base de datos existe manualmente');
  } finally {
    await adminPool.end();
  }
}

// Función para crear las tablas
async function createTables() {
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
    console.log('📋 Creando tablas...');
    await pool.query(createTablesSQL);
    console.log('✅ Tablas creadas/verificadas correctamente');
  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
    throw error;
  }
}

// Función para insertar análisis de imagen
async function insertImageAnalysis(uploadId, originalFilename, filePath) {
  const query = `
    INSERT INTO image_analysis (upload_id, original_filename, file_path)
    VALUES ($1, $2, $3)
    RETURNING id
  `;
  
  try {
    const result = await pool.query(query, [uploadId, originalFilename, filePath]);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error insertando análisis de imagen:', error);
    throw error;
  }
}

// Función para insertar tags de una imagen
async function insertImageTags(analysisId, tags) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const tag of tags) {
      const query = `
        INSERT INTO image_tags (analysis_id, tag_name, confidence)
        VALUES ($1, $2, $3)
      `;
      await client.query(query, [analysisId, tag.tag, parseFloat(tag.confidence)]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error insertando tags:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Función para obtener análisis con sus tags
async function getImageAnalysis(analysisId) {
  const query = `
    SELECT 
      ia.id,
      ia.upload_id,
      ia.original_filename,
      ia.file_path,
      ia.created_at,
      json_agg(
        json_build_object(
          'tag_name', it.tag_name,
          'confidence', it.confidence
        )
      ) as tags
    FROM image_analysis ia
    LEFT JOIN image_tags it ON ia.id = it.analysis_id
    WHERE ia.id = $1
    GROUP BY ia.id, ia.upload_id, ia.original_filename, ia.file_path, ia.created_at
  `;
  
  try {
    const result = await pool.query(query, [analysisId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error obteniendo análisis:', error);
    throw error;
  }
}

// Función para obtener todos los análisis recientes
async function getRecentAnalysis(limit = 10) {
  const query = `
    SELECT 
      ia.id,
      ia.upload_id,
      ia.original_filename,
      ia.created_at,
      COUNT(it.id) as tags_count
    FROM image_analysis ia
    LEFT JOIN image_tags it ON ia.id = it.analysis_id
    GROUP BY ia.id, ia.upload_id, ia.original_filename, ia.created_at
    ORDER BY ia.created_at DESC
    LIMIT $1
  `;
  
  try {
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error obteniendo análisis recientes:', error);
    throw error;
  }
}

// Función para cerrar la conexión del pool
function closePool() {
  return pool.end();
}

// Función para probar la conexión
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Conexión a PostgreSQL exitosa:', result.rows[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('Error conectando a PostgreSQL:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  initializeDatabase,
  insertImageAnalysis,
  insertImageTags,
  getImageAnalysis,
  getRecentAnalysis,
  closePool,
  testConnection
};