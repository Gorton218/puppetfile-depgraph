import * as vscode from 'vscode';
import { UpgradePlan, UpgradePlannerService } from './upgradePlannerService';
import { PuppetfileUpdateService, UpdateResult } from '../puppetfileUpdateService';
import { PuppetfileParser } from '../puppetfileParser';
import { PuppetfileCodeLensProvider } from '../puppetfileCodeLensProvider';
import { UpgradeDiffCodeLensProvider } from './upgradeDiffCodeLensProvider';

export interface DiffOptions {
    showUpgradeableLonly?: boolean;
    includeComments?: boolean;
    showInlineActions?: boolean;
}

/**
 * Provider for creating VS Code diff views for upgrade plans
 */
export class UpgradeDiffProvider {
    
    /**
     * Show a diff view comparing current Puppetfile with proposed upgrades
     * @param originalContent The original Puppetfile content
     * @param upgradePlan The upgrade plan with proposed changes
     * @param options Optional diff display options
     */
    public static async showUpgradeDiff(
        originalContent: string,
        upgradePlan: UpgradePlan,
        options: DiffOptions = {}
    ): Promise<void> {
        try {
            // Create the proposed content with upgrades and inline action comments
            const proposedContent = this.createProposedContent(originalContent, upgradePlan, { ...options, showInlineActions: true });
            
            // Create temporary documents for the diff view
            const originalUri = vscode.Uri.parse('puppetfile-diff://current/Puppetfile');
            const proposedUri = vscode.Uri.parse('puppetfile-diff://proposed/Puppetfile');
            
            // Register a content provider for our custom scheme
            const provider = new PuppetfileDiffContentProvider(originalContent, proposedContent);
            const disposable = vscode.workspace.registerTextDocumentContentProvider('puppetfile-diff', provider);
            
            // Store upgrade plan, options, and content provider for later use
            (global as any).__currentUpgradePlan = upgradePlan;
            (global as any).__currentUpgradeOptions = options;
            (global as any).__currentContentProvider = provider;
            
            // Open the diff editor
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                proposedUri,
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
            
            // Set up CodeLens provider for the diff view
            UpgradeDiffCodeLensProvider.setUpgradePlan(upgradePlan);
            
            // Refresh CodeLens after a short delay to ensure diff is loaded
            setTimeout(() => {
                const diffCodeLensProvider = UpgradeDiffCodeLensProvider.getInstance();
                if (diffCodeLensProvider) {
                    diffCodeLensProvider.refresh();
                }
            }, 1000);
            
            // Show action buttons for applying changes
            await this.showUpgradeActions(upgradePlan, options);
            
            // Clean up after a delay (VS Code will have loaded the content by then)
            setTimeout(() => {
                disposable.dispose();
                if ((global as any).__currentContentProvider) {
                    (global as any).__currentContentProvider.dispose();
                    (global as any).__currentContentProvider = null;
                }
            }, 10000); // Longer delay to account for decorations
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show upgrade diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Refresh CodeLenses to show inline upgrade buttons
        try {
            const codeLensProvider = PuppetfileCodeLensProvider.getInstance();
            if (codeLensProvider) {
                codeLensProvider.refresh();
            }
        } catch (error) {
            // CodeLens provider not available, continue without it
        }
    }
    
    /**
     * Create the proposed Puppetfile content with upgrades and annotations
     * @param originalContent Original Puppetfile content
     * @param upgradePlan The upgrade plan
     * @param options Display options
     * @returns Modified content with upgrades and comments
     */
    private static createProposedContent(
        originalContent: string,
        upgradePlan: UpgradePlan,
        options: DiffOptions
    ): string {
        let proposedContent = originalContent;
        
        if (options.showUpgradeableLonly) {
            // Only apply upgradeable changes
            const upgradeableOnly = {
                ...upgradePlan,
                candidates: upgradePlan.candidates.filter(c => c.isUpgradeable)
            };
            proposedContent = UpgradePlannerService.applyUpgradesToContent(originalContent, upgradeableOnly);
        } else {
            // Apply all safe upgrades
            proposedContent = UpgradePlannerService.applyUpgradesToContent(originalContent, upgradePlan);
        }
        
        // Add inline action comments for each upgrade if enabled
        if (options.showInlineActions !== false) { // Default to true
            proposedContent = this.addInlineActionComments(proposedContent, upgradePlan, options);
        }
        
        // Add upgrade summary as comments if requested
        if (options.includeComments) {
            proposedContent = this.addUpgradeComments(proposedContent, upgradePlan);
        }
        
        return proposedContent;
    }
    
    /**
     * Add inline action comments above upgrade lines with clickable apply/skip buttons
     * @param content The Puppetfile content with upgrades applied
     * @param upgradePlan The upgrade plan
     * @param options Display options
     * @returns Content with inline action comments
     */
    private static addInlineActionComments(
        content: string, 
        upgradePlan: UpgradePlan, 
        options: DiffOptions
    ): string {
        const lines = content.split('\n');
        const upgradeableCandidates = upgradePlan.candidates.filter(c => c.isUpgradeable);
        
        // Process candidates in reverse line order to preserve line numbers when inserting
        const sortedCandidates = upgradeableCandidates.sort((a, b) => b.module.line - a.module.line);
        
        for (const candidate of sortedCandidates) {
            const currentVersion = candidate.currentVersion === 'unversioned' ? 'unversioned' : candidate.currentVersion;
            const newVersion = candidate.maxSafeVersion;
            
            // Find the line that contains this module (search for the module name)
            let moduleLineIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Look for module declaration with the specific module name
                if (line.includes(`mod '${candidate.module.name}'`) || line.includes(`mod "${candidate.module.name}"`)) {
                    moduleLineIndex = i;
                    break;
                }
            }
            
            // If we found the module line, insert the upgrade comment above it
            if (moduleLineIndex >= 0) {
                // Create a clean action comment line
                const actionComment = `# ↑ UPGRADE: ${candidate.module.name} ${currentVersion} → ${newVersion}`;
                
                // Insert the action comment above the module line
                lines.splice(moduleLineIndex, 0, actionComment);
            }
        }
        
        return lines.join('\n');
    }
    
    /**
     * Add upgrade information as comments to the Puppetfile
     * @param content The Puppetfile content
     * @param upgradePlan The upgrade plan
     * @returns Content with added comments
     */
    private static addUpgradeComments(content: string, upgradePlan: UpgradePlan): string {
        const lines = content.split('\n');
        const header = [
            '# Upgrade Plan Summary',
            `# Total modules: ${upgradePlan.totalModules}`,
            `# Upgradeable: ${upgradePlan.totalUpgradeable}`,
            `# Blocked: ${upgradePlan.totalModules - upgradePlan.totalUpgradeable}`,
            `# Generated: ${new Date().toISOString()}`,
            ''
        ];
        
        return [...header, ...lines].join('\n');
    }
    
    
    /**
     * Show an interactive upgrade planner with options
     * @param originalContent Original Puppetfile content
     * @param upgradePlan The upgrade plan
     */
    public static async showInteractiveUpgradePlanner(
        originalContent: string,
        upgradePlan: UpgradePlan
    ): Promise<void> {
        const upgradeableCount = upgradePlan.totalUpgradeable;
        const blockedCount = upgradePlan.totalModules - upgradePlan.totalUpgradeable;
        const gitCount = upgradePlan.totalGitModules;
        
        // Show quick pick with options
        const options = [];
        
        if (upgradeableCount > 0) {
            options.push({
                label: `$(arrow-up) Show All Safe Upgrades (${upgradeableCount})`,
                description: 'Show diff with all modules that can be safely upgraded',
                action: 'all'
            });
        }
        
        options.push({
            label: `$(info) Show Upgrade Summary`,
            description: `View detailed analysis (${upgradePlan.totalModules} Forge${gitCount > 0 ? `, ${gitCount} Git` : ''})`,
            action: 'summary'
        });
        
        if (blockedCount > 0) {
            options.push({
                label: `$(warning) Show Blocked Modules (${blockedCount})`,
                description: 'View modules that cannot be upgraded and why',
                action: 'blocked'
            });
        }
        
        const selection = await vscode.window.showQuickPick(options, {
            title: 'Puppetfile Upgrade Planner',
            placeHolder: 'Choose an action'
        });
        
        if (!selection) {
            return;
        }
        
        switch (selection.action) {
            case 'all':
                await this.showUpgradeDiff(originalContent, upgradePlan, { includeComments: true, showInlineActions: true });
                break;
                
            case 'summary':
                await this.showUpgradeSummary(upgradePlan);
                break;
                
            case 'blocked':
                await this.showBlockedModules(upgradePlan);
                break;
        }
    }
    
    /**
     * Show upgrade summary in a new document
     * @param upgradePlan The upgrade plan
     */
    private static async showUpgradeSummary(upgradePlan: UpgradePlan): Promise<void> {
        const summary = UpgradePlannerService.generateUpgradeSummary(upgradePlan);
        
        const doc = await vscode.workspace.openTextDocument({
            content: summary,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: false });
    }
    
    /**
     * Show detailed information about blocked modules
     * @param upgradePlan The upgrade plan
     */
    private static async showBlockedModules(upgradePlan: UpgradePlan): Promise<void> {
        const blockedCandidates = upgradePlan.candidates.filter(c => !c.isUpgradeable && c.blockedBy);
        
        if (blockedCandidates.length === 0) {
            vscode.window.showInformationMessage('No modules are currently blocked from upgrading.');
            return;
        }
        
        const lines = [
            '# Blocked Modules Analysis',
            '',
            `Found ${blockedCandidates.length} modules that cannot be upgraded due to dependency conflicts:`,
            ''
        ];
        
        for (const candidate of blockedCandidates) {
            lines.push(`## ${candidate.module.name}`);
            lines.push(`**Current Version:** ${candidate.currentVersion}`);
            lines.push(`**Latest Available:** ${candidate.availableVersions[0] || 'unknown'}`);
            lines.push(`**Blocked By:** ${candidate.blockedBy?.join(', ')}`);
            lines.push('');
            
            if (candidate.conflicts) {
                lines.push('**Conflicts:**');
                for (const conflict of candidate.conflicts) {
                    lines.push(`- ${conflict.moduleName} (${conflict.currentVersion}) requires ${conflict.requirement}`);
                }
                lines.push('');
            }
            
            lines.push('**Possible Solutions:**');
            lines.push('- Update the blocking modules to versions that allow newer dependencies');
            lines.push('- Wait for newer versions of the blocking modules to be released');
            lines.push('- Consider alternative modules that don\'t have these constraints');
            lines.push('');
            lines.push('---');
            lines.push('');
        }
        
        const doc = await vscode.workspace.openTextDocument({
            content: lines.join('\n'),
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
    
    /**
     * Show action buttons for applying upgrades
     * @param upgradePlan The upgrade plan
     * @param options The diff options used
     */
    private static async showUpgradeActions(
        upgradePlan: UpgradePlan,
        options: DiffOptions
    ): Promise<void> {
        const upgradeableCount = upgradePlan.totalUpgradeable;
        if (upgradeableCount === 0) {
            return;
        }
        
        // Store the upgrade plan for the commands to use
        (global as any).__currentUpgradePlan = upgradePlan;
        (global as any).__currentUpgradeOptions = options;
        
        // Show notification with action buttons
        const message = `Found ${upgradeableCount} module${upgradeableCount > 1 ? 's' : ''} with safe upgrades available`;
        const result = await vscode.window.showInformationMessage(
            message,
            'Apply All',
            'Select Modules...',
            'Dismiss'
        );
        
        if (result === 'Apply All') {
            await vscode.commands.executeCommand('puppetfile-depgraph.applyAllUpgrades');
        } else if (result === 'Select Modules...') {
            await vscode.commands.executeCommand('puppetfile-depgraph.applySelectedUpgrades');
        }
    }
    
    /**
     * Apply all upgrades from the current upgrade plan
     */
    public static async applyAllUpgrades(): Promise<void> {
        const upgradePlan: UpgradePlan = (global as any).__currentUpgradePlan;
        if (!upgradePlan) {
            vscode.window.showErrorMessage('No upgrade plan available. Please run the upgrade planner first.');
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'puppetfile') {
            vscode.window.showErrorMessage('Please open a Puppetfile to apply upgrades.');
            return;
        }
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Applying upgrades',
            cancellable: false
        }, async (progress) => {
            try {
                // Get upgradeable candidates
                const upgradeableCandidates = upgradePlan.candidates.filter(c => c.isUpgradeable && c.maxSafeVersion);
                
                if (upgradeableCandidates.length === 0) {
                    vscode.window.showInformationMessage('No upgrades to apply.');
                    return;
                }
                
                progress.report({ increment: 0, message: `Preparing ${upgradeableCandidates.length} upgrades...` });
                
                // Convert to update results format
                const updates: UpdateResult[] = upgradeableCandidates.map(candidate => ({
                    moduleName: candidate.module.name,
                    currentVersion: candidate.currentVersion,
                    newVersion: candidate.maxSafeVersion!,
                    success: true,
                    line: candidate.module.line
                }));
                
                progress.report({ increment: 50, message: 'Applying changes to Puppetfile...' });
                
                // Apply the updates
                await PuppetfileUpdateService.applyUpdates(editor, updates);
                
                progress.report({ increment: 100, message: 'Complete!' });
                
                // Generate summary
                const summary = updates.map(u => 
                    `• ${u.moduleName}: ${u.currentVersion || 'unversioned'} → ${u.newVersion}`
                ).join('\n');
                
                vscode.window.showInformationMessage(
                    `Successfully applied ${updates.length} module upgrade${updates.length > 1 ? 's' : ''}:\n${summary}`,
                    { modal: true }
                );
                
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to apply upgrades: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        });
    }
    
    /**
     * Apply selected upgrades from the current upgrade plan
     */
    public static async applySelectedUpgrades(): Promise<void> {
        const upgradePlan: UpgradePlan = (global as any).__currentUpgradePlan;
        if (!upgradePlan) {
            vscode.window.showErrorMessage('No upgrade plan available. Please run the upgrade planner first.');
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'puppetfile') {
            vscode.window.showErrorMessage('Please open a Puppetfile to apply upgrades.');
            return;
        }
        
        try {
            // Get upgradeable candidates
            const upgradeableCandidates = upgradePlan.candidates.filter(c => c.isUpgradeable && c.maxSafeVersion);
            
            if (upgradeableCandidates.length === 0) {
                vscode.window.showInformationMessage('No upgrades available to apply.');
                return;
            }
            
            // Create quick pick items
            const items = upgradeableCandidates.map(candidate => ({
                label: `$(package) ${candidate.module.name}`,
                description: `${candidate.currentVersion || 'unversioned'} → ${candidate.maxSafeVersion}`,
                detail: candidate.availableVersions[0] !== candidate.maxSafeVersion 
                    ? `Latest: ${candidate.availableVersions[0]} (using safe version)`
                    : undefined,
                candidate: candidate,
                picked: true // Default to selected
            }));
            
            // Show multi-select quick pick
            const selected = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                title: 'Select Modules to Upgrade',
                placeHolder: 'Choose which modules to upgrade (Space to toggle, Enter to confirm)'
            });
            
            if (!selected || selected.length === 0) {
                return;
            }
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Applying selected upgrades',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: `Preparing ${selected.length} upgrades...` });
                
                // Convert to update results format
                const updates: UpdateResult[] = selected.map(item => ({
                    moduleName: item.candidate.module.name,
                    currentVersion: item.candidate.currentVersion,
                    newVersion: item.candidate.maxSafeVersion!,
                    success: true,
                    line: item.candidate.module.line
                }));
                
                progress.report({ increment: 50, message: 'Applying changes to Puppetfile...' });
                
                // Apply the updates
                await PuppetfileUpdateService.applyUpdates(editor, updates);
                
                progress.report({ increment: 100, message: 'Complete!' });
                
                // Generate summary
                const summary = updates.map(u => 
                    `• ${u.moduleName}: ${u.currentVersion || 'unversioned'} → ${u.newVersion}`
                ).join('\n');
                
                vscode.window.showInformationMessage(
                    `Successfully applied ${updates.length} module upgrade${updates.length > 1 ? 's' : ''}:\n${summary}`,
                    { modal: true }
                );
            });
            
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply upgrades: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
    
    /**
     * Apply a single upgrade from the diff view
     * @param args Command arguments containing upgrade information
     */
    public static async applySingleUpgradeFromDiff(args: any[]): Promise<void> {
        if (!args || args.length === 0) {
            vscode.window.showErrorMessage('Invalid arguments for upgrade command');
            return;
        }
        
        const upgradeInfo = args[0];
        const { moduleName, currentVersion, newVersion } = upgradeInfo;
        
        if (!moduleName || !newVersion) {
            vscode.window.showErrorMessage('Missing upgrade information');
            return;
        }
        
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Applying upgrade: ${moduleName}`,
                cancellable: false
            }, async (progress) => {
                progress.report({ 
                    increment: 0, 
                    message: `${currentVersion || 'unversioned'} → ${newVersion}` 
                });
                
                // Helper function to check if a document is a Puppetfile
                const isPuppetfile = (doc: vscode.TextDocument): boolean => {
                    return (
                        // Check language ID
                        (doc.languageId === 'puppetfile' || 
                         doc.languageId === 'ruby' || 
                         doc.languageId === 'plaintext') &&
                        // Check filename
                        (doc.uri.path.endsWith('/Puppetfile') || 
                         doc.uri.path.endsWith('\\Puppetfile') ||
                         doc.fileName === 'Puppetfile') &&
                        // Not a diff view
                        !doc.uri.scheme.includes('puppetfile-diff')
                    );
                };
                
                // Find the original Puppetfile editor (not the diff view)
                // First try visible editors
                let puppetfileEditor = vscode.window.visibleTextEditors.find(editor => 
                    isPuppetfile(editor.document)
                );
                
                // Find the Puppetfile document even if no editor is visible
                let puppetfileDocument: vscode.TextDocument | undefined;
                if (puppetfileEditor) {
                    puppetfileDocument = puppetfileEditor.document;
                } else {
                    puppetfileDocument = vscode.workspace.textDocuments.find(isPuppetfile);
                }
                
                if (!puppetfileDocument) {
                    // Debug information to help diagnose the issue
                    const availableEditors = vscode.window.visibleTextEditors.map(e => 
                        `${e.document.languageId} (${e.document.uri.scheme}): ${e.document.uri.toString()}`
                    );
                    const availableDocs = vscode.workspace.textDocuments.map(d => 
                        `${d.languageId} (${d.uri.scheme}): ${d.uri.toString()}`
                    );
                    
                    console.error('Debug info - Available editors:', availableEditors);
                    console.error('Debug info - Available documents:', availableDocs);
                    
                    throw new Error(`Could not find the original Puppetfile document. Available editors: ${availableEditors.join(', ')}. Available docs: ${availableDocs.join(', ')}`);
                }
                
                // Find the line containing this module in the original Puppetfile
                const content = puppetfileDocument.getText();
                const lines = content.split('\n');
                let targetLineNumber = -1;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.includes(`mod '${moduleName}'`) || line.includes(`mod "${moduleName}"`)) {
                        targetLineNumber = i + 1; // Convert to 1-based line number
                        break;
                    }
                }
                
                if (targetLineNumber === -1) {
                    throw new Error(`Could not find module ${moduleName} in the Puppetfile`);
                }
                
                progress.report({ increment: 50, message: 'Updating Puppetfile...' });
                
                // Apply the update to the original Puppetfile at the found line
                // Use workspace edit if no editor is available
                if (puppetfileEditor) {
                    await PuppetfileUpdateService.updateModuleVersionAtLine(targetLineNumber, newVersion);
                } else {
                    // Use workspace edit to modify the document
                    const lineIndex = targetLineNumber - 1;
                    const line = puppetfileDocument.lineAt(lineIndex);
                    const lineText = line.text;
                    
                    // Replace the version in the line
                    let updatedLine: string;
                    if (currentVersion === 'unversioned') {
                        // For unversioned modules, add the version
                        updatedLine = lineText.replace(
                            `mod '${moduleName}'`,
                            `mod '${moduleName}', '${newVersion}'`
                        ).replace(
                            `mod "${moduleName}"`,
                            `mod "${moduleName}", "${newVersion}"`
                        );
                    } else {
                        // For versioned modules, replace the version
                        updatedLine = lineText.replace(currentVersion, newVersion);
                    }
                    
                    // Apply the edit using workspace API
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(puppetfileDocument.uri, line.range, updatedLine);
                    await vscode.workspace.applyEdit(edit);
                    
                    // Save the document
                    await puppetfileDocument.save();
                }
                
                progress.report({ increment: 100, message: 'Complete!' });
            });
            
            // Show success message with auto-close after 5 seconds
            this.showTemporaryMessage(
                `✅ Applied upgrade: ${moduleName} → ${newVersion}`,
                5000
            );
            
            // Refresh the diff view
            await this.refreshDiffView();
            
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply upgrade for ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
    
    /**
     * Skip a single upgrade from the diff view
     * @param args Command arguments containing module information
     */
    public static async skipSingleUpgradeFromDiff(args: any[]): Promise<void> {
        if (!args || args.length === 0) {
            return;
        }
        
        const skipInfo = args[0];
        const { moduleName } = skipInfo;
        
        if (!moduleName) {
            return;
        }
        
        // Show info message about skipping
        vscode.window.showInformationMessage(
            `⏭️ Skipped upgrade for ${moduleName}`
        );
        
        // Could implement a way to track skipped upgrades if needed
        // For now, just provide user feedback
    }
    
    /**
     * Refresh the diff view to show updated state
     */
    private static async refreshDiffView(): Promise<void> {
        try {
            // Check if we have a stored upgrade plan to refresh
            const upgradePlan: UpgradePlan = (global as any).__currentUpgradePlan;
            const upgradeOptions: DiffOptions = (global as any).__currentUpgradeOptions;
            
            if (!upgradePlan) {
                return;
            }
            
            // Find the Puppetfile document (not the diff view)
            const puppetfileDoc = vscode.workspace.textDocuments.find(doc => 
                (doc.languageId === 'puppetfile' || 
                 doc.languageId === 'ruby' || 
                 doc.languageId === 'plaintext') &&
                (doc.uri.path.endsWith('/Puppetfile') || 
                 doc.uri.path.endsWith('\\Puppetfile') ||
                 doc.fileName === 'Puppetfile') &&
                !doc.uri.scheme.includes('puppetfile-diff')
            );
            
            if (!puppetfileDoc) {
                return;
            }
            
            // Re-parse the updated content
            const parseResult = PuppetfileParser.parseContent(puppetfileDoc.getText());
            if (parseResult.errors.length > 0) {
                return;
            }
            
            // Create a new upgrade plan with the updated content
            const updatedUpgradePlan = await UpgradePlannerService.createUpgradePlan(parseResult.modules);
            
            // Update the global upgrade plan
            (global as any).__currentUpgradePlan = updatedUpgradePlan;
            
            // Update the content provider with new content instead of opening a new diff
            const originalContent = puppetfileDoc.getText();
            const proposedContent = this.createProposedContent(originalContent, updatedUpgradePlan, { ...upgradeOptions, showInlineActions: true });
            
            // Update the global content provider reference if it exists
            if ((global as any).__currentContentProvider) {
                (global as any).__currentContentProvider.updateContent(originalContent, proposedContent);
            }
            
            // Refresh the CodeLens provider with the updated plan
            UpgradeDiffCodeLensProvider.setUpgradePlan(updatedUpgradePlan);
            const diffCodeLensProvider = UpgradeDiffCodeLensProvider.getInstance();
            if (diffCodeLensProvider) {
                diffCodeLensProvider.refresh();
            }
            
        } catch (error) {
            // Silently fail refresh - user can manually refresh if needed
            console.warn('Failed to refresh diff view:', error);
        }
    }

    /**
     * Shows a temporary information message that auto-closes after a specified duration
     */
    private static showTemporaryMessage(message: string, duration: number = 5000): void {
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
}

/**
 * Content provider for diff documents
 */
class PuppetfileDiffContentProvider implements vscode.TextDocumentContentProvider {
    private originalContent: string;
    private proposedContent: string;
    
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;
    
    constructor(originalContent: string, proposedContent: string) {
        this.originalContent = originalContent;
        this.proposedContent = proposedContent;
    }
    
    updateContent(originalContent: string, proposedContent: string): void {
        this.originalContent = originalContent;
        this.proposedContent = proposedContent;
        
        // Notify VS Code that the content has changed
        this._onDidChange.fire(vscode.Uri.parse('puppetfile-diff://current/Puppetfile'));
        this._onDidChange.fire(vscode.Uri.parse('puppetfile-diff://proposed/Puppetfile'));
    }
    
    provideTextDocumentContent(uri: vscode.Uri): string {
        // Check the authority part of the URI, not the path
        if (uri.authority === 'current') {
            return this.originalContent;
        } else if (uri.authority === 'proposed') {
            return this.proposedContent;
        }
        return '';
    }
    
    dispose(): void {
        this._onDidChange.dispose();
    }
}