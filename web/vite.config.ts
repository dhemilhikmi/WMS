import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4101,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
