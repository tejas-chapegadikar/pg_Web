import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Maintenance from './pages/Maintenance.tsx'

// Set to false to bring the site back
const MAINTENANCE = true

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MAINTENANCE ? <Maintenance /> : <App />}
  </StrictMode>,
)
