require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const FormData = require("form-data");

// Importar funciones de base de datos
const {
  insertImageAnalysis,
  insertImageTags,
  getImageAnalysis,
  getRecentAnalysis,
  testConnection,
  initializeDatabase
} = require('./database');

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));
app.use(express.json());

// Inicializar base de datos y probar conexión al iniciar
async function initializeApp() {
  console.log('🚀 Inicializando aplicación...');
  
  try {
    // Esperar un poco para que PostgreSQL esté listo
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Inicializar base de datos (crear tablas si no existen)
    await initializeDatabase();
    
    // Probar conexión
    const connected = await testConnection();
    
    if (connected) {
      console.log('✅ Base de datos inicializada correctamente');
    } else {
      console.log('⚠️ Advertencia: Problemas con la conexión a la base de datos');
    }
  } catch (error) {
    console.error('❌ Error inicializando la aplicación:', error.message);
    console.log('⚠️ La aplicación continuará sin persistencia en base de datos');
  }
}

// Llamar a la inicialización
initializeApp();

// Endpoint para analizar imagen (actualizado)
app.post("/analyze", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;
  const originalFilename = req.file.originalname;

  const apiKey = "acc_0fea4690497a1c5";
  const apiSecret = "d196e3d8449271a3307eb68a4804bd5a";

  try {
    // Paso 1: Crear el form-data con el archivo bajo el campo 'image'
    const form = new FormData();
    form.append("image", fs.createReadStream(imagePath));

    // Paso 2: Subir la imagen a Imagga
    const uploadResponse = await axios.post(
      "https://api.imagga.com/v2/uploads",
      form,
      {
        auth: {
          username: apiKey,
          password: apiSecret,
        },
        headers: form.getHeaders(),
      }
    );

    const uploadId = uploadResponse.data.result.upload_id;

    // Paso 3: Obtener etiquetas
    const tagResponse = await axios.get(
      `https://api.imagga.com/v2/tags?image_upload_id=${uploadId}`,
      {
        auth: {
          username: apiKey,
          password: apiSecret,
        },
      }
    );

    const tags = tagResponse.data.result.tags.map(tag => ({
      tag: tag.tag.en,
      confidence: tag.confidence.toFixed(2),
    }));

    // Paso 4: Guardar en base de datos
    try {
      const analysisId = await insertImageAnalysis(uploadId, originalFilename, imagePath);
      await insertImageTags(analysisId, tags);
      
      console.log(`Análisis guardado con ID: ${analysisId}`);
      
      // Responder con los tags y el ID del análisis
      res.json({ 
        tags,
        analysisId,
        message: 'Análisis guardado exitosamente'
      });
    } catch (dbError) {
      console.error('Error guardando en base de datos:', dbError);
      // Aún devolver los tags aunque falle la BD
      res.json({ 
        tags,
        warning: 'Análisis completado pero no se pudo guardar en base de datos'
      });
    }

    // Limpieza del archivo temporal (opcional - podrías mantenerlo)
    // fs.unlinkSync(imagePath);
    
  } catch (error) {
    console.error("Error en análisis:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al analizar la imagen." });
    
    // Limpiar archivo en caso de error
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
});

// Endpoint para obtener historial de análisis
app.get("/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const analyses = await getRecentAnalysis(limit);
    res.json(analyses);
  } catch (error) {
    console.error("Error obteniendo historial:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// Endpoint para obtener un análisis específico con sus tags
app.get("/analysis/:id", async (req, res) => {
  try {
    const analysisId = parseInt(req.params.id);
    const analysis = await getImageAnalysis(analysisId);
    
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado" });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error("Error obteniendo análisis:", error);
    res.status(500).json({ error: "Error al obtener análisis" });
  }
});

// Endpoint para obtener estadísticas
app.get("/stats", async (req, res) => {
  try {
    const { pool } = require('./database');
    
    const totalAnalysisResult = await pool.query('SELECT COUNT(*) as total FROM image_analysis');
    const totalTagsResult = await pool.query('SELECT COUNT(*) as total FROM image_tags');
    const topTagsResult = await pool.query(`
      SELECT tag_name, COUNT(*) as frequency, AVG(confidence) as avg_confidence
      FROM image_tags 
      GROUP BY tag_name 
      ORDER BY frequency DESC 
      LIMIT 10
    `);
    
    res.json({
      totalAnalysis: parseInt(totalAnalysisResult.rows[0].total),
      totalTags: parseInt(totalTagsResult.rows[0].total),
      topTags: topTagsResult.rows
    });
  } catch (error) {
    console.error("Error obteniendo estadísticas:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// Manejo graceful del cierre de la aplicación
process.on('SIGINT', async () => {
  console.log('\nCerrando aplicación...');
  const { closePool } = require('./database');
  await closePool();
  process.exit(0);
});

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});