# Guía de Despliegue del Laboratorio de Programación Distribuida en AWS

Este documento detalla paso a paso cómo desplegar el laboratorio con Frontend y Bakend (backend) en instancias EC2, y una base de datos administrada en AWS RDS (PostgreSQL). Incluye configuración de red, variables, imágenes Docker, creación de tablas y conexión desde el backend.

## Objetivo

- Servir un frontend React (Vite) en una instancia EC2.
- Servir un backend Node/Express en otra instancia EC2.
- Conectar el backend a una base de datos PostgreSQL en RDS.
- Mantener seguridad y aislamiento mediante Security Groups en la misma subred/VPC.

## Arquitectura

- Frontend (EC2): contenedor Nginx sirviendo SPA, puerto `80`.
- Bakend (EC2): contenedor Node/Express, puerto `3000`.
- RDS (PostgreSQL): instancia gestionada, sin acceso público (recomendado).
- Networking: ambas EC2 en la misma subred; reglas de SG para permitir tráfico necesario.

## Prerrequisitos

- Dos instancias EC2 (Frontend y Bakend) en la misma subred.
- Una instancia RDS PostgreSQL creada (o a crear) con su endpoint y credenciales.
- Docker y Docker Compose instalados en ambas EC2.
- Acceso a AWS Console y permisos para RDS, EC2 y ECR (opcional).

## Security Groups (SG)

- Frontend SG:
  - Inbound: `80` desde `0.0.0.0/0` (HTTP público) o desde tu LB/WAF si aplica.
- Bakend SG:
  - Inbound: `3000` únicamente desde el SG del Frontend (referencia por SG).
- RDS SG:
  - Inbound: `5432` únicamente desde el SG del Bakend.

Asegúrate de asociar estos SG correctamente a cada recurso.

## RDS PostgreSQL: Creación y configuración

1. En AWS Console, ve a RDS > Create database.
2. Engine: `PostgreSQL` (versión soportada por `pg`, por ejemplo 14/15).
3. Templates: `Free tier` si aplica.
4. Settings: define `DB instance identifier`, `Master username` y `Master password`.
5. Connectivity:
   - VPC: la misma que tus EC2.
   - Subnets: grupos de subred preferentemente privados.
   - Public access: `No` (recomendado).
   - Security group: adjunta el SG de RDS (con inbound `5432` sólo desde el SG del Bakend).
6. Additional configuration:
   - Initial database name: opcional (puedes crearlo luego).
7. Create database y espera a que el estado sea `Available`.

### Parámetros de conexión

- Endpoint: `<endpoint-rds>.amazonaws.com` (no incluye puerto).
- Puerto: `5432`.
- Usuario: según definiste.
- Password: según definiste.
- Base de datos: la que crees (por ejemplo `labdb`).

### Ejemplo de esquema SQL (tablas)

Puedes ejecutar estos comandos con `psql` desde la instancia Bakend (que tiene acceso al RDS) o usando **Query Editor** de RDS.

```sql
-- Crear base de datos (si no se definió al crear RDS)
-- Requiere permisos: conéctate como usuario maestro a la BD postgres y crea otra BD.
CREATE DATABASE labdb;

-- Conéctate a la base de datos labdb
\c labdb;

-- Tabla de items
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Datos de ejemplo
INSERT INTO items (name, description) VALUES
  ('Item 1', 'Elemento de prueba'),
  ('Item 2', 'Segundo elemento');
```

#### Con `psql` desde EC2 (Bakend)

Instala `psql` si no lo tienes y conecta (usa SSL):

```bash
# En Ubuntu/Debian
sudo apt update
sudo apt install postgresql-client -y

# Conexión (ajusta endpoint, usuario y BD)
psql -h <endpoint-del-rds> -U <usuario> -d <nombre_base>
```


Luego pega el SQL del esquema.

## Bakend: configuración y despliegue

Estructura relevante en `Bakend/`:

- `src/index.js`: servidor Express con endpoints `/health` y `/api/items`. Conecta a RDS usando `pg` y un `Pool`.
- `.env.example`: plantilla de variables.
- `Dockerfile`: imagen Node (18-alpine).
- `docker-compose.yml`: orquesta el contenedor y carga `.env`.

### Variables de entorno (.env)

Edita tu archivo de entorno:
```sudo nano /Backend/environment ```


```
DATABASE_URL=postgresql://<usuario>:<contraseña>@<endpoint>:5432/<nombre_base>
```
Luego
```
source /Backend/environment
echo $DATABASE_URL
```
### Conexión a RDS en el código

Fragmento de `src/index.js`:

```js
import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now;')
    res.json({ ok: true, db_time: result.rows[0].now })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})
```

Endpoint que lee datos reales de la tabla `items` en RDS:

```js
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, created_at FROM items ORDER BY id ASC;')
    res.json(result.rows)
  } catch (err) {
    const message = err.message.includes('relation "items" does not exist')
      ? 'La tabla items no existe. Crea el esquema en RDS según la guía.'
      : err.message
    res.status(500).json({ ok: false, error: message })
  }
})
```

### Despliegue del Bakend (EC2)

1. Copia la carpeta `Bakend/` a la instancia.
2. Crea y rellena el archivo `.env` como arriba.
3. Ejecuta:

```bash
cd Bakend
docker compose up -d --build
```

4. Prueba:

```bash
curl http://localhost:3000/health
```

Si la conexión a RDS es correcta, verás `{ ok: true, db_time: ... }`.

## Frontend: configuración y despliegue

Estructura en `Frontend/`:

- `Dockerfile`: construye con Node y sirve con Nginx.
- `docker-compose.yml`: construye y expone `80:80`.
- `src/App.jsx`: consulta `VITE_API_URL/health` y muestra el resultado.
 - `.env.example`: variable `VITE_API_URL` de ejemplo para desarrollo.

### Variables de entorno

Define `VITE_API_URL` apuntando al Bakend (idealmente la IP privada en la misma VPC):

- Ejemplo: `http://<IP_privada_backend>:3000`

Formas de establecerla:
- En Docker Compose (build arg): `VITE_API_URL=http://<IP_privada_backend>:3000 docker compose up -d`
- En archivo `.env` tomando como base `Frontend/.env.example` (para builds locales con Vite).

### Despliegue del Frontend (EC2)

```bash
cd Frontend
# Construir imagen
docker compose build
# Levantar contenedor indicando el backend
VITE_API_URL=http://<IP_privada_backend>:3000 docker compose up -d
```

Accede en `http://<IP_o_DNS_publico_frontend>/` y verifica que muestra el estado del `/health`.

## Flujo de despliegue recomendado (paso a paso)

1. Crear RDS PostgreSQL y obtener `endpoint`.
2. Configurar SG: permitir `5432` desde SG del Bakend.
3. Crear el esquema de la BD (tablas `items` y `users`) vía `psql` o Query Editor.
4. En EC2 Bakend: copiar `Bakend/`, crear `.env`, levantar con `docker compose` y verificar `/health`.
   - Probar también `GET /api/items` para confirmar lectura real desde RDS.
5. Configurar SG del Bakend: permitir `3000` desde SG del Frontend.
6. En EC2 Frontend: copiar `Frontend/`, construir y levantar con `VITE_API_URL` apuntando al Bakend.
7. Probar desde el navegador `http://<IP_o_DNS_publico_frontend>/` y verificar lectura de `/health`.

## Opcional: Imágenes en ECR

Si prefieres construir/push imágenes una vez y sólo hacer `pull` en EC2:

1. Crear repos ECR: `frontend` y `bakend`.
2. Autenticarse con ECR:

```bash
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <acct-id>.dkr.ecr.<region>.amazonaws.com
```

3. Construir y etiquetar:

```bash
# Frontend
docker build -t <acct>.dkr.ecr.<region>.amazonaws.com/frontend:latest Frontend/
# Bakend
docker build -t <acct>.dkr.ecr.<region>.amazonaws.com/bakend:latest Bakend/
```

4. Subir:

```bash
docker push <acct>.dkr.ecr.<region>.amazonaws.com/frontend:latest
docker push <acct>.dkr.ecr.<region>.amazonaws.com/bakend:latest
```

5. En EC2, hacer `docker pull` y ejecutar contenedores con las variables correspondientes.

## Troubleshooting (solución de problemas)

- CORS: si el navegador bloquea requests, valida `CORS_ORIGIN` en `.env` del Bakend.
- SG/Red: si `/health` falla con error de conexión, revisa inbound `5432` del RDS y que el Bakend esté en la misma VPC/subred.
- SSL: errores `self signed certificate` pueden resolverse con `DB_SSL=true` y `rejectUnauthorized: false` (como en el código).
- DNS/Endpoint: usa el `endpoint` de RDS (no IP) y confirma que resuelve desde EC2 Bakend.
- Docker: revisa logs con `docker compose logs -f` en cada servicio.

## Referencias de archivos del repo

- `Frontend/`: Vite + React, servido por Nginx.
- `Bakend/`: Express + `pg` para PostgreSQL en RDS.
- `README.md`: guía resumida del proyecto.
- `Guia_Despliegue_AWS.md`: este documento con pasos detallados.

Con esta guía podrás realizar un despliegue exitoso del laboratorio en AWS, con separación clara de responsabilidades y seguridad adecuada en la red.
