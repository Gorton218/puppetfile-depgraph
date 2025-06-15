import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	coverage: {
		reporter: ['text', 'lcov', 'html'],
		exclude: ['**/test/**', '**/node_modules/**'],
		include: ['out/**/*.js'],
		reportsDir: 'coverage'
	}
});
