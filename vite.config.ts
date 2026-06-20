import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Ruta base para GitHub Pages (project page bajo /ConvergenceOnline/)
  base: '/ConvergenceOnline/',
  plugins: [react()],
  build: {
    // Generar la build en /docs para servirla desde GitHub Pages
    outDir: 'docs',
    emptyOutDir: true,
  },
})
