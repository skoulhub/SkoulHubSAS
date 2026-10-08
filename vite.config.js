import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind 4 integrates with Vite through its own plugin. Going through
  // PostCSS instead lets Vite inline `@import "tailwindcss"` first, which
  // breaks v4's source resolution and silently emits no utilities.
  plugins: [react(), tailwindcss()],
})
