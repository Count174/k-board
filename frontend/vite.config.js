import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // Ваш бэкенд
        changeOrigin: true,
      },
      // Картинки целей из корневого public/images (см. backend: /k-board/images)
      '/k-board/images': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    }
  },
  build: {
    outDir: 'dist',
  }
})