const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx' : 'xvfb-run';
const args = isWin ? ['vscode-test'] : ['-a', 'npx', 'vscode-test'];

const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
