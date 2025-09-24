# Guia de despliegue en Railway

Railway es una buena opcion para ejecutar el servidor MCP porque ofrece un plan gratuito con credito mensual, permite conexiones persistentes y facilita la gestion de variables de entorno.

## Pasos rapidos
1. Crea una cuenta en https://railway.app e inicia sesion con GitHub.
2. Crea un proyecto nuevo y elige **Deploy from GitHub repo** apuntando a este repositorio.
3. Configura las variables de entorno en la pestana **Variables**:
   - `FIREBASE_SERVICE_ACCOUNT`: pega el JSON completo del service account.
4. Railway ejecutara `npm install`, `npm run build` y la start command que definas.

## Start commands sugeridos
- **Streamable HTTP (recomendado)**: `npm start`
- **SSE legado**: `npm run start:sse`

Railway suministra el puerto mediante `process.env.PORT`, ya manejado en el codigo.

## Verificacion
```bash
curl https://tu-proyecto.railway.app/health
# -> {"status":"healthy","service":"firestore-mcp-server",...}
```

## Integracion con clientes MCP
Usa la URL que entrega Railway (por ejemplo `https://tu-proyecto.railway.app/mcp`) y configura tu cliente con transporte `streamable-http`. Ejemplo para Claude/Codex/Gemini CLI:
```json
{
  "mcpServers": {
    "firestore": {
      "url": "https://tu-proyecto.railway.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## Problemas comunes
- **Fallo en el build**: revisa `package.json` y los logs de Railway.
- **Credenciales invalidas**: confirma que el JSON de `FIREBASE_SERVICE_ACCOUNT` es correcto.
- **Errores 4xx al llamar /mcp**: verifica que el cliente este enviando los encabezados/campos requeridos (`Mcp-Session-Id` en peticiones posteriores).

## Costos
El plan gratuito incluye 5 USD/mes en credito; un uso tipico del servidor MCP queda muy por debajo de ese limite. Si superas el credito, Railway cobra segun su plan base.
