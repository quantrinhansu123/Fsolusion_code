import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Load .env from repo root (parent of app/) so a single root .env works with npm workspaces
  envDir: path.resolve(__dirname, '..'),
  plugins: [
    react(),
    tailwindcss(),
  ],
})
