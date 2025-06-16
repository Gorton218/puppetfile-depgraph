// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetfileUpdateService } from './puppetfileUpdateService';
import { DependencyTreeService } from './dependencyTreeService';
import { PuppetfileHoverProvider } from './puppetfileHoverProvider';
import { PuppetForgeService } from './puppetForgeService';
import { GitMetadataService } from './gitMetadataService';
import { CacheService } from './cacheService';
import { UpgradePlannerService } from './services/upgradePlannerService';
import { UpgradeDiffProvider } from './services/upgradeDiffProvider';
import { PuppetfileCodeLensProvider } from './puppetfileCodeLensProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Get extension version from package.json
	const extensionVersion = context.extension.packageJSON.version;
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(`Puppetfile Dependency Manager v${extensionVersion} is now active!`);

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

		// Show progress indicator with more detailed progress reporting
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Building dependency tree",
			cancellable: true
		}, async (progress, token) => {
			// Animation variables for Phase 2 (scoped to entire progress function)
			let phase2AnimationActive = false;
			let phase2Animation: NodeJS.Timeout | null = null;
			
			try {
				// Three-phase progress system:
				// Phase 1 (0-30%): Direct module caching
				// Phase 2 (30-70%): Transitive dependency resolution  
				// Phase 3 (70-100%): Conflict analysis
				
				progress.report({ increment: 0, message: "Phase 1: Preparing direct modules..." });
				
				// Check for cancellation
				if (token.isCancellationRequested) {
					return;
				}
				
				// Phase 1: Cache direct modules (0-30%)
				const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
				const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
				
				if (uncachedModules.length > 0) {
					// Progressive caching with incremental updates from 0% to 30%
					let lastPhase1Progress = 0;
					await CacheService.cacheUncachedModulesWithProgressiveUpdates(
						forgeModules, 
						token,
						(completed: number, total: number) => {
							if (!token.isCancellationRequested) {
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
						}
					);
					// Ensure we reach exactly 30%
					const finalIncrement = 30 - lastPhase1Progress;
					if (finalIncrement > 0) {
						progress.report({ increment: finalIncrement, message: "Phase 1: Caching complete" });
					}
				} else {
					progress.report({ increment: 30, message: "Phase 1: All direct modules already cached" });
				}
				
				// Check for cancellation after caching
				if (token.isCancellationRequested) {
					return;
				}
				
				// Phase 2: Transitive dependency resolution (30-70%) with animated progress
				// Note: We're already at 30% from Phase 1, so Phase 2 animates the remaining 40%
				let currentTotalProgress = 30; // Track absolute progress
				let phase2BaseProgress = 30; // Start of Phase 2
				const phase2Range = 40; // 30% to 70% = 40% range
				let animationPosition = 0; // Position within the 40% range (0-1)
				let animationDirection = 1; // 1 for increasing, -1 for decreasing
				let lastMessageUpdate = Date.now();
				let currentPhase2Message = "Phase 2: Resolving transitive dependencies...";
				
				progress.report({ increment: 0, message: currentPhase2Message });
				
				// Start animated progress for Phase 2
				phase2AnimationActive = true;
				
				phase2Animation = setInterval(() => {
					if (!phase2AnimationActive || token.isCancellationRequested) {
						if (phase2Animation) {clearInterval(phase2Animation);}
						return;
					}
					
					// Only animate if we haven't had a recent message update
					const timeSinceLastMessage = Date.now() - lastMessageUpdate;
					if (timeSinceLastMessage > 500) { // 500ms pause after message updates
						// Update animation position (0 to 1)
						animationPosition += animationDirection * 0.05; // 5% of range per update
						
						if (animationPosition >= 1) {
							animationPosition = 1;
							animationDirection = -1;
						} else if (animationPosition <= 0) {
							animationPosition = 0;
							animationDirection = 1;
						}
						
						// Calculate target progress (30% + (0-40% based on animation position))
						const targetProgress = phase2BaseProgress + (animationPosition * phase2Range);
						const incrementNeeded = targetProgress - currentTotalProgress;
						
						if (Math.abs(incrementNeeded) > 0.5) { // Only update if change is significant
							progress.report({ increment: incrementNeeded, message: currentPhase2Message });
							currentTotalProgress = targetProgress;
						}
					}
				}, 200); // Update every 200ms for smooth animation
				
				const dependencyTree = await DependencyTreeService.buildDependencyTree(
					parseResult.modules,
					(message: string, phase?: 'tree' | 'conflicts', moduleCount?: number, totalModules?: number) => {
						if (!token.isCancellationRequested) {
							if (phase === 'conflicts' && moduleCount !== undefined && totalModules !== undefined) {
								// Stop Phase 2 animation and start Phase 3
								phase2AnimationActive = false;
								if (phase2Animation) {clearInterval(phase2Animation);}
								
								// Ensure we're at 70% before starting Phase 3
								const progressTo70 = 70 - currentTotalProgress;
								if (progressTo70 > 0) {
									progress.report({ increment: progressTo70, message: "Phase 3: Starting conflict analysis..." });
									currentTotalProgress = 70;
								}
								
								// Phase 3: Conflict analysis (70-100%) - incremental progress
								const targetPhase3Progress = 70 + Math.round((moduleCount / totalModules) * 30);
								const phase3Increment = targetPhase3Progress - currentTotalProgress;
								if (phase3Increment > 0) {
									progress.report({ 
										increment: phase3Increment, 
										message: `Phase 3: ${message}` 
									});
									currentTotalProgress = targetPhase3Progress;
								} else {
									// Just update message without changing progress
									progress.report({ increment: 0, message: `Phase 3: ${message}` });
								}
							} else {
								// Still in Phase 2: Update message and pause animation briefly
								currentPhase2Message = `Phase 2: ${message}`;
								lastMessageUpdate = Date.now();
								progress.report({ increment: 0, message: currentPhase2Message });
							}
						}
					},
					token
				);
				
				// Ensure animation is stopped when tree building completes
				phase2AnimationActive = false;
				if (phase2Animation) {clearInterval(phase2Animation);}
				
				// Check for cancellation after building tree
				if (token.isCancellationRequested) {
					// Ensure animation cleanup on cancellation
					phase2AnimationActive = false;
					if (phase2Animation) {clearInterval(phase2Animation);}
					return;
				}
				
				// Ensure we reach 100% for final steps
				const finalIncrement = 100 - currentTotalProgress;
				progress.report({ increment: finalIncrement, message: "Generating view..." });
				
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
				
				// Final cancellation check before showing results
				if (token.isCancellationRequested) {
					// Final animation cleanup
					phase2AnimationActive = false;
					if (phase2Animation) {clearInterval(phase2Animation);}
					return;
				}
				
				progress.report({ increment: 100, message: "Complete!" });
				
				// Show results in a new document
				const doc = await vscode.workspace.openTextDocument({
					content: content,
					language: 'markdown'
				});
				await vscode.window.showTextDocument(doc);
				
			} catch (error) {
				// Cleanup animation on error
				phase2AnimationActive = false;
				if (phase2Animation) {clearInterval(phase2Animation);}
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
		GitMetadataService.clearCache();
		vscode.window.showInformationMessage('All caches cleared successfully! (Puppet Forge + Git metadata)');
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

        const cacheAllModules = vscode.commands.registerCommand('puppetfile-depgraph.cacheAllModules', async () => {
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

        const showUpgradePlanner = vscode.commands.registerCommand('puppetfile-depgraph.showUpgradePlanner', async () => {
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
                let progressResolve: (() => void) | null = null;
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

        const showAbout = vscode.commands.registerCommand('puppetfile-depgraph.showAbout', async () => {
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
${packageJSON.repository?.url || 'Not specified'}

---
Built with ❤️ for the Puppet community`;

                const doc = await vscode.workspace.openTextDocument({
                        content: aboutContent,
                        language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
        });

        const applyAllUpgrades = vscode.commands.registerCommand('puppetfile-depgraph.applyAllUpgrades', async () => {
                await UpgradeDiffProvider.applyAllUpgrades();
        });

        const applySelectedUpgrades = vscode.commands.registerCommand('puppetfile-depgraph.applySelectedUpgrades', async () => {
                await UpgradeDiffProvider.applySelectedUpgrades();
        });

        const applySingleUpgrade = vscode.commands.registerCommand('puppetfile-depgraph.applySingleUpgrade', async (args) => {
                await PuppetfileCodeLensProvider.applySingleUpgrade(args);
        });

        // Add all commands to subscriptions
        context.subscriptions.push(updateAllToSafe, updateAllToLatest, showDependencyTree, clearForgeCache, clearCache, updateModuleVersion, cacheAllModules, showUpgradePlanner, showAbout, applyAllUpgrades, applySelectedUpgrades, applySingleUpgrade);

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
}

// This method is called when your extension is deactivated
export function deactivate() {
	// Clean up HTTP agents to prevent hanging connections
	PuppetForgeService.cleanupAgents();
}
