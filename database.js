const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'image_analysis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initializeDatabase() {  
  try {
    await createDatabaseIfNotExists();
    await createTables();
    return true;
  } catch (error) {
    throw error;
  }
}

async function createDatabaseIfNotExists() {
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123456',
  });

  try {
    const dbName = process.env.DB_NAME || 'image_analysis';
    
    const result = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${dbName}`);
    } else {
    }
  } catch (error) {
  } finally {
    await adminPool.end();
  }
}

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
}

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
    throw error;
  }
}

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
    throw error;
  } finally {
    client.release();
  }
}

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
    throw error;
  }
}
function closePool() {
  return pool.end();
}
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