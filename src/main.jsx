import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { refreshSubscriptions } from './lib/billing'
import { setAuditSink } from './lib/audit'
import { writeAudit } from './lib/db'
import { isSupabaseConfigured } from './lib/supabase'

/* Offline demo only. Against the real backend a scheduled database function
   reconciles subscriptions hourly, and a second client-side opinion could only
   contradict it. */
if (!isSupabaseConfigured) refreshSubscriptions()

/* Every recordAudit() call also persists to the append-only audit_log, so the
   trail survives a reload and the school cannot edit it. */
setAuditSink((e) => writeAudit({
  action: e.action,
  actor: e.actor,
  actor_id: e.actor_id,
  role: e.role,
  school_id: e.school_id,
  target: e.target,
  detail: e.detail,
  severity: e.severity,
}))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
