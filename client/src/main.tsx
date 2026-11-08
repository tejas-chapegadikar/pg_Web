import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Maintenance from './pages/Maintenance.tsx'

// Set to true to show the "We'll be back soon" screen instead of the site
const MAINTENANCE = false

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MAINTENANCE ? <Maintenance /> : <App />}
  </StrictMode>,
)
