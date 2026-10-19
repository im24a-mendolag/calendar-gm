import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // The Hono API runs on :3001 in dev (server/dev.ts); on Vercel it's a function under /api.
    proxy: { '/api': 'http://localhost:3001' },
  },
})
