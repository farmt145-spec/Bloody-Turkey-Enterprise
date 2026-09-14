import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import App from './App.tsx'
import { registerServiceWorker } from '@/lib/offline'
import { AuthProvider } from '@/providers/auth'

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TRPCProvider>
          <App />
        </TRPCProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
