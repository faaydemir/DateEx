import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ExtendedApp from './ExtendedApp.tsx'

const pathname = window.location.pathname.replace(/\/+$/, '')
const RootApp = pathname.endsWith('/extended') ? ExtendedApp : App

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RootApp />
    </StrictMode>,
  )
}
