import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Maintenance from './pages/Maintenance.tsx'

// On for the live site only, so the real app still runs on localhost. Set to false to bring the site back.
const MAINTENANCE = import.meta.env.PROD

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MAINTENANCE ? <Maintenance /> : <App />}
  </StrictMode>,
)
