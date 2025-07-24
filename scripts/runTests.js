const { runTests } = require('@vscode/test-electron');
const path = require('path');

async function main() {
  try {
    const isE2E = process.argv.includes('--e2e');
    
    // Determine which tests to run
    let testPath = path.resolve(__dirname, '../out/test/vscode-test/index.js');
    if (isE2E) {
      testPath = path.resolve(__dirname, '../out/test/e2e/index.js');
    }

    if (isE2E) {
      console.log('Running E2E tests...');
      console.log('Test runner path:', testPath);
    } else {
      console.log('Running VS Code integration tests...');
      console.log('Test runner path:', testPath);
    }

    // Debug environment info for CI
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const useXvfb = process.platform === 'linux' && !process.env.DISPLAY;
    console.log('Environment info:');
    console.log('  Platform:', process.platform);
    console.log('  CI:', isCI);
    console.log('  DISPLAY:', process.env.DISPLAY || '(not set)');
    console.log('  Will use xvfb-run:', useXvfb);

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: testPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      // Use xvfb-run on Linux when no display is available
      useXvfb: useXvfb
    });

    console.log('Tests completed successfully.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();