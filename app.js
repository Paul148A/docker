require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const FormData = require("form-data");

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

async function initializeApp() {
  
  try {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await initializeDatabase();
    const connected = await testConnection();
  } catch (error) {

  }
}

initializeApp();

app.post("/analyze", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;
  const originalFilename = req.file.originalname;

  const apiKey = "acc_0fea4690497a1c5";
  const apiSecret = "d196e3d8449271a3307eb68a4804bd5a";

  try {
    const form = new FormData();
    form.append("image", fs.createReadStream(imagePath));

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

    try {
      const analysisId = await insertImageAnalysis(uploadId, originalFilename, imagePath);
      await insertImageTags(analysisId, tags);
            
      res.json({ 
        tags,
        analysisId,
        message: 'Análisis guardado exitosamente'
      });
    } catch (dbError) {
      res.json({ 
        tags,
        warning: 'Análisis completado pero no se pudo guardar en base de datos'
      });
    }
    
  } catch (error) {
    res.status(500).json({ error: "Error al analizar la imagen." });
    
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
});

app.get("/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const analyses = await getRecentAnalysis(limit);
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

app.get("/analysis/:id", async (req, res) => {
  try {
    const analysisId = parseInt(req.params.id);
    const analysis = await getImageAnalysis(analysisId);
    
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado" });
    }
    
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener análisis" });
  }
});

process.on('SIGINT', async () => {
  const { closePool } = require('./database');
  await closePool();
  process.exit(0);
});

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});