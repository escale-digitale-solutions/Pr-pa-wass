import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relative : le build fonctionne à la racine d'un domaine comme dans un sous-dossier
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { chunkSizeWarningLimit: 1800 },
})
