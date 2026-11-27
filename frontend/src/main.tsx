import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Texto: Nunito · Títulos e números de destaque: Sora
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import '@fontsource/sora/800.css'
import './index.css'
import { setupPwa } from './lib/pwa'

setupPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
