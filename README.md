# Firestore MCP Server

Un servidor MCP (Model Context Protocol) que permite a asistentes de IA como Claude Code, Gemini CLI y otros acceder y consultar datos de Firestore de manera segura.

## Características

- **Lista de colecciones**: Obtén todas las colecciones disponibles en tu base de datos
- **Inspección de esquemas**: Analiza la estructura y tipos de datos de los documentos
- **Consultas complejas**: Realiza filtros, ordenación y agregaciones avanzadas
- **Solo lectura**: Configurado con permisos de solo lectura para máxima seguridad

## Herramientas disponibles

### 1. `list_collections`
Lista todas las colecciones en la base de datos Firestore.

**Parámetros**: Ninguno

**Ejemplo de uso**:
```
¿Qué colecciones tienes disponibles?
```

### 2. `inspect_collection_schema`
Analiza la estructura de los documentos en una colección muestreando documentos.

**Parámetros**:
- `collectionPath` (string, requerido): Ruta de la colección a inspeccionar
- `sampleSize` (number, opcional): Número de documentos a muestrear (predeterminado: 10)

**Ejemplo de uso**:
```
Inspecciona el esquema de la colección "usuarios"
```

### 3. `query_firestore`
Ejecuta consultas complejas con filtros, ordenación y agregaciones.

**Parámetros**:
- `collectionPath` (string, requerido): Ruta de la colección a consultar
- `filters` (array, opcional): Condiciones de filtro
- `orderBy` (array, opcional): Campos para ordenar
- `limit` (number, opcional): Número máximo de documentos
- `aggregation` (object, opcional): Operaciones de agregación (count, sum, avg)

**Ejemplos de uso**:
```
¿Qué cliente hace más apuestas?
¿Cuántos agentes se crearon el último mes?
¿Cuál es la cantidad total apostada este mes?
```

## Instalación

1. Clona o descarga este proyecto
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las credenciales de Google Cloud:
   ```bash
   cp .env.example .env
   # Edita .env con el JSON completo de tu service account
   ```
4. Construye el proyecto:
   ```bash
   npm run build
   ```

## Configuración

### Service Account de Google Cloud

1. Ve a la [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a "IAM & Admin" > "Service Accounts"
4. Crea una nueva service account con permisos de solo lectura a Firestore
5. Descarga el archivo JSON de credenciales
6. Copia el contenido completo del JSON en la variable `FIREBASE_SERVICE_ACCOUNT` en tu archivo `.env`
   - Importante: El JSON debe estar en una sola línea y escapado correctamente
   - Puedes usar herramientas online para minimizar el JSON si es necesario

### Configuración en Claude Code

Agrega el servidor a tu configuración de Claude Code:

```json
{
  "mcpServers": {
    "firestore": {
      "command": "node",
      "args": ["/ruta/completa/al/proyecto/firestore-mcp-server/dist/index.js"],
      "env": {
        "FIREBASE_SERVICE_ACCOUNT": "{\"type\":\"service_account\",\"project_id\":\"tu-project-id\",\"private_key_id\":\"...\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\",\"client_email\":\"tu-service-account@tu-project.iam.gserviceaccount.com\",\"client_id\":\"...\",\"auth_uri\":\"https://accounts.google.com/o/oauth2/auth\",\"token_uri\":\"https://oauth2.googleapis.com/token\",\"auth_provider_x509_cert_url\":\"https://www.googleapis.com/oauth2/v1/certs\",\"client_x509_cert_url\":\"...\"}"
      }
    }
  }
}
```

## Uso

Una vez configurado, puedes hacer preguntas como:

- "¿Qué colecciones tienes disponibles?"
- "Inspecciona el esquema de la colección 'usuarios'"
- "¿Cuántos documentos hay en la colección 'apuestas'?"
- "Muéstrame los últimos 10 agentes creados"
- "¿Cuál es la suma total de las apuestas de este mes?"
- "Encuentra todos los usuarios activos ordenados por fecha de creación"

## Estructura del proyecto

```
firestore-mcp-server/
├── src/
│   └── index.ts          # Servidor MCP principal
├── dist/                 # Código compilado
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Desarrollo

Para desarrollo local:

```bash
npm run dev
```

Para compilar:

```bash
npm run build
```

Para ejecutar la versión compilada:

```bash
npm start
```

## Seguridad

- El servidor solo tiene permisos de lectura
- Todas las conexiones requieren autenticación válida de Google Cloud
- Las credenciales se manejan a través de variables de entorno
- No se exponen credenciales en el código

## Compatibilidad

Compatible con el estándar MCP (Model Context Protocol) y probado con:
- Claude Code
- Gemini CLI
- Otros clientes MCP estándar