import { PuppetModule } from './puppetfileParser';
import { PuppetForgeService, ForgeModule } from './puppetForgeService';
import { DependencyGraph, Requirement, DependencyConflict } from './types/dependencyTypes';
import { ConflictAnalyzer } from './services/conflictAnalyzer';
import { VersionParser } from './utils/versionParser';

/**
 * Represents a node in the dependency tree
 */
export interface DependencyNode {
    name: string;
    version?: string;
    source: 'forge' | 'git';
    children: DependencyNode[];
    depth: number;
    isDirectDependency: boolean;
    gitUrl?: string;
    gitRef?: string;
    gitTag?: string;
    versionRequirement?: string; // The original version requirement string
    conflict?: DependencyConflict; // Conflict information if any
    displayVersion?: string; // What to display (version for direct deps, constraint for transitive)
    isConstraintViolated?: boolean; // Whether the current Puppetfile version violates this constraint
}

/**
 * Service for building and managing dependency trees
 */
export class DependencyTreeService {
    private static readonly MAX_DEPTH = 5; // Prevent infinite recursion
    private static visitedModules = new Set<string>();
    private static dependencyGraph: DependencyGraph = {};
    private static currentPath: string[] = [];
    private static directDependencies = new Map<string, string>();


    /**
     * Build a dependency tree from parsed Puppetfile modules
     * @param modules Array of PuppetModule objects from parser
     * @returns Promise with the root dependency tree
     */
    public static async buildDependencyTree(modules: PuppetModule[]): Promise<DependencyNode[]> {
        this.visitedModules.clear();
        this.dependencyGraph = {};
        this.currentPath = [];
        this.directDependencies.clear();
        const rootNodes: DependencyNode[] = [];

        // Store direct dependencies for reference
        for (const module of modules) {
            if (module.version && module.source === 'forge') {
                const normalizedName = this.normalizeModuleName(module.name);
                this.directDependencies.set(normalizedName, module.version);
                this.addRequirement(normalizedName, {
                    constraint: `= ${module.version}`,
                    imposedBy: 'Puppetfile',
                    path: [module.name],
                    isDirectDependency: true
                });
            }
        }

        // First pass: build the tree and collect requirements
        for (const module of modules) {
            const node = await this.buildNodeTree(module, 0, true);
            if (node) {
                rootNodes.push(node);
            }
        }

        // Second pass: analyze conflicts
        await this.analyzeConflicts();

        // Third pass: annotate nodes with conflict information
        this.annotateNodesWithConflicts(rootNodes);

        return rootNodes;
    }

    /**
     * Build a dependency tree for a single module
     * @param module The module to build tree for
     * @param depth Current depth in the tree
     * @param isDirectDependency Whether this is a direct dependency
     * @returns Promise with the dependency node
     */
    private static async buildNodeTree(
        module: PuppetModule, 
        depth: number, 
        isDirectDependency: boolean,
        imposedBy?: string,
        versionRequirement?: string
    ): Promise<DependencyNode | null> {
        // Add current module to path
        this.currentPath.push(module.name);

        // Check for circular dependencies
        const circularConflict = ConflictAnalyzer.checkForCircularDependencies(
            module.name, 
            this.currentPath.slice(0, -1)
        );

        // Prevent infinite recursion and circular dependencies
        if (depth >= this.MAX_DEPTH || this.visitedModules.has(module.name)) {
            this.currentPath.pop();
            return {
                name: module.name,
                version: module.version,
                source: module.source,
                children: [],
                depth,
                isDirectDependency,
                gitUrl: module.gitUrl,
                gitRef: module.gitRef,
                gitTag: module.gitTag,
                versionRequirement,
                conflict: circularConflict || undefined
            };
        }

        this.visitedModules.add(module.name);

        // Collect requirement information
        if (imposedBy && versionRequirement) {
            const normalizedName = this.normalizeModuleName(module.name);
            this.addRequirement(normalizedName, {
                constraint: versionRequirement,
                imposedBy,
                path: [...this.currentPath],
                isDirectDependency
            });
        }

        // Determine how to display this dependency
        const resolvedVersion = this.getResolvedVersion(this.normalizeModuleName(module.name));
        const displayVersion = this.determineDisplayVersion(module, versionRequirement, resolvedVersion, isDirectDependency);
        const isConstraintViolated = this.checkConstraintViolation(resolvedVersion, versionRequirement);
        
        const node: DependencyNode = {
            name: module.name,
            version: module.version || resolvedVersion,
            source: module.source,
            children: [],
            depth,
            isDirectDependency,
            gitUrl: module.gitUrl,
            gitRef: module.gitRef,
            gitTag: module.gitTag,
            versionRequirement,
            conflict: circularConflict || undefined,
            displayVersion,
            isConstraintViolated
        };

        // Only fetch dependencies for Forge modules
        if (module.source === 'forge') {
            try {
                const forgeModule = await PuppetForgeService.getModule(module.name);
                if (forgeModule?.current_release?.metadata?.dependencies) {
                    for (const dep of forgeModule.current_release.metadata.dependencies) {
                        const normalizedDepName = this.normalizeModuleName(dep.name);
                        
                        // For transitive dependencies, we want to show the constraint, not resolve to Puppetfile version
                        const childModule: PuppetModule = {
                            name: normalizedDepName,
                            version: undefined, // Will be set in buildNodeTree based on context
                            source: 'forge',
                            line: -1 // Not from a file line
                        };

                        const childNode = await this.buildNodeTree(
                            childModule, 
                            depth + 1, 
                            false,
                            module.name,
                            dep.version_requirement
                        );
                        if (childNode) {
                            node.children.push(childNode);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Could not fetch dependencies for ${module.name}:`, error);
            }
        }

        this.visitedModules.delete(module.name);
        this.currentPath.pop();
        return node;
    }

    /**
     * Extract a specific version from a version requirement string
     * @param requirement Version requirement (e.g., ">= 1.0.0", "~> 2.1.0")
     * @returns Extracted version or undefined
     */
    private static extractVersionFromRequirement(requirement: string): string | undefined {
        // Simple extraction - in reality, this would need more sophisticated parsing
        const match = requirement.match(/[\d.]+/);
        return match ? match[0] : undefined;
    }

    /**
     * Generate a text representation of the dependency tree
     * @param nodes Array of root dependency nodes
     * @returns String representation of the tree
     */
    public static generateTreeText(nodes: DependencyNode[]): string {
        let result = '';
        
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const isLast = i === nodes.length - 1;
            result += this.generateNodeText(node, '', isLast);
        }

        return result;
    }

    /**
     * Generate text representation of a single node and its children
     * @param node The dependency node
     * @param prefix Prefix for tree formatting
     * @param isLast Whether this is the last node at this level
     * @returns String representation of the node
     */
    private static generateNodeText(node: DependencyNode, prefix: string, isLast: boolean): string {
        const connector = isLast ? '└── ' : '├── ';
        // Use displayVersion for better UX, showing constraints for transitive deps
        const versionText = node.displayVersion ? ` (${node.displayVersion})` : '';
        const sourceText = node.source === 'git' ? ' [git]' : ' [forge]';
        
        // Add conflict indicators
        let conflictText = '';
        if (node.conflict) {
            conflictText += ' ❌';
        } else if (node.isConstraintViolated) {
            conflictText += ' ⚠️';
        }
        
        let result = `${prefix}${connector}${node.name}${versionText}${sourceText}${conflictText}\n`;

        // Add conflict details if present
        if (node.conflict) {
            const detailPrefix = prefix + (isLast ? '    ' : '│   ');
            const lines = node.conflict.details.split('\n');
            for (const line of lines) {
                result += `${detailPrefix}${line}\n`;
            }
            // Add suggestions
            if (node.conflict.suggestedFixes.length > 0) {
                for (const fix of node.conflict.suggestedFixes) {
                    result += `${detailPrefix}  💡 ${fix.reason}\n`;
                }
            }
        } else if (node.isConstraintViolated && node.versionRequirement && node.version) {
            // Show constraint violation details
            const detailPrefix = prefix + (isLast ? '    ' : '│   ');
            result += `${detailPrefix}Constraint violation: requires ${node.versionRequirement}, but Puppetfile has ${node.version}\n`;
        }

        // Add children
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const isLastChild = i === node.children.length - 1;
            result += this.generateNodeText(child, childPrefix, isLastChild);
        }

        return result;
    }

    /**
     * Generate a simple list view of all dependencies
     * @param nodes Array of root dependency nodes
     * @returns String representation as a simple list
     */
    public static generateListText(nodes: DependencyNode[]): string {
        const allDependencies = this.flattenDependencies(nodes);
        const uniqueDependencies = new Map<string, DependencyNode>();

        // Deduplicate by name, keeping the first occurrence
        for (const dep of allDependencies) {
            if (!uniqueDependencies.has(dep.name)) {
                uniqueDependencies.set(dep.name, dep);
            }
        }

        const sortedDependencies = Array.from(uniqueDependencies.values())
            .sort((a, b) => a.name.localeCompare(b.name));

        let result = `Total Dependencies: ${sortedDependencies.length}\n\n`;

        // Separate direct and transitive dependencies
        const directDeps = sortedDependencies.filter(dep => dep.isDirectDependency);
        const transitiveDeps = sortedDependencies.filter(dep => !dep.isDirectDependency);

        if (directDeps.length > 0) {
            result += `Direct Dependencies (${directDeps.length}):\n`;
            for (const dep of directDeps) {
                const versionText = dep.version ? ` (${dep.version})` : '';
                const sourceText = dep.source === 'git' ? ' [git]' : ' [forge]';
                result += `  • ${dep.name}${versionText}${sourceText}\n`;
            }
            result += '\n';
        }

        if (transitiveDeps.length > 0) {
            result += `Transitive Dependencies (${transitiveDeps.length}):\n`;
            for (const dep of transitiveDeps) {
                const versionText = dep.version ? ` (${dep.version})` : '';
                result += `  • ${dep.name}${versionText} [forge]\n`;
            }
        }

        return result;
    }

    /**
     * Flatten the dependency tree into a single array
     * @param nodes Array of root dependency nodes
     * @returns Flattened array of all dependencies
     */
    private static flattenDependencies(nodes: DependencyNode[]): DependencyNode[] {
        const result: DependencyNode[] = [];
        
        const flatten = (node: DependencyNode) => {
            result.push(node);
            for (const child of node.children) {
                flatten(child);
            }
        };

        for (const node of nodes) {
            flatten(node);
        }

        return result;
    }

    /**
     * Normalize module names to ensure consistency between Puppetfile format and Forge API format
     * Converts both "puppetlabs/stdlib" and "puppetlabs-stdlib" to "puppetlabs-stdlib"
     */
    private static normalizeModuleName(moduleName: string): string {
        return moduleName.replace('/', '-');
    }

    /**
     * Get the resolved version for a module (from Puppetfile direct dependencies)
     */
    private static getResolvedVersion(moduleName: string): string | undefined {
        return this.directDependencies.get(moduleName);
    }


    /**
     * Add a requirement to the dependency graph
     */
    private static addRequirement(moduleName: string, requirement: Requirement): void {
        if (!this.dependencyGraph[moduleName]) {
            this.dependencyGraph[moduleName] = {
                requirements: []
            };
        }
        this.dependencyGraph[moduleName].requirements.push(requirement);
    }

    /**
     * Analyze conflicts in the dependency graph
     */
    private static async analyzeConflicts(): Promise<void> {
        for (const [moduleName, info] of Object.entries(this.dependencyGraph)) {
            if (info.requirements.length === 0) {continue;}

            try {
                // Get available versions from Forge - use original name format for API call
                // Convert back to slash format for API if it looks like an org/module pair
                const apiModuleName = moduleName.includes('-') && moduleName.split('-').length === 2 
                    ? moduleName.replace('-', '/') 
                    : moduleName;
                const forgeModule = await PuppetForgeService.getModule(apiModuleName);
                const availableVersions = forgeModule?.releases?.map(r => r.version) || [];

                // Analyze for conflicts
                const result = ConflictAnalyzer.analyzeModule(
                    moduleName,
                    info.requirements,
                    availableVersions
                );

                // Update dependency info
                info.conflict = result.conflict;
                info.satisfyingVersions = result.satisfyingVersions;
                info.mergedConstraint = result.mergedConstraint;
            } catch (error) {
                console.warn(`Could not analyze conflicts for ${moduleName}:`, error);
            }
        }
    }

    /**
     * Annotate nodes with conflict information
     */
    private static annotateNodesWithConflicts(nodes: DependencyNode[]): void {
        const annotate = (node: DependencyNode) => {
            const normalizedName = this.normalizeModuleName(node.name);
            const info = this.dependencyGraph[normalizedName];
            if (info?.conflict) {
                node.conflict = info.conflict;
            }

            for (const child of node.children) {
                annotate(child);
            }
        };

        for (const node of nodes) {
            annotate(node);
        }
    }

    /**
     * Find potential dependency conflicts
     * @param nodes Array of root dependency nodes
     * @returns Array of conflict descriptions
     */
    public static findConflicts(nodes: DependencyNode[]): string[] {
        const conflicts: string[] = [];

        // Use the dependency graph to report real conflicts
        // Note: This method should typically be called after buildDependencyTree()
        // If called independently, the dependency graph may be empty or stale
        for (const [moduleName, info] of Object.entries(this.dependencyGraph)) {
            if (info.conflict) {
                conflicts.push(info.conflict.details);
                
                // Add suggested fixes if available
                if (info.conflict.suggestedFixes.length > 0) {
                    for (const fix of info.conflict.suggestedFixes) {
                        conflicts.push(`  Suggestion: ${fix.reason}`);
                    }
                }
            }
        }

        return conflicts;
    }

    /**
     * Determine how to display the version for a dependency node
     */
    private static determineDisplayVersion(
        module: PuppetModule, 
        versionRequirement?: string, 
        resolvedVersion?: string,
        isDirectDependency: boolean = false
    ): string | undefined {
        // For direct dependencies, always show the actual version
        if (isDirectDependency && module.version) {
            return module.version;
        }
        
        // For Git dependencies, show ref/tag info
        if (module.source === 'git') {
            if (module.gitTag) { return `tag: ${module.gitTag}`; }
            if (module.gitRef) { return `ref: ${module.gitRef}`; }
            return 'git';
        }
        
        // For transitive dependencies, show constraint requirement
        if (versionRequirement && !isDirectDependency) {
            if (resolvedVersion) {
                // Show both constraint and resolved version with conflict indicator
                return `requires ${versionRequirement}, resolved: ${resolvedVersion}`;
            } else {
                return `requires ${versionRequirement}`;
            }
        }
        
        // Fall back to resolved version or extracted version
        return resolvedVersion || (versionRequirement ? this.extractVersionFromRequirement(versionRequirement) : undefined);
    }

    /**
     * Check if a resolved version violates a constraint requirement
     */
    private static checkConstraintViolation(resolvedVersion?: string, versionRequirement?: string): boolean {
        if (!resolvedVersion || !versionRequirement) {
            return false;
        }
        
        try {
            const requirements = VersionParser.parse(versionRequirement);
            return !VersionParser.satisfiesAll(resolvedVersion, requirements);
        } catch (error) {
            // If we can't parse, assume no violation
            return false;
        }
    }

    /**
     * Reset the dependency graph (useful for testing)
     */
    public static resetDependencyGraph(): void {
        this.dependencyGraph = {};
        this.directDependencies.clear();
    }
}
