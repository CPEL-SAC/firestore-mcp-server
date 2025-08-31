# 🚄 Guía: Desplegar servidor MCP verdadero en Railway

## 🎯 ¿Por qué Railway?

- ✅ **Gratuito**: $5 de crédito mensual
- ✅ **Conexiones persistentes**: Ideal para MCP
- ✅ **Siempre activo**: No se duerme
- ✅ **Fácil despliegue**: Connect con GitHub
- ✅ **Variables de entorno**: Manejo seguro

## 📋 Pasos para desplegar:

### 1. Crear cuenta en Railway
1. Ve a: https://railway.app
2. Regístrate con GitHub
3. Obtienes $5 gratis cada mes

### 2. Conectar el proyecto
1. **New Project** → **Deploy from GitHub repo**
2. Selecciona tu repositorio `firestore-mcp-server`
3. Railway detectará automáticamente el Dockerfile

### 3. Configurar variables de entorno
En el dashboard de Railway:
1. Ve a **Variables**
2. Agrega: `FIREBASE_SERVICE_ACCOUNT`
3. Valor: Tu JSON completo del service account

### 4. Desplegar
- Railway desplegará automáticamente
- Esperará unos 2-3 minutos
- Te dará una URL como: `https://tu-proyecto.railway.app`

## 🔗 Comando final para Claude Code:

```bash
claude mcp add https://tu-proyecto.railway.app/mcp
```

## 🧪 Verificar que funciona:

```bash
# Health check
curl https://tu-proyecto.railway.app/health

# Debería responder:
# {"status":"healthy","service":"firestore-mcp-server","timestamp":"..."}
```

## 📡 Endpoints del servidor MCP:

- **Health**: `GET /health`
- **MCP Server**: `POST /mcp` (Server-Sent Events)
- **Root**: `GET /` (Info básica)

## ⚙️ Características del servidor:

- ✅ Protocolo MCP estándar
- ✅ Server-Sent Events (SSE)
- ✅ Express.js con CORS
- ✅ Conexiones persistentes
- ✅ Compatible con `claude mcp add`

## 🔧 Si algo falla:

1. **Error de build**: Verifica que todas las dependencias estén en `package.json`
2. **Error de variables**: Asegúrate que `FIREBASE_SERVICE_ACCOUNT` esté bien configurado
3. **Error de conexión**: Railway asigna automáticamente el puerto via `process.env.PORT`

## 💰 Costos:

- **Gratuito**: $5 de crédito mensual
- **Uso típico de MCP**: ~$0.10-0.50/mes
- **Si se agota**: $5/mes por servicio adicional