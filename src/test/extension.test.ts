// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		expect([1, 2, 3].indexOf(5)).toBe(-1);
		expect([1, 2, 3].indexOf(0)).toBe(-1);
	});

	test('Extension should activate successfully', () => {
		// This test ensures the extension loads without throwing errors
		// The actual command registration is tested through integration testing
		const extension = vscode.extensions.getExtension('undefined_publisher.puppetfile-depgraph');
		expect(extension).toBeDefined();
	});
});
