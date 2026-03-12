import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetForgeService } from './services/puppetForgeService';
import { getVersionDisplay, formatVersionTransition } from './utils/versionUtils';
import { PuppetfileUpdateService } from './services/puppetfileUpdateService';
import { showTemporaryMessage } from './extension';

/**
 * CodeLens provider for showing inline upgrade actions in Puppetfile
 */
export class PuppetfileCodeLensProvider implements vscode.CodeLensProvider {
    private readonly _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private readonly documentChangeListener: vscode.Disposable;
    public isSaving = false;

    constructor() {
        this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'puppetfile') {
                this.refresh();
            }
        });
    }

    /**
     * Dispose the event listener
     */
    public dispose(): void {
        this.documentChangeListener.dispose();
    }

    /**
     * Refresh CodeLenses when upgrades are available
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLenses for the document
     * @param document The text document to analyze
     * @param token Cancellation token
     * @returns Promise with array of CodeLens objects
     */
    public async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        // Skip dirty check for untitled documents (used in tests)
        if (document.uri.scheme === 'file' && document.isDirty) {
            // For real files, don't show code lenses if document is dirty
            return [];
        }
        
        if (document.languageId !== 'puppetfile') {
            return [];
        }
        
        // Don't provide code lenses for diff documents
        if (document.uri.scheme === 'puppetfile-diff') {
            return [];
        }

        try {
            // Parse the Puppetfile
            const parseResult = PuppetfileParser.parseContent(document.getText());
            if (parseResult.errors.length > 0) {
                return [];
            }

            const codeLenses: vscode.CodeLens[] = [];
            const forgeModules = parseResult.modules.filter((m: PuppetModule) => m.source === 'forge');

            // Check each module for available upgrades
            for (const module of forgeModules) {
                if (token.isCancellationRequested) {
                    break;
                }
                await this.addModuleCodeLenses(document, module, codeLenses);
            }

            return codeLenses;

        } catch (error) {
            console.debug('CodeLens parsing failed:', error);
            return [];
        }
    }

    /**
     * Check a single module for updates and add CodeLenses if updates are available
     */
    private async addModuleCodeLenses(
        document: vscode.TextDocument,
        module: PuppetModule,
        codeLenses: vscode.CodeLens[]
    ): Promise<void> {
        try {
            const updateInfo = await PuppetForgeService.checkForUpdate(module.name, module.version, true);
            if (!updateInfo.hasUpdate || !updateInfo.latestVersion) {
                return;
            }

            const lineIndex = module.line - 1;
            const line = document.lineAt(lineIndex);
            const range = new vscode.Range(lineIndex, 0, lineIndex, line.text.length);

            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(arrow-up) Update to ${updateInfo.latestVersion}`,
                tooltip: `Update ${module.name} from ${getVersionDisplay(module.version)} to ${updateInfo.latestVersion} (safe upgrade)`,
                command: 'puppetfile-depgraph.applySingleUpgrade',
                arguments: [{ line: module.line, moduleName: module.name, currentVersion: module.version, newVersion: updateInfo.latestVersion }]
            }));

            // Also check for latest version if different from safe
            const latestUpdateInfo = await PuppetForgeService.checkForUpdate(module.name, module.version, false);
            if (latestUpdateInfo.hasUpdate && latestUpdateInfo.latestVersion && latestUpdateInfo.latestVersion !== updateInfo.latestVersion) {
                codeLenses.push(new vscode.CodeLens(range, {
                    title: `$(versions) Update to ${latestUpdateInfo.latestVersion} (latest)`,
                    tooltip: `Update ${module.name} to latest version ${latestUpdateInfo.latestVersion} (may include pre-releases)`,
                    command: 'puppetfile-depgraph.applySingleUpgrade',
                    arguments: [{ line: module.line, moduleName: module.name, currentVersion: module.version, newVersion: latestUpdateInfo.latestVersion }]
                }));
            }
        } catch (error) {
            console.debug(`Skipping CodeLens for module that failed update check:`, error);
        }
    }

    /**
     * Apply a single module upgrade
     * @param args Command arguments containing line and version information
     */
    public static async applySingleUpgrade(args: {
        line: number;
        moduleName: string;
        currentVersion: string;
        newVersion: string;
    }): Promise<void> {
        const { line, moduleName, currentVersion, newVersion } = args;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Updating ${moduleName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ 
                    increment: 0, 
                    message: formatVersionTransition(currentVersion, newVersion) 
                });

                // Apply the update
                await PuppetfileUpdateService.updateModuleVersionAtLine(line, newVersion);

                progress.report({ increment: 100, message: 'Complete!' });
            });

            // Show success message with auto-close after 5 seconds
            showTemporaryMessage(
                `Successfully updated ${moduleName} to version ${newVersion}`,
                5000
            );

            // Refresh CodeLenses to remove the applied upgrade
            const codeLensProvider = PuppetfileCodeLensProvider.getInstance();
            if (codeLensProvider) {
                codeLensProvider.refresh();
            }

        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to update ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    // Singleton pattern for refresh functionality
    private static instance: PuppetfileCodeLensProvider | undefined;

    public static getInstance(): PuppetfileCodeLensProvider | undefined {
        return this.instance;
    }

    public static setInstance(instance: PuppetfileCodeLensProvider): void {
        this.instance = instance;
    }

}
