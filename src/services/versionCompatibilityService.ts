import { PuppetForgeService } from './puppetForgeService';
import { PuppetModule } from '../puppetfileParser';
import { VersionParser } from '../utils/versionParser';
import { GitMetadataService } from './gitMetadataService';
import { ModuleNameUtils } from '../utils/moduleNameUtils';

export interface VersionCompatibility {
    version: string;
    isCompatible: boolean;
    conflicts?: Array<{
        moduleName: string;
        currentVersion: string;
        requirement: string;
    }>;
}

export class VersionCompatibilityService {
    
    /**
     * Check if a specific version of a module would be compatible with all other modules
     * @param targetModule The module being checked
     * @param targetVersion The version to check compatibility for
     * @param allModules All modules in the Puppetfile
     * @returns Compatibility information
     */
    public static async checkVersionCompatibility(
        targetModule: PuppetModule,
        targetVersion: string,
        allModules: PuppetModule[]
    ): Promise<VersionCompatibility> {
        const conflicts: VersionCompatibility['conflicts'] = [];

        // Check forward dependencies (target module's deps against Puppetfile versions)
        const targetRelease = await PuppetForgeService.getReleaseForVersion(targetModule.name, targetVersion);
        const targetDependencies = targetRelease?.metadata?.dependencies || [];
        this.checkForwardDependencies(targetDependencies, allModules, conflicts);

        // Check reverse dependencies (other modules depending on the target)
        await this.checkReverseDependencies(targetModule, targetVersion, allModules, conflicts);

        return {
            version: targetVersion,
            isCompatible: conflicts.length === 0,
            conflicts: conflicts.length > 0 ? conflicts : undefined
        };
    }

    /**
     * Check if the target module's dependencies conflict with Puppetfile versions
     */
    private static checkForwardDependencies(
        targetDependencies: Array<{name: string; version_requirement: string}>,
        allModules: PuppetModule[],
        conflicts: NonNullable<VersionCompatibility['conflicts']>
    ): void {
        for (const dep of targetDependencies) {
            const dependentModule = allModules.find(m =>
                m.source === 'forge' && ModuleNameUtils.toSlashFormat(m.name) === ModuleNameUtils.toSlashFormat(dep.name)
            );

            if (!dependentModule?.version) {
                continue;
            }

            const requirements = VersionParser.parse(dep.version_requirement);
            if (!VersionParser.satisfiesAll(dependentModule.version, requirements)) {
                conflicts.push({
                    moduleName: dependentModule.name,
                    currentVersion: dependentModule.version,
                    requirement: dep.version_requirement
                });
            }
        }
    }

    /**
     * Check if other modules' dependency constraints conflict with the target version
     */
    private static async checkReverseDependencies(
        targetModule: PuppetModule,
        targetVersion: string,
        allModules: PuppetModule[],
        conflicts: NonNullable<VersionCompatibility['conflicts']>
    ): Promise<void> {
        for (const module of allModules) {
            if (module.name === targetModule.name) {
                continue;
            }

            const dependencies = await this.getModuleDependencies(module);
            if (!dependencies) {
                continue;
            }

            const targetDep = dependencies.find(d =>
                ModuleNameUtils.toSlashFormat(d.name) === ModuleNameUtils.toSlashFormat(targetModule.name)
            );

            if (!targetDep) {
                continue;
            }

            const requirements = VersionParser.parse(targetDep.version_requirement);
            if (!VersionParser.satisfiesAll(targetVersion, requirements)) {
                conflicts.push({
                    moduleName: module.name,
                    currentVersion: module.source === 'git' ? (module.gitTag || module.gitRef || 'git') : (module.version || 'latest'),
                    requirement: targetDep.version_requirement
                });
            }
        }
    }

    /**
     * Get dependencies for a module from Forge or Git
     */
    private static async getModuleDependencies(
        module: PuppetModule
    ): Promise<Array<{name: string; version_requirement: string}> | undefined> {
        if (module.source === 'forge') {
            if (module.version) {
                const release = await PuppetForgeService.getReleaseForVersion(module.name, module.version);
                return release?.metadata?.dependencies;
            }
            const releases = await PuppetForgeService.getModuleReleases(module.name);
            return releases.length > 0 ? releases[0].metadata?.dependencies : undefined;
        }

        if (module.source === 'git' && module.gitUrl) {
            const ref = module.gitTag ?? module.gitRef;
            const gitMetadata = await GitMetadataService.getModuleMetadataWithFallback(module.gitUrl, ref);
            return gitMetadata?.dependencies;
        }

        return undefined;
    }
    
    /**
     * Normalize module names to handle different formats
     */
    private static normalizeModuleName(name: string): string {
        return ModuleNameUtils.toSlashFormat(name);
    }
}