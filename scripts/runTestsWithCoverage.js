const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'xvfb-run';
const args = isWin ? ['vscode-test', '--coverage'] : ['-a', 'npx', 'vscode-test', '--coverage'];

const result = spawnSync(cmd, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);