/**
 * ui.jsx
 * ─────────────────────────────────────────────────────────────
 * Shared presentation primitives for the self-contained pages
 * (Profile, Subscription). Every colour comes from a CSS variable
 * so the components follow light/dark automatically.
 * ───────────────────────────────────────────────────────────── */

/* ── Primitives (token-based so they follow the theme) ───────── */

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border ${className}`} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div>
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {hint && !error && <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>{hint}</p>}
      {error && <p className="text-[11px] mt-1 text-red-500">{error}</p>}
    </div>
  );
}

const inputStyle = (error) => ({
  background: 'var(--surface)',
  borderColor: error ? '#ef4444' : 'var(--border-strong)',
  color: 'var(--text)',
});

function TextInput({ error, className = '', ...rest }) {
  return (
    <input
      {...rest}
      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${className}`}
      style={inputStyle(error)}
    />
  );
}

function Select({ children, ...rest }) {
  return (
    <select {...rest} className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none appearance-none"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 disabled:opacity-50"
      style={{ background: checked ? '#1E45FC' : 'var(--surface-3)' }}>
      <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
        style={{ left: checked ? 'calc(100% - 18px)' : '2px' }} />
    </button>
  );
}

function ReadOnlyRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  );
}

function PrimaryButton({ children, className = '', ...rest }) {
  return (
    <button {...rest}
      className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 ${className}`}
      style={{ background: '#1E45FC' }}>
      {children}
    </button>
  );
}

function GhostButton({ children, className = '', ...rest }) {
  return (
    <button {...rest}
      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${className}`}
      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)', background: 'var(--surface)' }}>
      {children}
    </button>
  );
}

/** Deterministic QR-looking grid (demo only — no real provisioning). */
function QRMock({ value = 'skoulhub', size = 108 }) {
  const hash = [...value].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  const N = 13;
  const cell = size / N;
  const on = (r, c) => {
    const finder = (r < 4 && c < 4) || (r < 4 && c >= N - 4) || (r >= N - 4 && c < 4);
    if (finder) return (r === 0 || r === 3 || c === 0 || c === 3 || (r === 1 && c === 1) || (r === 2 && c === 2)) ? 1 : 0;
    return ((hash >> ((r * N + c) % 31)) & 1) ^ ((r * c) & 1);
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Authenticator QR code">
      <rect width={size} height={size} rx="8" fill="white" />
      {Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) =>
        on(r, c) ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0B0F2A" /> : null
      ))}
    </svg>
  );
}

function CodeInput({ value, onChange, label }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric" placeholder="000000" aria-label={label}
      className="w-40 px-3.5 py-2.5 rounded-xl border text-center text-lg font-bold tracking-[0.35em] outline-none"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text)' }}
    />
  );
}

export { Card, SectionHeader, Field, TextInput, Select, Toggle, ReadOnlyRow, PrimaryButton, GhostButton, QRMock, CodeInput };
