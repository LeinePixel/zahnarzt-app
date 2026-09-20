import type { Server } from 'node:http'
import { loadMockPvsConfig } from './config'
import { createMockPvsServer } from './router'

export function startMockPvsServer(): Server {
  const config = loadMockPvsConfig()
  const server = createMockPvsServer(config)
  let closing = false
  const close = () => {
    if (closing) return
    closing = true
    server.close()
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
  server.on('close', () => {
    process.off('SIGINT', close)
    process.off('SIGTERM', close)
  })
  server.on('error', () => {
    process.stderr.write('Mock-PVS konnte nicht gestartet werden.\n')
    process.exitCode = 1
  })
  server.listen(config.port, '127.0.0.1', () => process.stdout.write('Mock-PVS bereit auf Port ' + config.port + '.\n'))
  return server
}

try { startMockPvsServer() } catch {
  process.stderr.write('Mock-PVS-Konfiguration ist ungültig.\n')
  process.exitCode = 1
}
