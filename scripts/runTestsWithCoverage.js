const { spawnSync } = require('child_process');

const isWin = process.platform === 'win32';

// First run the tests normally
const cmd = isWin ? 'npx.cmd' : 'xvfb-run';
const args = isWin ? ['vscode-test'] : ['-a', 'npx', 'vscode-test'];

console.log('Running tests...');
const testResult = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin });

console.log('Test process finished.');

if (testResult.error) {
    console.error('Failed to start or kill the test process. Error details:', testResult.error);
    process.exit(1);
} else if (testResult.status !== 0) {
    console.error(`Tests failed. Exit status: ${testResult.status}, Signal: ${testResult.signal}`);
    process.exit(testResult.status === null ? 1 : testResult.status);
} else {
    console.log('Tests completed successfully.');
}

// Now generate coverage using c8 report with the correct temp directory
console.log('Generating coverage report...');
const c8Cmd = isWin ? 'npx.cmd' : 'npx';
const reportResult = spawnSync(c8Cmd, [
    'c8', 
    'report', 
    '--config', '.c8rc.json',
    '--temp-directory', 'coverage/tmp'
], { stdio: 'inherit' });

if (reportResult.status !== 0) {
    console.log('Could not generate c8 report, status:', reportResult.status);
} else {
    console.log('Coverage report generated successfully!');
}

process.exit(testResult.status ?? 0);