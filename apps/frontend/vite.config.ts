import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function ignoreResetSocketErrors(): Plugin {
  return {
    name: 'ignore-reset-socket-errors',
    configureServer(server) {
      server.httpServer?.on('connection', (socket) => {
        socket.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'ECONNRESET' || error.code === 'EPIPE') return

          server.config.logger.error(error.stack || error.message)
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), ignoreResetSocketErrors()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      exclude: ['@capgo/capacitor-wechat'],
    },
  }
})
