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
