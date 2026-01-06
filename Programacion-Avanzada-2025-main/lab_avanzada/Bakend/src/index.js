import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pkg from 'pg'

dotenv.config()

const { Pool } = pkg

const app = express()
app.use(express.json())
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))

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

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Backend escuchando en puerto ${port}`)
})