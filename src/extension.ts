// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetfileUpdateService } from './puppetfileUpdateService';
import { DependencyTreeService } from './dependencyTreeService';
import { PuppetfileHoverProvider } from './puppetfileHoverProvider';
import { PuppetForgeService } from './puppetForgeService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "puppetfile-depgraph" is now active!');

	// Register commands defined in package.json
	const updateAllToSafe = vscode.commands.registerCommand('puppetfile-depgraph.updateAllToSafe', async () => {
		const parseResult = PuppetfileParser.parseActiveEditor();
		if (parseResult.errors.length > 0) {
			vscode.window.showErrorMessage(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
			return;
		}

		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Updating modules to safe versions",
			cancellable: false
		}, async (progress) => {
			try {
				progress.report({ increment: 0, message: "Checking for updates..." });
				
				const results = await PuppetfileUpdateService.updateAllToSafeVersions();
				const summary = PuppetfileUpdateService.generateUpdateSummary(results);
				
				progress.report({ increment: 100, message: "Update complete!" });
				
				// Show results in a new document
				const doc = await vscode.workspace.openTextDocument({
					content: summary,
					language: 'markdown'
				});
				await vscode.window.showTextDocument(doc);
				
			} catch (error) {
				vscode.window.showErrorMessage(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});
	});

	const updateAllToLatest = vscode.commands.registerCommand('puppetfile-depgraph.updateAllToLatest', async () => {
		const parseResult = PuppetfileParser.parseActiveEditor();
		if (parseResult.errors.length > 0) {
			vscode.window.showErrorMessage(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
			return;
		}

		// Show warning about latest versions potentially including pre-releases
		const proceed = await vscode.window.showWarningMessage(
			'This will update to the latest versions including pre-releases. Continue?',
			'Yes', 'No'
		);

		if (proceed !== 'Yes') {
			return;
		}

		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Updating modules to latest versions",
			cancellable: false
		}, async (progress) => {
			try {
				progress.report({ increment: 0, message: "Checking for updates..." });
				
				const results = await PuppetfileUpdateService.updateAllToLatestVersions();
				const summary = PuppetfileUpdateService.generateUpdateSummary(results);
				
				progress.report({ increment: 100, message: "Update complete!" });
				
				// Show results in a new document
				const doc = await vscode.workspace.openTextDocument({
					content: summary,
					language: 'markdown'
				});
				await vscode.window.showTextDocument(doc);
				
			} catch (error) {
				vscode.window.showErrorMessage(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		});
	});

        const showDependencyTree = vscode.commands.registerCommand('puppetfile-depgraph.showDependencyTree', async () => {
                const parseResult = PuppetfileParser.parseActiveEditor();
		if (parseResult.errors.length > 0) {
			vscode.window.showErrorMessage(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
			return;
		}

		// Show options for tree view
		const viewOption = await vscode.window.showQuickPick([
			{ label: 'Tree View', description: 'Show dependencies as a hierarchical tree', value: 'tree' },
			{ label: 'List View', description: 'Show dependencies as a flat list', value: 'list' }
		], {
			title: 'Choose dependency view format'
		});

		if (!viewOption) {
			return;
		}

		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Building dependency tree",
			cancellable: false
		}, async (progress) => {
			try {
				progress.report({ increment: 0, message: "Parsing dependencies..." });
				
				const dependencyTree = await DependencyTreeService.buildDependencyTree(parseResult.modules);
				
				progress.report({ increment: 70, message: "Generating view..." });
				
				let content = '';
				if (viewOption.value === 'tree') {
					content = `# Dependency Tree\n\n`;
					if (dependencyTree.length === 0) {
						content += 'No dependencies found.\n';
					} else {
						content += '```\n';
						content += DependencyTreeService.generateTreeText(dependencyTree);
						content += '```\n\n';
					}
				} else {
					content = `# Dependency List\n\n`;
					if (dependencyTree.length === 0) {
						content += 'No dependencies found.\n';
					} else {
						content += DependencyTreeService.generateListText(dependencyTree);
					}
				}

				// Check for conflicts
				const conflicts = DependencyTreeService.findConflicts(dependencyTree);
				if (conflicts.length > 0) {
					content += `\n## ⚠️ Potential Conflicts\n\n`;
					for (const conflict of conflicts) {
						content += `- ${conflict}\n`;
					}
				}
				
				progress.report({ increment: 100, message: "Complete!" });
				
				// Show results in a new document
				const doc = await vscode.workspace.openTextDocument({
					content: content,
					language: 'markdown'
				});
				await vscode.window.showTextDocument(doc);
				
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to build dependency tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
                });
        });

        const clearForgeCache = vscode.commands.registerCommand('puppetfile-depgraph.clearForgeCache', () => {
                PuppetForgeService.clearCache();
                vscode.window.showInformationMessage('Puppet Forge cache cleared successfully!');
        });

      	const clearCache = vscode.commands.registerCommand('puppetfile-depgraph.clearCache', () => {
		PuppetForgeService.clearCache();
		vscode.window.showInformationMessage('Puppet Forge cache cleared successfully!');
	});

        const updateModuleVersion = vscode.commands.registerCommand('puppetfile-depgraph.updateModuleVersion', async (...args: any[]) => {
                console.log('updateModuleVersion command called with args:', args);
                
                // Handle both direct object and array of objects
                let commandArgs: { line: number; version: string } | null = null;
                
                if (args.length > 0) {
                    if (Array.isArray(args[0]) && args[0].length > 0) {
                        commandArgs = args[0][0];
                    } else if (args[0] && typeof args[0] === 'object') {
                        commandArgs = args[0];
                    }
                }
                
                if (!commandArgs || typeof commandArgs.line !== 'number' || typeof commandArgs.version !== 'string') {
                    console.error('Invalid arguments for updateModuleVersion command:', commandArgs);
                    vscode.window.showErrorMessage('Invalid arguments for version update command');
                    return;
                }
                
                try {
                    await PuppetfileUpdateService.updateModuleVersionAtLine(commandArgs.line, commandArgs.version);
                    vscode.window.showInformationMessage(`Updated module to version ${commandArgs.version}`);
                } catch (error) {
                    console.error('Error updating module version:', error);
                    vscode.window.showErrorMessage(`Failed to update module: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
        });

        // Add all commands to subscriptions
        context.subscriptions.push(updateAllToSafe, updateAllToLatest, showDependencyTree, clearForgeCache, updateModuleVersion);

	// Register hover provider for Puppetfile (pattern-based to avoid duplicates)
	const hoverProvider = vscode.languages.registerHoverProvider(
		{ pattern: '**/Puppetfile' },
		new PuppetfileHoverProvider()
	);
	context.subscriptions.push(hoverProvider);
}

// This method is called when your extension is deactivated
export function deactivate() {}
