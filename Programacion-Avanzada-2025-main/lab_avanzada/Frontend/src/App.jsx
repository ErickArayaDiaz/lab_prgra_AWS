import React, { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(setHealth)
      .catch(err => setHealth({ error: err.message }))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Laboratorio Distribuido - Frontend</h1>
      <p>Backend: {API_URL}</p>
      <p>Este frontend consulta el endpoint /health del backend.</p>
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </div>
  )
}