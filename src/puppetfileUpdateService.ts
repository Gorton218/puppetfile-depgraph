import * as vscode from 'vscode';
import { PuppetModule, PuppetfileParser } from './puppetfileParser';
import { PuppetForgeService } from './puppetForgeService';

/**
 * Represents an update operation result
 */
export interface UpdateResult {
    moduleName: string;
    currentVersion?: string;
    newVersion?: string;
    success: boolean;
    error?: string;
    line: number;
}

/**
 * Service for updating modules in Puppetfile
 */
export class PuppetfileUpdateService {

    /**
     * Update all modules to their latest safe versions
     * @returns Promise with array of update results
     */
    public static async updateAllToSafeVersions(): Promise<UpdateResult[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const parseResult = PuppetfileParser.parseActiveEditor();
        if (parseResult.errors.length > 0) {
            throw new Error(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
        }

        const results: UpdateResult[] = [];
        const forgeModules = parseResult.modules.filter(m => m.source === 'forge');

        // Check for updates in parallel
        const updatePromises = forgeModules.map(async (module) => {
            return await this.checkAndPrepareUpdate(module, true);
        });

        const updateResults = await Promise.all(updatePromises);
        
        // Apply updates to the document
        await this.applyUpdates(editor, updateResults.filter(r => r.newVersion));

        return updateResults;
    }

    /**
     * Update all modules to their latest versions (including pre-releases)
     * @returns Promise with array of update results
     */
    public static async updateAllToLatestVersions(): Promise<UpdateResult[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const parseResult = PuppetfileParser.parseActiveEditor();
        if (parseResult.errors.length > 0) {
            throw new Error(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
        }

        const results: UpdateResult[] = [];
        const forgeModules = parseResult.modules.filter(m => m.source === 'forge');

        // Check for updates in parallel
        const updatePromises = forgeModules.map(async (module) => {
            return await this.checkAndPrepareUpdate(module, false);
        });

        const updateResults = await Promise.all(updatePromises);
        
        // Apply updates to the document
        await this.applyUpdates(editor, updateResults.filter(r => r.newVersion));

        return updateResults;
    }

    /**
     * Check if a module has an update available and prepare the update result
     * @param module The module to check
     * @param safeOnly Whether to only consider safe versions
     * @returns Promise with update result
     */
    private static async checkAndPrepareUpdate(module: PuppetModule, safeOnly: boolean): Promise<UpdateResult> {
        try {
            const updateInfo = await PuppetForgeService.checkForUpdate(
                module.name, 
                module.version, 
                safeOnly
            );

            if (!updateInfo.latestVersion) {
                return {
                    moduleName: module.name,
                    currentVersion: module.version,
                    newVersion: undefined,
                    success: false,
                    error: 'Could not fetch latest version from Forge',
                    line: module.line
                };
            }

            if (!updateInfo.hasUpdate) {
                return {
                    moduleName: module.name,
                    currentVersion: module.version,
                    newVersion: module.version, // No change needed
                    success: true,
                    line: module.line
                };
            }

            return {
                moduleName: module.name,
                currentVersion: module.version,
                newVersion: updateInfo.latestVersion,
                success: true,
                line: module.line
            };

        } catch (error) {
            return {
                moduleName: module.name,
                currentVersion: module.version,
                newVersion: undefined,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                line: module.line
            };
        }
    }

    /**
     * Apply updates to the document
     * @param editor The active text editor
     * @param updates Array of update results to apply
     */
    private static async applyUpdates(editor: vscode.TextEditor, updates: UpdateResult[]): Promise<void> {
        if (updates.length === 0) {
            return;
        }

        const document = editor.document;

        // Sort updates by line number in descending order to avoid line number shifts
        const sortedUpdates = updates
            .filter(update => update.newVersion && update.currentVersion !== update.newVersion)
            .sort((a, b) => b.line - a.line);

        if (sortedUpdates.length === 0) {
            return;
        }

        // Create workspace edit
        const workspaceEdit = new vscode.WorkspaceEdit();

        for (const update of sortedUpdates) {
            const lineIndex = update.line - 1; // Convert to 0-based index
            if (lineIndex >= 0 && lineIndex < document.lineCount) {
                // Use VS Code's document API to get the line text and range
                const lineTextRange = document.lineAt(lineIndex);
                const originalLine = lineTextRange.text;
                const updatedLine = this.updateVersionInLine(originalLine, update.newVersion!);
                
                if (updatedLine !== originalLine) {
                    workspaceEdit.replace(document.uri, lineTextRange.range, updatedLine);
                }
            }
        }

        // Apply all changes at once
        await vscode.workspace.applyEdit(workspaceEdit);
    }

    /**
     * Update the version in a single line
     * @param line The original line
     * @param newVersion The new version to set
     * @returns Updated line
     */
    private static updateVersionInLine(line: string, newVersion: string): string {
        // Pattern to match version in various module declaration formats
        const patterns = [
            // mod 'module_name', 'version'
            /(mod\s*['"][^'"]+['"],\s*)['"][^'"]*['"](\s*$)/,
            // mod 'module_name', :git => 'url', :tag => 'version'
            /(mod\s*['"][^'"]+['"],\s*:git\s*=>\s*['"][^'"]+['"],\s*:tag\s*=>\s*)['"][^'"]*['"](\s*$)/,
            // mod 'module_name', :git => 'url', :ref => 'version'
            /(mod\s*['"][^'"]+['"],\s*:git\s*=>\s*['"][^'"]+['"],\s*:ref\s*=>\s*)['"][^'"]*['"](\s*$)/
        ];

        for (const pattern of patterns) {
            if (pattern.test(line)) {
                return line.replace(pattern, `$1'${newVersion}'$2`);
            }
        }

        // If no version found, add one for forge modules
        const forgeModulePattern = /^(\s*mod\s*['"][^'"]+['"])\s*$/;
        if (forgeModulePattern.test(line)) {
            return line.replace(forgeModulePattern, `$1, '${newVersion}'`);
        }

        return line;
    }

    /**
     * Update a single module line to a specific version
     * @param lineNumber 1-based line number in the active editor
     * @param newVersion The version to set
     */
    public static async updateModuleVersionAtLine(lineNumber: number, newVersion: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const lineIndex = lineNumber - 1;
        if (lineIndex < 0 || lineIndex >= document.lineCount) {
            return;
        }

        // Use VS Code's document API to get the line text
        const lineTextRange = document.lineAt(lineIndex);
        const originalLine = lineTextRange.text;
        const updatedLine = this.updateVersionInLine(originalLine, newVersion);
        
        if (updatedLine === originalLine) {
            return;
        }

        // Use the line's range, which correctly handles the line boundaries
        await editor.edit(edit => {
            edit.replace(lineTextRange.range, updatedLine);
        });
    }

    /**
     * Generate a summary of update results
     * @param results Array of update results
     * @returns Summary string
     */
    public static generateUpdateSummary(results: UpdateResult[]): string {
        const successful = results.filter(r => r.success && r.newVersion && r.currentVersion !== r.newVersion);
        const failed = results.filter(r => !r.success);
        const upToDate = results.filter(r => r.success && r.currentVersion === r.newVersion);

        let summary = `Update Summary:\n\n`;

        if (successful.length > 0) {
            summary += `✅ Updated (${successful.length}):\n`;
            for (const result of successful) {
                const versionChange = result.currentVersion 
                    ? `${result.currentVersion} → ${result.newVersion}`
                    : `Added version ${result.newVersion}`;
                summary += `  • ${result.moduleName}: ${versionChange}\n`;
            }
            summary += '\n';
        }

        if (upToDate.length > 0) {
            summary += `✨ Already up-to-date (${upToDate.length}):\n`;
            for (const result of upToDate) {
                summary += `  • ${result.moduleName}: ${result.currentVersion ?? 'latest'}\n`;
            }
            summary += '\n';
        }

        if (failed.length > 0) {
            summary += `❌ Failed (${failed.length}):\n`;
            for (const result of failed) {
                summary += `  • ${result.moduleName}: ${result.error}\n`;
            }
            summary += '\n';
        }

        return summary;
    }

    /**
     * Check for available updates without applying them
     * @param safeOnly Whether to only check for safe versions
     * @returns Promise with array of modules that have updates available
     */
    public static async checkForAvailableUpdates(safeOnly: boolean = true): Promise<UpdateResult[]> {
        const parseResult = PuppetfileParser.parseActiveEditor();
        if (parseResult.errors.length > 0) {
            throw new Error(`Puppetfile parsing errors: ${parseResult.errors.join(', ')}`);
        }

        const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
        
        const updatePromises = forgeModules.map(async (module) => {
            return await this.checkAndPrepareUpdate(module, safeOnly);
        });

        return await Promise.all(updatePromises);
    }
}
