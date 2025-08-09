// Configuration for VS Code integration tests
module.exports = {
  // Test files patterns
  files: [
    'out/integration-test/**/*.test.js',
    'out/e2e-test/**/*.test.js'
  ],
  
  // Mocha options
  mocha: {
    ui: 'tdd',
    timeout: 60000,
    color: true,
    reporter: 'spec'
  },
  
  // VS Code launch options
  launchArgs: [
    '--disable-extensions',
    '--disable-gpu'
  ],
  
  // Extension development host options
  extensionDevelopmentPath: __dirname,
  extensionTestsPath: './out/integration-test/index'
};