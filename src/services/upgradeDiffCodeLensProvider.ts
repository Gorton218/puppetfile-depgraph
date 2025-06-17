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
        // Only provide CodeLenses for our diff documents
        if (document.uri.scheme !== 'puppetfile-diff') {
            return [];
        }

        if (!UpgradeDiffCodeLensProvider.currentUpgradePlan) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const upgradePlan = UpgradeDiffCodeLensProvider.currentUpgradePlan;
        const upgradeableCandidates = upgradePlan.candidates.filter(c => c.isUpgradeable);

        // Find lines that contain upgrade comments
        const documentText = document.getText();
        const lines = documentText.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // Look for upgrade comment lines
            if (line.includes('# ↑ UPGRADE:')) {
                // Extract module name from the comment
                const match = line.match(/# ↑ UPGRADE: ([^\s]+)/);
                if (match) {
                    const moduleName = match[1];
                    
                    // Find the corresponding upgrade candidate
                    const candidate = upgradeableCandidates.find(c => c.module.name === moduleName);
                    if (candidate) {
                        // Create separate ranges for Apply and Skip to avoid interference
                        const applyRange = new vscode.Range(lineIndex, 0, lineIndex, Math.floor(line.length / 2));
                        const skipRange = new vscode.Range(lineIndex, Math.floor(line.length / 2), lineIndex, line.length);
                        
                        // Create Apply CodeLens
                        const applyCodeLens = new vscode.CodeLens(applyRange, {
                            title: `$(arrow-up) Apply`,
                            tooltip: `Apply upgrade: ${candidate.module.name} ${candidate.currentVersion} → ${candidate.maxSafeVersion}`,
                            command: 'puppetfile-depgraph.applySingleUpgradeFromDiff',
                            arguments: [{
                                moduleName: candidate.module.name,
                                currentVersion: candidate.currentVersion,
                                newVersion: candidate.maxSafeVersion
                            }]
                        });
                        
                        // Create Skip CodeLens
                        const skipCodeLens = new vscode.CodeLens(skipRange, {
                            title: `$(x) Skip`,
                            tooltip: `Skip upgrade for ${candidate.module.name}`,
                            command: 'puppetfile-depgraph.skipSingleUpgradeFromDiff',
                            arguments: [{
                                moduleName: candidate.module.name
                            }]
                        });
                        
                        codeLenses.push(applyCodeLens, skipCodeLens);
                    }
                }
            }
        }

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