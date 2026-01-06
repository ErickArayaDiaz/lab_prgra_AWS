# Bakend (Backend)

API en Express con endpoint `/health` que comprueba conexión a RDS (PostgreSQL) y `/api/items` de ejemplo.

## Uso local (Docker)

1. Copia `.env.example` a `.env` y ajusta valores.
2. Construye y levanta:

```
cd Bakend
docker compose up -d --build
```

Accede en `http://localhost:3000/health`.

## Variables de entorno

- `PORT`: Puerto de la API.
- `CORS_ORIGIN`: Origen permitido para CORS (frontend).
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`: conexión a RDS.