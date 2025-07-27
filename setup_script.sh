#!/bin/bash

echo "🚀 Configurando aplicación de análisis de imágenes..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instálalo primero."
    exit 1
fi

# Verificar si npm está instalado
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado. Por favor instálalo primero."
    exit 1
fi

print_status "Verificando versiones..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    print_status "Creando archivo .env..."
    cp .env.example .env
    print_warning "¡IMPORTANTE! Edita el archivo .env con tus credenciales reales antes de continuar."
else
    print_success "Archivo .env ya existe"
fi

# Instalar dependencias
print_status "Instalando dependencias de Node.js..."
npm install

# Crear directorio uploads si no existe
if [ ! -d "uploads" ]; then
    print_status "Creando directorio uploads..."
    mkdir uploads
    print_success "Directorio uploads creado"
fi

# Verificar si Docker está instalado
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    print_success "Docker y Docker Compose están disponibles"
    
    echo ""
    print_status "Para ejecutar con Docker:"
    echo "  docker-compose up --build"
    echo ""
    print_status "Para ejecutar en desarrollo:"
    echo "  npm run dev"
    echo ""
    
else
    print_warning "Docker no está instalado. Solo podrás ejecutar en modo desarrollo local."
    
    # Verificar si PostgreSQL está ejecutándose localmente
    if command -v psql &> /dev/null; then
        print_status "PostgreSQL detectado. Verificando conexión..."
        
        # Intentar conectar a PostgreSQL
        if pg_isready -h localhost -p 5432; then
            print_success "PostgreSQL está ejecutándose"
            
            # Crear base de datos si no existe
            print_status "Creando base de datos si no existe..."
            createdb image_analysis 2>/dev/null || print_warning "La base de datos ya existe o no se pudo crear"
            
            print_status "Para ejecutar la aplicación:"
            echo "  npm start"
            
        else
            print_error "PostgreSQL no está ejecutándose en localhost:5432"
            print_status "Opciones:"
            echo "1. Instalar y ejecutar PostgreSQL localmente"
            echo "2. Usar Docker: docker-compose up --build"
        fi
    else
        print_warning "PostgreSQL no está instalado localmente"
        print_status "Para instalar PostgreSQL:"
        echo "  - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
        echo "  - macOS: brew install postgresql"
        echo "  - Windows: Descargar desde https://www.postgresql.org/download/"
        echo ""
        print_status "O usar Docker: docker-compose up --build"
    fi
fi

echo ""
print_success "¡Configuración completada!"
print_status "No olvides:"
echo "1. Configurar tus credenciales de Imagga en el archivo .env"
echo "2. Ajustar la contraseña de PostgreSQL en .env y docker-compose.yml"
echo "3. Para producción, cambiar todas las contraseñas por defecto"

echo ""
print_status "Archivos importantes:"
echo "  - .env: Variables de entorno"
echo "  - docker-compose.yml: Configuración de Docker"
echo "  - README.md: Documentación completa"