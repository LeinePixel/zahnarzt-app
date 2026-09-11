// @vitest-environment node
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, it } from 'vitest'

async function freePort() {
  const reservation = createServer()
  await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('No local port')
  await new Promise<void>(resolve => reservation.close(() => resolve()))
  return address.port
}

it('starts a separate local process, authenticates health and terminates without credential output', async () => {
  const port = await freePort()
  const readToken = randomBytes(32).toString('hex')
  const testToken = randomBytes(32).toString('hex')
  // Only OS necessities and ephemeral test configuration; no inherited app/seed secrets.
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  Object.assign(env, { MOCK_PVS_PORT: String(port), MOCK_PVS_READ_TOKEN: readToken, MOCK_PVS_TEST_TOKEN: testToken })
  const child = spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'services/mock-pvs/server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let output = ''
  child.stdout.on('data', chunk => { output += String(chunk) })
  child.stderr.on('data', chunk => { output += String(chunk) })
  const closed = new Promise<void>((resolve, reject) => {
    child.once('close', () => resolve())
    child.once('error', () => reject(new Error('Mock-PVS smoke process could not start')))
  })
  try {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) break
      try {
        const response = await fetch(`http://127.0.0.1:${port}/v1/health`, { headers: { Authorization: 'Bearer ' + readToken }, signal: AbortSignal.timeout(500) })
        if (response.status === 200) {
          await expect(response.json()).resolves.toEqual({ data: { apiVersion: 'v1' } })
          ready = true
          break
        }
      } catch { /* Startup polling; never expose headers or response payloads. */ }
      await delay(100)
    }
    expect(ready).toBe(true)
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    await closed
    expect(output.includes(readToken) || output.includes(testToken)).toBe(false)
    expect(output.includes('Mock-PVS bereit auf Port ' + port + '.')).toBe(true)
  }
}, 20000)
