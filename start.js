// Launcher for `npm start`. Some terminals (VS Code's, for one) set ELECTRON_RUN_AS_NODE,
// which makes Electron run as plain Node and crash; drop it before starting the app.
const { spawn } = require('child_process')
const electron = require('electron')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', code => process.exit(code ?? 0))
