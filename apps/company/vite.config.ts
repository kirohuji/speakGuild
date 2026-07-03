import { defineConfig, type Plugin } from 'vite'
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

export default defineConfig({
  plugins: [react(), ignoreResetSocketErrors()],
  publicDir: path.resolve(__dirname, '../frontend/public'),
  resolve: {
    alias: { '@': path.resolve(__dirname, '../frontend/src') },
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
  },
})
