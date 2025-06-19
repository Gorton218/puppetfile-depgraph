import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 60000 // Increase timeout for integration tests
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise(async (c, e) => {
    try {
      console.log('Test discovery starting...');
      console.log('Tests root:', testsRoot);
      
      const files = await glob('**/*.test.js', { cwd: testsRoot });
      console.log('Found test files:', files);
      
      if (files.length === 0) {
        console.log('No test files found! Looking for any .js files...');
        const allFiles = await glob('**/*.js', { cwd: testsRoot });
        console.log('All JS files:', allFiles);
      }
      
      // Add files to the test suite
      files.forEach((f: string) => {
        const fullPath = path.resolve(testsRoot, f);
        console.log('Adding test file:', fullPath);
        mocha.addFile(fullPath);
      });

      console.log('Starting mocha run...');
      // Run the mocha test
      mocha.run((failures: number) => {
        console.log('Mocha run completed with', failures, 'failures');
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      console.error('Error in test runner:', err);
      e(err);
    }
  });
}