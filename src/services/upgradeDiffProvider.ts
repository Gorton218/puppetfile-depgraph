import * as vscode from 'vscode';
import { UpgradePlan, UpgradePlannerService } from './upgradePlannerService';

export interface DiffOptions {
    showUpgradeableLonly?: boolean;
    includeComments?: boolean;
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
            // Create the proposed content with upgrades
            const proposedContent = this.createProposedContent(originalContent, upgradePlan, options);
            
            // Create temporary documents for the diff view
            const originalUri = vscode.Uri.parse('puppetfile-diff://current/Puppetfile');
            const proposedUri = vscode.Uri.parse('puppetfile-diff://proposed/Puppetfile');
            
            // Register a content provider for our custom scheme
            const provider = new PuppetfileDiffContentProvider(originalContent, proposedContent);
            const disposable = vscode.workspace.registerTextDocumentContentProvider('puppetfile-diff', provider);
            
            // Open the diff editor
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                proposedUri,
                'Puppetfile Upgrade Plan: Current ↔ Proposed',
                { preview: true }
            );
            
            // Clean up after a delay (VS Code will have loaded the content by then)
            setTimeout(() => {
                disposable.dispose();
            }, 5000);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show upgrade diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        
        // Add upgrade summary as comments if requested
        if (options.includeComments) {
            proposedContent = this.addUpgradeComments(proposedContent, upgradePlan);
        }
        
        return proposedContent;
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
        
        // Show quick pick with options
        const options = [
            {
                label: `$(arrow-up) Show All Safe Upgrades (${upgradeableCount})`,
                description: 'Show diff with all modules that can be safely upgraded',
                action: 'all'
            },
            {
                label: `$(info) Show Upgrade Summary`,
                description: 'View detailed upgrade analysis in text format',
                action: 'summary'
            }
        ];
        
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
                await this.showUpgradeDiff(originalContent, upgradePlan, { includeComments: true });
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
        await vscode.window.showTextDocument(doc);
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
}

/**
 * Content provider for diff documents
 */
class PuppetfileDiffContentProvider implements vscode.TextDocumentContentProvider {
    private originalContent: string;
    private proposedContent: string;
    
    constructor(originalContent: string, proposedContent: string) {
        this.originalContent = originalContent;
        this.proposedContent = proposedContent;
    }
    
    provideTextDocumentContent(uri: vscode.Uri): string {
        if (uri.path.includes('current')) {
            return this.originalContent;
        } else if (uri.path.includes('proposed')) {
            return this.proposedContent;
        }
        return '';
    }
}