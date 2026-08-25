import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const playwrightCli = resolve(
  process.cwd(),
  'node_modules/@playwright/test/cli.js',
)
const child = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
  env: { ...process.env, E2E_REQUIRE_EDGE: '1' },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 1)
  }
})
