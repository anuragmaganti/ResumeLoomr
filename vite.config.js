import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getVendorChunk(moduleId) {
  const id = moduleId.replaceAll('\\', '/')

  if (!id.includes('/node_modules/')) {
    return undefined
  }

  if (
    id.includes('/node_modules/react/')
    || id.includes('/node_modules/react-dom/')
    || id.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor'
  }

  if (
    id.includes('/node_modules/firebase/')
    || id.includes('/node_modules/@firebase/')
  ) {
    return 'firebase-vendor'
  }

  if (
    id.includes('/node_modules/motion/')
    || id.includes('/node_modules/motion-dom/')
    || id.includes('/node_modules/motion-utils/')
    || id.includes('/node_modules/framer-motion/')
  ) {
    return 'motion-vendor'
  }

  if (id.includes('/node_modules/@dnd-kit/')) {
    return 'dnd-vendor'
  }

  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: getVendorChunk,
      },
    },
  },
})
