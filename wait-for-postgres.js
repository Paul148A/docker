const { Pool } = require('pg');

async function waitForPostgres() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // Conectar a la BD por defecto
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
  });

  const maxRetries = 30;
  const retryInterval = 2000; // 2 segundos

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`⏳ Intentando conectar a PostgreSQL (intento ${i + 1}/${maxRetries})...`);
      
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log('✅ PostgreSQL está listo!');
      await pool.end();
      return true;
      
    } catch (error) {
      console.log(`❌ Conexión fallida: ${error.message}`);
      
      if (i === maxRetries - 1) {
        console.error('🚨 No se pudo conectar a PostgreSQL después de todos los intentos');
        await pool.end();
        throw new Error('PostgreSQL no disponible');
      }
      
      console.log(`⏸️ Esperando ${retryInterval/1000} segundos antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  waitForPostgres()
    .then(() => {
      console.log('🎉 Listo para iniciar la aplicación');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error:', error.message);
      process.exit(1);
    });
}

module.exports = waitForPostgres;