import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/vscode-test/**/*.test.js',
  mocha: {
    ui: 'tdd',
    timeout: 60000
  }
});