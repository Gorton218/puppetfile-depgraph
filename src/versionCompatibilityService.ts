import { PuppetForgeService, ForgeVersion } from './puppetForgeService';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { VersionParser } from './utils/versionParser';

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
        
        // Get the target module's dependencies for the specific version
        const targetRelease = await PuppetForgeService.getReleaseForVersion(targetModule.name, targetVersion);
        const targetDependencies = targetRelease?.metadata?.dependencies || [];
        
        // Check each dependency of the target version
        for (const dep of targetDependencies) {
            // Find if this dependency is in the Puppetfile
            const dependentModule = allModules.find(m => 
                m.source === 'forge' && this.normalizeModuleName(m.name) === this.normalizeModuleName(dep.name)
            );
            
            if (dependentModule && dependentModule.version) {
                // Parse the version requirement
                const requirements = VersionParser.parse(dep.version_requirement);
                
                // Check if the current version of the dependent module satisfies the requirement
                if (!VersionParser.satisfiesAll(dependentModule.version, requirements)) {
                    conflicts.push({
                        moduleName: dependentModule.name,
                        currentVersion: dependentModule.version,
                        requirement: dep.version_requirement
                    });
                }
            }
        }
        
        // Also check if any other module depends on the target module
        for (const module of allModules) {
            if (module.source !== 'forge' || module.name === targetModule.name) {
                continue;
            }
            
            // Get the module's dependencies
            let dependencies: Array<{name: string; version_requirement: string}> | undefined;
            
            if (module.version) {
                const release = await PuppetForgeService.getReleaseForVersion(module.name, module.version);
                dependencies = release?.metadata?.dependencies;
            } else {
                // If no version specified, get latest
                const releases = await PuppetForgeService.getModuleReleases(module.name);
                if (releases.length > 0) {
                    dependencies = releases[0].metadata?.dependencies;
                }
            }
            
            if (!dependencies) {
                continue;
            }
            
            // Check if this module depends on the target module
            const targetDep = dependencies.find(d => 
                this.normalizeModuleName(d.name) === this.normalizeModuleName(targetModule.name)
            );
            
            if (targetDep) {
                // Parse the version requirement
                const requirements = VersionParser.parse(targetDep.version_requirement);
                
                // Check if the target version satisfies this requirement
                if (!VersionParser.satisfiesAll(targetVersion, requirements)) {
                    conflicts.push({
                        moduleName: module.name,
                        currentVersion: module.version || 'latest',
                        requirement: targetDep.version_requirement
                    });
                }
            }
        }
        
        return {
            version: targetVersion,
            isCompatible: conflicts.length === 0,
            conflicts: conflicts.length > 0 ? conflicts : undefined
        };
    }
    
    /**
     * Normalize module names to handle different formats
     * @param name Module name to normalize
     * @returns Normalized module name
     */
    private static normalizeModuleName(name: string): string {
        // Convert puppetlabs-stdlib to puppetlabs/stdlib format
        if (name.includes('-') && !name.includes('/')) {
            const dashIndex = name.indexOf('-');
            return name.substring(0, dashIndex) + '/' + name.substring(dashIndex + 1);
        }
        return name;
    }
}