import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const SERVER_SCRIPT = path.join(__dirname, 'server.js')
const RESTART_DELAY_MS = 1000

let serverChild: ChildProcess | null = null
let stopping = false

function startServer(): void {
  if (stopping) return

  serverChild = spawn(process.execPath, [SERVER_SCRIPT], { stdio: 'inherit' })

  serverChild.on('exit', (code, signal) => {
    serverChild = null
    if (stopping) return
    process.stderr.write(`[cc-catalyst] proxy exited (code=${code} signal=${signal}), restarting in ${RESTART_DELAY_MS}ms\n`)
    setTimeout(startServer, RESTART_DELAY_MS)
  })
}

process.on('SIGTERM', () => {
  stopping = true
  if (serverChild) serverChild.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGINT', () => {
  stopping = true
  if (serverChild) serverChild.kill('SIGTERM')
  process.exit(0)
})

startServer()
