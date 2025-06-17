const { spawnSync } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const isE2E = process.argv.includes('--e2e');

// Determine which tests to run
let testPath = './out/integration-test/index';
if (isE2E) {
  testPath = './out/e2e-test/index';
}

// Set environment variables for test configuration
const env = {
  ...process.env,
  VSCODE_TEST_PATH: testPath
};

// First run the tests normally
const cmd = isWin ? 'npx.cmd' : 'xvfb-run';
const args = isWin ? ['vscode-test'] : ['-a', 'npx', 'vscode-test'];

if (isE2E) {
  console.log('Running E2E tests...');
} else {
  console.log('Running integration tests...');
}

const testResult = spawnSync(cmd, args, { 
  stdio: 'inherit', 
  shell: isWin,
  env: env
});

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