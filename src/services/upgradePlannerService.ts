import { PuppetModule } from '../puppetfileParser';
import { PuppetForgeService, ForgeVersion } from '../puppetForgeService';
import { VersionCompatibilityService, VersionCompatibility } from '../versionCompatibilityService';
import { VersionParser } from '../utils/versionParser';
import { CacheService } from '../cacheService';

export interface UpgradeCandidate {
    module: PuppetModule;
    currentVersion: string;
    maxSafeVersion: string;
    availableVersions: string[];
    isUpgradeable: boolean;
    blockedBy?: string[];
    conflicts?: VersionCompatibility['conflicts'];
}

export interface UpgradePlan {
    candidates: UpgradeCandidate[];
    totalUpgradeable: number;
    totalModules: number;
    totalGitModules: number;
    hasConflicts: boolean;
    gitModules: PuppetModule[];
}

/**
 * Service for analyzing upgrade opportunities and creating upgrade plans
 */
export class UpgradePlannerService {
    
    /**
     * Analyze all modules in a Puppetfile and create an upgrade plan
     * @param modules Array of parsed Puppetfile modules
     * @returns Promise with the upgrade plan
     */
    public static async createUpgradePlan(modules: PuppetModule[]): Promise<UpgradePlan> {
        const forgeModules = modules.filter(m => m.source === 'forge');
        const gitModules = modules.filter(m => m.source === 'git');
        
        // Cache uncached modules first with progress indicator (only versioned ones need caching)
        const versionedForgeModules = forgeModules.filter(m => m.version);
        await CacheService.cacheUncachedModules(versionedForgeModules);
        
        const candidates: UpgradeCandidate[] = [];
        let hasConflicts = false;
        
        // Analyze each module for upgrade opportunities
        for (const module of forgeModules) {
            const candidate = await this.analyzeModuleUpgrade(module, modules);
            candidates.push(candidate);
            
            if (candidate.conflicts && candidate.conflicts.length > 0) {
                hasConflicts = true;
            }
        }
        
        const totalUpgradeable = candidates.filter(c => c.isUpgradeable).length;
        
        return {
            candidates,
            totalUpgradeable,
            totalModules: forgeModules.length,
            totalGitModules: gitModules.length,
            hasConflicts,
            gitModules
        };
    }
    
    /**
     * Analyze a single module for upgrade opportunities
     * @param module The module to analyze
     * @param allModules All modules in the Puppetfile for compatibility checking
     * @returns Promise with upgrade candidate information
     */
    private static async analyzeModuleUpgrade(
        module: PuppetModule, 
        allModules: PuppetModule[]
    ): Promise<UpgradeCandidate> {
        // Handle unversioned modules by treating them as having no current version
        const currentVersion = module.version || 'unversioned';
        
        try {
            // Get all available versions for this module
            const forgeModule = await PuppetForgeService.getModule(module.name);
            const availableVersions = forgeModule?.releases?.map(r => r.version) || [];
            
            if (availableVersions.length === 0) {
                return {
                    module,
                    currentVersion,
                    maxSafeVersion: currentVersion,
                    availableVersions: [],
                    isUpgradeable: false
                };
            }
            
            // Find the maximum safe version
            const maxSafeVersion = await this.findMaxSafeVersion(module, allModules, availableVersions);
            
            // For unversioned modules, any compatible version is an upgrade
            const isUpgradeable = !module.version ? true : this.isVersionNewer(maxSafeVersion, module.version);
            
            // If not upgradeable, check what's blocking it
            let blockedBy: string[] | undefined;
            let conflicts: VersionCompatibility['conflicts'] | undefined;
            
            if (!isUpgradeable) {
                const latestVersion = availableVersions[0]; // Assuming sorted desc
                if (module.version && this.isVersionNewer(latestVersion, module.version)) {
                    // There are newer versions, but they're not compatible
                    const compatibility = await VersionCompatibilityService.checkVersionCompatibility(
                        module, latestVersion, allModules
                    );
                    if (!compatibility.isCompatible) {
                        conflicts = compatibility.conflicts;
                        blockedBy = conflicts?.map(c => c.moduleName);
                    }
                }
            }
            
            return {
                module,
                currentVersion,
                maxSafeVersion,
                availableVersions,
                isUpgradeable,
                blockedBy,
                conflicts
            };
            
        } catch (error) {
            console.warn(`Failed to analyze upgrade for ${module.name}:`, error);
            return {
                module,
                currentVersion,
                maxSafeVersion: currentVersion,
                availableVersions: [],
                isUpgradeable: false
            };
        }
    }
    
    /**
     * Find the maximum safe version that can be upgraded to without breaking dependencies
     * @param module The module to find safe version for
     * @param allModules All modules in the Puppetfile
     * @param availableVersions Available versions for the module (sorted descending)
     * @returns Promise with the maximum safe version
     */
    private static async findMaxSafeVersion(
        module: PuppetModule,
        allModules: PuppetModule[],
        availableVersions: string[]
    ): Promise<string> {
        // Sort versions in descending order to check from newest to oldest
        const sortedVersions = this.sortVersionsDescending(availableVersions);
        
        // Test each version starting from the newest
        for (const version of sortedVersions) {
            // For unversioned modules, test all versions starting from newest
            // For versioned modules, skip if this version is older than or equal to current
            if (module.version && !this.isVersionNewer(version, module.version)) {
                continue;
            }
            
            // Check compatibility with all other modules
            const compatibility = await VersionCompatibilityService.checkVersionCompatibility(
                module, version, allModules
            );
            
            if (compatibility.isCompatible) {
                return version;
            }
        }
        
        // No safe upgrade found, return current version or 'unversioned' for unversioned modules
        return module.version || 'unversioned';
    }
    
    /**
     * Check if version A is newer than version B
     * @param versionA First version to compare
     * @param versionB Second version to compare
     * @returns True if versionA is newer than versionB
     */
    private static isVersionNewer(versionA: string, versionB: string): boolean {
        try {
            const partsA = versionA.split('.').map(Number);
            const partsB = versionB.split('.').map(Number);
            
            const maxLength = Math.max(partsA.length, partsB.length);
            
            for (let i = 0; i < maxLength; i++) {
                const partA = partsA[i] || 0;
                const partB = partsB[i] || 0;
                
                if (partA > partB) {
                    return true;
                }
                if (partA < partB) {
                    return false;
                }
            }
            
            return false; // Versions are equal
        } catch (error) {
            console.warn(`Failed to compare versions ${versionA} and ${versionB}:`, error);
            return false;
        }
    }
    
    /**
     * Sort version strings in descending order (newest first)
     * @param versions Array of version strings
     * @returns Sorted array with newest versions first
     */
    private static sortVersionsDescending(versions: string[]): string[] {
        return versions.sort((a, b) => {
            const partsA = a.split('.').map(Number);
            const partsB = b.split('.').map(Number);
            
            const maxLength = Math.max(partsA.length, partsB.length);
            
            for (let i = 0; i < maxLength; i++) {
                const partA = partsA[i] || 0;
                const partB = partsB[i] || 0;
                
                if (partA !== partB) {
                    return partB - partA; // Descending order
                }
            }
            
            return 0;
        });
    }
    
    /**
     * Generate a textual summary of the upgrade plan
     * @param plan The upgrade plan to summarize
     * @returns Formatted string summary
     */
    public static generateUpgradeSummary(plan: UpgradePlan): string {
        const lines: string[] = [];
        
        lines.push(`# Upgrade Plan Summary`);
        lines.push('');
        lines.push(`**Total Forge Modules:** ${plan.totalModules}`);
        lines.push(`**Upgradeable:** ${plan.totalUpgradeable}`);
        lines.push(`**Blocked:** ${plan.totalModules - plan.totalUpgradeable}`);
        lines.push(`**Git Modules:** ${plan.totalGitModules}`);
        lines.push(`**Has Conflicts:** ${plan.hasConflicts ? 'Yes' : 'No'}`);
        lines.push('');
        
        // Git modules section
        if (plan.totalGitModules > 0) {
            lines.push(`## 📎 Git Modules (${plan.totalGitModules})`);
            lines.push('');
            lines.push('The following modules are sourced from Git repositories and cannot be automatically upgraded:');
            lines.push('');
            for (const gitModule of plan.gitModules) {
                const ref = gitModule.gitRef || gitModule.gitTag;
                const refStr = ref ? ` @ ${ref}` : '';
                lines.push(`- **${gitModule.name}**${refStr} (${gitModule.gitUrl || 'git'})`);
            }
            lines.push('');
            lines.push('💡 **Note:** Git modules must be manually updated by modifying their ref/tag/branch in the Puppetfile.');
            lines.push('');
        }
        
        // Upgradeable modules
        const upgradeableCandidates = plan.candidates.filter(c => c.isUpgradeable);
        if (upgradeableCandidates.length > 0) {
            lines.push(`## ✅ Upgradeable Modules (${upgradeableCandidates.length})`);
            lines.push('');
            for (const candidate of upgradeableCandidates) {
                lines.push(`- **${candidate.module.name}**: ${candidate.currentVersion} → ${candidate.maxSafeVersion}`);
            }
            lines.push('');
        }
        
        // Blocked modules
        const blockedCandidates = plan.candidates.filter(c => !c.isUpgradeable && c.blockedBy);
        if (blockedCandidates.length > 0) {
            lines.push(`## ⚠️ Blocked Modules (${blockedCandidates.length})`);
            lines.push('');
            for (const candidate of blockedCandidates) {
                lines.push(`- **${candidate.module.name}**: ${candidate.currentVersion} (blocked by: ${candidate.blockedBy?.join(', ')})`);
                if (candidate.conflicts) {
                    for (const conflict of candidate.conflicts) {
                        lines.push(`  - ${conflict.moduleName} requires ${conflict.requirement}, but has ${conflict.currentVersion}`);
                    }
                }
            }
            lines.push('');
        }
        
        // Up-to-date modules
        const upToDateCandidates = plan.candidates.filter(c => !c.isUpgradeable && !c.blockedBy);
        if (upToDateCandidates.length > 0) {
            lines.push(`## ✨ Up-to-Date Modules (${upToDateCandidates.length})`);
            lines.push('');
            for (const candidate of upToDateCandidates) {
                lines.push(`- **${candidate.module.name}**: ${candidate.currentVersion}`);
            }
            lines.push('');
        }
        
        return lines.join('\n');
    }
    
    /**
     * Create a modified Puppetfile content with all safe upgrades applied
     * @param originalContent Original Puppetfile content
     * @param plan The upgrade plan
     * @returns Modified Puppetfile content
     */
    public static applyUpgradesToContent(originalContent: string, plan: UpgradePlan): string {
        let modifiedContent = originalContent;
        const lines = originalContent.split('\n');
        
        // Apply upgrades in reverse line order to preserve line numbers
        const upgradeableCandidates = plan.candidates
            .filter(c => c.isUpgradeable)
            .sort((a, b) => b.module.line - a.module.line);
        
        for (const candidate of upgradeableCandidates) {
            const lineIndex = candidate.module.line - 1; // Convert to 0-based index
            if (lineIndex >= 0 && lineIndex < lines.length) {
                const originalLine = lines[lineIndex];
                let updatedLine: string;
                
                if (candidate.currentVersion === 'unversioned') {
                    // For unversioned modules, add the version after the module name
                    updatedLine = originalLine.replace(
                        `mod '${candidate.module.name}'`,
                        `mod '${candidate.module.name}', '${candidate.maxSafeVersion}'`
                    ).replace(
                        `mod "${candidate.module.name}"`,
                        `mod "${candidate.module.name}", "${candidate.maxSafeVersion}"`
                    );
                } else {
                    // For versioned modules, replace the version
                    updatedLine = originalLine.replace(
                        candidate.currentVersion,
                        candidate.maxSafeVersion
                    );
                }
                lines[lineIndex] = updatedLine;
            }
        }
        
        return lines.join('\n');
    }
}