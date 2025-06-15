import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/integration-test/**/*.test.js',
	coverage: {
		reporter: ['text', 'lcov', 'html'],
		exclude: ['**/test/**', '**/integration-test/**', '**/node_modules/**'],
		include: ['out/**/*.js'],
		reportsDir: 'coverage'
	}
});
