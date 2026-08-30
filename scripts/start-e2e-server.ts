import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

import { getConfiguredE2ePort, withoutSeedSecrets } from './e2e-server-env'

const nextCli = resolve(process.cwd(), 'node_modules/next/dist/bin/next')
const child = spawn(process.execPath, [nextCli, 'start', '--port', String(getConfiguredE2ePort())], {
  env: withoutSeedSecrets(process.env),
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 1)
  }
})
