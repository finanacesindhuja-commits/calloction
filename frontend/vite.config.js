import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3007,
    proxy: {
      // In dev mode, forward all /api calls to the PM2 backend on 5007
      '/api': {
        target: 'http://localhost:5007',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
