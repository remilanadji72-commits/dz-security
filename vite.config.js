import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // On augmente la limite d'avertissement de 500kb à 1500kb (1.5 MB)
    chunkSizeWarningLimit: 1500,
  }
})
