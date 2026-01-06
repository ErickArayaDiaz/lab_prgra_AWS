# Frontend

Pequeño frontend con React + Vite que consulta el backend en `/health`.

## Uso local (Docker)

- Ajusta la variable `VITE_API_URL` para que apunte al backend (por ejemplo `http://<IP_privada_backend>:3000`).
- Construye y levanta:

```
cd Frontend
docker compose build
VITE_API_URL=http://localhost:3000 docker compose up -d
```

Accede en `http://localhost/`.

## Variables de entorno relevantes

- `VITE_API_URL`: URL del backend (se inyecta en build de Vite). Puedes crear un `.env` tomando como base `.env.example` y Vite lo leerá al construir si corres `npm run build` localmente; en Docker se pasa como `build args` y `environment` en `docker-compose.yml`.