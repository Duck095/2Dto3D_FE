import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { extname, isAbsolute, resolve, sep } from 'node:path'
import { resolveBackendPort } from './src/config/localBackendConfig.js'

// Add a file here only after its commercial/public permissions are verified.
// Individual allowlisting keeps local internal assets available without
// copying the complete public directory into the production build.
const PUBLIC_APPROVED_ASSETS = []

function approvedPublicAssetsPlugin() {
  return {
    name: 'approved-public-assets',
    apply: 'build',
    generateBundle() {
      const publicRoot = resolve(process.cwd(), 'public')
      const allowedExtensions = new Set(['.avif', '.bin', '.glb', '.gltf', '.jpeg', '.jpg', '.mp4', '.png', '.stl', '.svg', '.webm', '.webp'])

      for (const assetPath of PUBLIC_APPROVED_ASSETS) {
        const normalizedPath = assetPath.replaceAll('\\', '/')
        if (isAbsolute(normalizedPath) || normalizedPath.split('/').includes('..')) {
          this.error(`Approved public asset path must stay inside public/: ${assetPath}`)
        }

        const sourcePath = resolve(publicRoot, normalizedPath)
        if (!sourcePath.startsWith(`${publicRoot}${sep}`) || !existsSync(sourcePath)) {
          this.error(`Approved public asset does not exist inside public/: ${assetPath}`)
        }
        if (!allowedExtensions.has(extname(sourcePath).toLowerCase())) {
          this.error(`Unsupported public asset type in allowlist: ${assetPath}`)
        }

        this.emitFile({
          type: 'asset',
          fileName: normalizedPath,
          source: readFileSync(sourcePath),
        })
      }
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const backendDir = resolve(process.cwd(), '../2Dto3D_BE')
  const backendEnvironment = loadEnv(mode, backendDir, 'BACKEND_PORT')
  const backendPort = resolveBackendPort(process.env.BACKEND_PORT ?? backendEnvironment.BACKEND_PORT)

  return {
  plugins: [react(), approvedPublicAssetsPlugin()],
  // Keep user-provided product files available to local internal testing while
  // excluding every unapproved asset from production output.
  publicDir: command === 'build' ? false : 'public',
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js ecosystem — largest dependency
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          // React core + router + DOM
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Animation library
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
  }
})
