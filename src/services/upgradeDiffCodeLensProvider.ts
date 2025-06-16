import * as vscode from 'vscode';
import { UpgradePlan } from './upgradePlannerService';

/**
 * CodeLens provider specifically for diff views to show upgrade actions
 */
export class UpgradeDiffCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    
    private static currentUpgradePlan: UpgradePlan | null = null;

    /**
     * Set the current upgrade plan for generating CodeLenses
     * @param upgradePlan The upgrade plan to use
     */
    public static setUpgradePlan(upgradePlan: UpgradePlan): void {
        this.currentUpgradePlan = upgradePlan;
    }

    /**
     * Refresh CodeLenses when upgrade plan changes
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLenses for the diff document
     * @param document The text document to analyze
     * @param token Cancellation token
     * @returns Promise with array of CodeLens objects
     */
    public async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        console.log('UpgradeDiffCodeLensProvider: provideCodeLenses called for URI:', document.uri.toString());
        
        // Only provide CodeLenses for our diff documents
        if (!document.uri.scheme.includes('puppetfile-diff')) {
            console.log('UpgradeDiffCodeLensProvider: Not a puppetfile-diff scheme, skipping');
            return [];
        }

        if (!UpgradeDiffCodeLensProvider.currentUpgradePlan) {
            console.log('UpgradeDiffCodeLensProvider: No current upgrade plan available');
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const upgradePlan = UpgradeDiffCodeLensProvider.currentUpgradePlan;
        const upgradeableCandidates = upgradePlan.candidates.filter(c => c.isUpgradeable);
        
        console.log('UpgradeDiffCodeLensProvider: Found', upgradeableCandidates.length, 'upgradeable candidates');

        // Find lines that contain upgrade comments
        const documentText = document.getText();
        const lines = documentText.split('\n');
        
        console.log('UpgradeDiffCodeLensProvider: Document has', lines.length, 'lines');
        console.log('UpgradeDiffCodeLensProvider: Looking for upgrade comments in document...');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // Look for upgrade comment lines
            if (line.includes('# ↑ UPGRADE:')) {
                console.log('UpgradeDiffCodeLensProvider: Found upgrade comment on line', lineIndex + 1, ':', line);
                // Extract module name from the comment
                const match = line.match(/# ↑ UPGRADE: ([^\s]+)/);
                if (match) {
                    const moduleName = match[1];
                    
                    // Find the corresponding upgrade candidate
                    const candidate = upgradeableCandidates.find(c => c.module.name === moduleName);
                    if (candidate) {
                        const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
                        
                        // Create Apply CodeLens
                        const applyCodeLens = new vscode.CodeLens(range, {
                            title: `$(arrow-up) Apply`,
                            tooltip: `Apply upgrade: ${candidate.module.name} ${candidate.currentVersion} → ${candidate.maxSafeVersion}`,
                            command: 'puppetfile-depgraph.applySingleUpgradeFromDiff',
                            arguments: [{
                                moduleName: candidate.module.name,
                                currentVersion: candidate.currentVersion,
                                newVersion: candidate.maxSafeVersion,
                                line: candidate.module.line
                            }]
                        });
                        
                        // Create Skip CodeLens
                        const skipCodeLens = new vscode.CodeLens(range, {
                            title: `$(x) Skip`,
                            tooltip: `Skip upgrade for ${candidate.module.name}`,
                            command: 'puppetfile-depgraph.skipSingleUpgradeFromDiff',
                            arguments: [{
                                moduleName: candidate.module.name
                            }]
                        });
                        
                        codeLenses.push(applyCodeLens, skipCodeLens);
                        console.log('UpgradeDiffCodeLensProvider: Added CodeLenses for', moduleName);
                    }
                }
            }
        }

        console.log('UpgradeDiffCodeLensProvider: Returning', codeLenses.length, 'CodeLenses');
        return codeLenses;
    }

    // Singleton pattern for global access
    private static instance: UpgradeDiffCodeLensProvider | undefined;

    public static getInstance(): UpgradeDiffCodeLensProvider | undefined {
        return this.instance;
    }

    public static setInstance(instance: UpgradeDiffCodeLensProvider): void {
        this.instance = instance;
    }
}