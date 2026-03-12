// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PuppetfileParser } from './puppetfileParser';
import { PuppetfileUpdateService } from './services/puppetfileUpdateService';
import { DependencyTreeService, DependencyNode } from './services/dependencyTreeService';
import { PuppetfileHoverProvider } from './puppetfileHoverProvider';
import { PuppetForgeService } from './services/puppetForgeService';
import { GitMetadataService } from './services/gitMetadataService';
import { CacheService } from './services/cacheService';
import { UpgradePlannerService } from './services/upgradePlannerService';
import { UpgradeDiffProvider } from './services/upgradeDiffProvider';
import { PuppetfileCodeLensProvider } from './puppetfileCodeLensProvider';
import { UpgradeDiffCodeLensProvider } from './services/upgradeDiffCodeLensProvider';

// Track if extension has been activated
export let extensionActivated = false;

/** Phase 2 animation state for dependency tree progress */
interface Phase2State {
	active: boolean;
	animation: NodeJS.Timeout | null;
	currentTotalProgress: number;
	message: string;
	lastMessageUpdate: number;
}

/** Cache direct modules with progress reporting (Phase 1: 0-30%) */
async function cacheDirectModules(
	forgeModules: ReturnType<typeof PuppetfileParser.parseActiveEditor>['modules'],
	token: vscode.CancellationToken,
	progress: vscode.Progress<{ increment?: number; message?: string }>
): Promise<void> {
	const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
	if (uncachedModules.length === 0) {
		progress.report({ increment: 30, message: "Phase 1: All direct modules already cached" });
		return;
	}

	let lastPhase1Progress = 0;
	await CacheService.cacheUncachedModulesWithProgressiveUpdates(
		forgeModules,
		token,
		(completed: number, total: number) => {
			if (token.isCancellationRequested) { return; }
			if (total === 0) { return; }
			const targetProgress = Math.round((completed / total) * 30);
			const incrementAmount = targetProgress - lastPhase1Progress;
			if (incrementAmount > 0) {
				progress.report({
					increment: incrementAmount,
					message: `Phase 1: Cached ${completed}/${total} direct modules...`
				});
				lastPhase1Progress = targetProgress;
			}
		}
	);
	const finalIncrement = 30 - lastPhase1Progress;
	if (finalIncrement > 0) {
		progress.report({ increment: finalIncrement, message: "Phase 1: Caching complete" });
	}
}

/** Start Phase 2 animation interval for transitive dependency resolution */
function startPhase2Animation(
	state: Phase2State,
	token: vscode.CancellationToken,
	progress: vscode.Progress<{ increment?: number; message?: string }>
): void {
	let animationPosition = 0;
	let animationDirection = 1;
	const phase2BaseProgress = 30;
	const phase2Range = 40;

	state.animation = setInterval(() => {
		if (!state.active || token.isCancellationRequested) {
			if (state.animation) { clearInterval(state.animation); }
			return;
		}
		if (Date.now() - state.lastMessageUpdate <= 500) { return; }

		animationPosition += animationDirection * 0.05;
		if (animationPosition >= 1) { animationPosition = 1; animationDirection = -1; }
		else if (animationPosition <= 0) { animationPosition = 0; animationDirection = 1; }

		const targetProgress = phase2BaseProgress + (animationPosition * phase2Range);
		const incrementNeeded = targetProgress - state.currentTotalProgress;
		if (Math.abs(incrementNeeded) > 0.5) {
			progress.report({ increment: incrementNeeded, message: state.message });
			state.currentTotalProgress = targetProgress;
		}
	}, 200);
}

/** Stop Phase 2 animation and clean up */
function stopPhase2Animation(state: Phase2State): void {
	state.active = false;
	if (state.animation) { clearInterval(state.animation); }
}

/** Create progress callback for dependency tree building */
function createTreeProgressCallback(
	state: Phase2State,
	token: vscode.CancellationToken,
	progress: vscode.Progress<{ increment?: number; message?: string }>
): (message: string, phase?: 'tree' | 'conflicts', moduleCount?: number, totalModules?: number) => void {
	return (message, phase, moduleCount, totalModules) => {
		if (token.isCancellationRequested) { return; }
		if (phase === 'conflicts' && moduleCount !== undefined && totalModules !== undefined) {
			stopPhase2Animation(state);
			const progressTo70 = 70 - state.currentTotalProgress;
			if (progressTo70 > 0) {
				progress.report({ increment: progressTo70, message: "Phase 3: Starting conflict analysis..." });
				state.currentTotalProgress = 70;
			}
			// Handle case where there are no modules to analyze to avoid NaN progress.
			if (totalModules === 0) {
				const targetPhase3Progress = 100;
				const phase3Increment = targetPhase3Progress - state.currentTotalProgress;
				if (phase3Increment > 0) {
					progress.report({ increment: phase3Increment, message: `Phase 3: ${message}` });
					state.currentTotalProgress = targetPhase3Progress;
				} else {
					progress.report({ increment: 0, message: `Phase 3: ${message}` });
				}
				return;
			}
			const targetPhase3Progress = 70 + Math.round((moduleCount / totalModules) * 30);
			const phase3Increment = targetPhase3Progress - state.currentTotalProgress;
			if (phase3Increment > 0) {
				progress.report({ increment: phase3Increment, message: `Phase 3: ${message}` });
				state.currentTotalProgress = targetPhase3Progress;
			} else {
				progress.report({ increment: 0, message: `Phase 3: ${message}` });
			}
		} else {
			state.message = `Phase 2: ${message}`;
			state.lastMessageUpdate = Date.now();
			progress.report({ increment: 0, message: state.message });
		}
	};
}

/** Generate dependency tree content as markdown */
function generateDependencyContent(
	viewOption: string,
	dependencyTree: DependencyNode[]
): string {
	let content = '';
	if (viewOption === 'tree') {
		content = `# Dependency Tree\n\n`;
		content += dependencyTree.length === 0
			? 'No dependencies found.\n'
			: '```\n' + DependencyTreeService.generateTreeText(dependencyTree) + '```\n\n';
	} else {
		content = `# Dependency List\n\n`;
		content += dependencyTree.length === 0
			? 'No dependencies found.\n'
			: DependencyTreeService.generateListText(dependencyTree);
	}

	const conflicts = DependencyTreeService.findConflicts(dependencyTree);
	if (conflicts.length > 0) {
		content += `\n## ⚠️ Potential Conflicts\n\n`;
		for (const conflict of conflicts) {
			content += `- ${conflict}\n`;
		}
	}
	return content;
}

export function __test_only_reset_extension_activated() {
  extensionActivated = false;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Prevent multiple activations
	if (extensionActivated) {
		console.log('Puppetfile Dependency Manager: Extension already activated, skipping re-activation');
		return;
	}
	extensionActivated = true;

	// Get extension version from package.json
	const extensionVersion = context.extension.packageJSON.version;
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(`Puppetfile Dependency Manager v${extensionVersion} is now active!`);

	// Helper function to safely register commands
	const safeRegisterCommand = (command: string, callback: (...args: any[]) => any) => {
		try {
			return vscode.commands.registerCommand(command, callback);
		} catch (error: any) {
			if (error.message?.includes('already exists')) {
				console.warn(`Command ${command} already registered, skipping`);
				return { dispose: () => {} }; // Return dummy disposable
			}
			throw error;
		}
	};

	// Register commands defined in package.json
	const updateAllToSafe = safeRegisterCommand('puppetfile-depgraph.updateAllToSafe', async () => {
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

	const updateAllToLatest = safeRegisterCommand('puppetfile-depgraph.updateAllToLatest', async () => {
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

        const showDependencyTree = safeRegisterCommand('puppetfile-depgraph.showDependencyTree', async () => {
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

		// Show progress indicator with more detailed progress reporting
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Building dependency tree",
			cancellable: true
		}, async (progress, token) => {
			const phase2State: Phase2State = {
				active: false,
				animation: null,
				currentTotalProgress: 0,
				message: "Phase 2: Resolving transitive dependencies...",
				lastMessageUpdate: Date.now()
			};

			try {
				progress.report({ increment: 0, message: "Phase 1: Preparing direct modules..." });
				if (token.isCancellationRequested) { return; }

				// Phase 1: Cache direct modules (0-30%)
				const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
				await cacheDirectModules(forgeModules, token, progress);
				if (token.isCancellationRequested) { return; }

				// Phase 2: Transitive dependency resolution (30-70%) with animated progress
				phase2State.currentTotalProgress = 30;
				progress.report({ increment: 0, message: phase2State.message });
				phase2State.active = true;
				startPhase2Animation(phase2State, token, progress);

				const progressCallback = createTreeProgressCallback(phase2State, token, progress);
				const dependencyTree = await DependencyTreeService.buildDependencyTree(
					parseResult.modules, progressCallback, token
				);

				stopPhase2Animation(phase2State);
				if (token.isCancellationRequested) { return; }

				// Generate and display content
				const finalIncrement = 100 - phase2State.currentTotalProgress;
				progress.report({ increment: finalIncrement, message: "Generating view..." });

				const content = generateDependencyContent(viewOption.value, dependencyTree);
				progress.report({ message: "Complete!" });

				const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
				await vscode.window.showTextDocument(doc);

			} catch (error) {
				stopPhase2Animation(phase2State);
				vscode.window.showErrorMessage(`Failed to build dependency tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
                });
        });

        const clearForgeCache = safeRegisterCommand('puppetfile-depgraph.clearForgeCache', () => {
                PuppetForgeService.clearCache();
                vscode.window.showInformationMessage('Puppet Forge cache cleared successfully!');
        });

      	const clearCache = safeRegisterCommand('puppetfile-depgraph.clearCache', () => {
		PuppetForgeService.clearCache();
		GitMetadataService.clearCache();
		vscode.window.showInformationMessage('All caches cleared successfully! (Puppet Forge + Git metadata)');
	});

        const updateModuleVersion = safeRegisterCommand('puppetfile-depgraph.updateModuleVersion', async (...args: any[]) => {
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
                    console.error('Invalid arguments for version update command:', commandArgs);
                    vscode.window.showErrorMessage('Invalid arguments for version update command');
                    return;
                }
                
                try {
                    await PuppetfileUpdateService.updateModuleVersionAtLine(commandArgs.line, commandArgs.version);
                    showTemporaryMessage(`Updated module to version ${commandArgs.version}`, 5000);
                } catch (error) {
                    console.error('Error updating module version:', error);
                    vscode.window.showErrorMessage(`Failed to update module: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
        });

        const cacheAllModules = safeRegisterCommand('puppetfile-depgraph.cacheAllModules', async () => {
                const parseResult = PuppetfileParser.parseActiveEditor();
                if (parseResult.errors.length > 0) {
                        vscode.window.showErrorMessage(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
                        return;
                }

                const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
                if (forgeModules.length === 0) {
                        vscode.window.showInformationMessage('No Puppet Forge modules found in Puppetfile');
                        return;
                }

                // Use the shared caching service
                await CacheService.cacheAllModules(forgeModules, true);
        });

        const showUpgradePlanner = safeRegisterCommand('puppetfile-depgraph.showUpgradePlanner', async () => {
                const parseResult = PuppetfileParser.parseActiveEditor();
                if (parseResult.errors.length > 0) {
                        vscode.window.showErrorMessage(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
                        return;
                }

                const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
                if (forgeModules.length === 0) {
                        vscode.window.showInformationMessage('No Puppet Forge modules found in Puppetfile');
                        return;
                }

                // Show progress indicator
                const progressPromise = vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Analyzing upgrade opportunities",
                        cancellable: false
                }, async (progress) => {
                        try {
                                progress.report({ increment: 0, message: "Preparing analysis..." });
                                
                                // Get the current document content first
                                const activeEditor = vscode.window.activeTextEditor;
                                if (!activeEditor) {
                                        throw new Error('No active Puppetfile editor found');
                                }
                                const originalContent = activeEditor.document.getText();
                                
                                progress.report({ increment: 20, message: "Checking module cache..." });
                                
                                // This will trigger caching with progress if needed
                                const upgradePlan = await UpgradePlannerService.createUpgradePlan(parseResult.modules);
                                
                                progress.report({ increment: 100, message: "Opening upgrade planner..." });
                                
                                // Wait a brief moment to let the user see the "Opening upgrade planner..." message
                                await new Promise(resolve => setTimeout(resolve, 500));
                                
                                // Show the interactive upgrade planner after progress closes
                                setTimeout(async () => {
                                        await UpgradeDiffProvider.showInteractiveUpgradePlanner(originalContent, upgradePlan);
                                }, 100);
                                
                        } catch (error) {
                                vscode.window.showErrorMessage(`Failed to analyze upgrades: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                });
                
                await progressPromise;
        });

        const showAbout = safeRegisterCommand('puppetfile-depgraph.showAbout', async () => {
                const packageJSON = context.extension.packageJSON;
                const aboutContent = `# ${packageJSON.displayName}

**Version:** ${packageJSON.version}
**Description:** ${packageJSON.description}

## Features
- 🔍 Puppetfile parsing and syntax highlighting
- 📦 Puppet Forge integration with caching
- 🔄 Version update commands (safe/latest)
- 🌳 Dependency tree visualization
- 💡 Hover tooltips with version information
- ⚡ Batch module caching for performance
- 📊 Upgrade planner with diff view

## Commands
- Update all dependencies to safe versions
- Update all dependencies to latest versions
- Show dependency tree (tree/list view)
- Show upgrade planner with safe upgrade analysis
- Clear Puppet Forge cache
- Cache info for all modules

## Repository
${packageJSON.repository?.url ?? 'Not specified'}

---
Built with ❤️ for the Puppet community`;

                const doc = await vscode.workspace.openTextDocument({
                        content: aboutContent,
                        language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
        });

        const applyAllUpgrades = safeRegisterCommand('puppetfile-depgraph.applyAllUpgrades', async () => {
                await UpgradeDiffProvider.applyAllUpgrades();
        });

        const applySelectedUpgrades = safeRegisterCommand('puppetfile-depgraph.applySelectedUpgrades', async () => {
                await UpgradeDiffProvider.applySelectedUpgrades();
        });

        const applySingleUpgrade = safeRegisterCommand('puppetfile-depgraph.applySingleUpgrade', async (args) => {
                await PuppetfileCodeLensProvider.applySingleUpgrade(args);
        });

        const applySingleUpgradeFromDiff = safeRegisterCommand('puppetfile-depgraph.applySingleUpgradeFromDiff', async (...args) => {
                await UpgradeDiffProvider.applySingleUpgradeFromDiff(args);
        });

        const skipSingleUpgradeFromDiff = safeRegisterCommand('puppetfile-depgraph.skipSingleUpgradeFromDiff', async (...args) => {
                await UpgradeDiffProvider.skipSingleUpgradeFromDiff(args);
        });

        // Add all commands to subscriptions
        context.subscriptions.push(updateAllToSafe, updateAllToLatest, showDependencyTree, clearForgeCache, clearCache, updateModuleVersion, cacheAllModules, showUpgradePlanner, showAbout, applyAllUpgrades, applySelectedUpgrades, applySingleUpgrade, applySingleUpgradeFromDiff, skipSingleUpgradeFromDiff);

	// Register hover provider for Puppetfile (pattern-based to avoid duplicates)
	const hoverProvider = vscode.languages.registerHoverProvider(
		{ pattern: '**/Puppetfile' },
		new PuppetfileHoverProvider()
	);
	context.subscriptions.push(hoverProvider);

	// Register CodeLens provider for Puppetfile inline upgrade actions
	const codeLensProvider = new PuppetfileCodeLensProvider();
	PuppetfileCodeLensProvider.setInstance(codeLensProvider);
	const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
		{ pattern: '**/Puppetfile' },
		codeLensProvider
	);
	context.subscriptions.push(codeLensProviderDisposable);

	// Register CodeLens provider for diff views
	const diffCodeLensProvider = new UpgradeDiffCodeLensProvider();
	UpgradeDiffCodeLensProvider.setInstance(diffCodeLensProvider);
	const diffCodeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
		{ scheme: 'puppetfile-diff' },
		diffCodeLensProvider
	);
	context.subscriptions.push(diffCodeLensProviderDisposable);
}

/**
 * Shows a temporary information message that auto-closes after a specified duration
 */
export function showTemporaryMessage(message: string, duration: number = 5000): void {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: message,
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0 });
        
        // Auto-complete the progress after the specified duration
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                progress.report({ increment: 100 });
                resolve();
            }, duration);
        });
    });
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Reset activation flag
	extensionActivated = false;
	
	// Clean up HTTP agents to prevent hanging connections
	PuppetForgeService.cleanupAgents();

	// Dispose of the code lens provider
	const codeLensProvider = PuppetfileCodeLensProvider.getInstance();
	if (codeLensProvider) {
		codeLensProvider.dispose();
	}
}
