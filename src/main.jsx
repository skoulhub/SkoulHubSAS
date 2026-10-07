import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { refreshSubscriptions } from './lib/billing'

/* Reconcile subscriptions/invoices before the first paint — the role a nightly
   billing job plays in production. */
refreshSubscriptions()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
