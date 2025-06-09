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
}

/**
 * Service for building and managing dependency trees
 */
export class DependencyTreeService {
    private static readonly MAX_DEPTH = 5; // Prevent infinite recursion
    private static visitedModules = new Set<string>();
    private static dependencyGraph: DependencyGraph = {};
    private static currentPath: string[] = [];

    /**
     * Build a dependency tree from parsed Puppetfile modules
     * @param modules Array of PuppetModule objects from parser
     * @returns Promise with the root dependency tree
     */
    public static async buildDependencyTree(modules: PuppetModule[]): Promise<DependencyNode[]> {
        this.visitedModules.clear();
        this.dependencyGraph = {};
        this.currentPath = [];
        const rootNodes: DependencyNode[] = [];

        // First pass: build the tree and collect requirements
        for (const module of modules) {
            // For direct dependencies, add them to the dependency graph with their version constraints
            if (module.version && module.source === 'forge') {
                this.addRequirement(module.name, {
                    constraint: `= ${module.version}`,
                    imposedBy: 'Puppetfile',
                    path: [module.name],
                    isDirectDependency: true
                });
            }
            
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
            this.addRequirement(module.name, {
                constraint: versionRequirement,
                imposedBy,
                path: [...this.currentPath],
                isDirectDependency
            });
        }

        const node: DependencyNode = {
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

        // Only fetch dependencies for Forge modules
        if (module.source === 'forge') {
            try {
                const forgeModule = await PuppetForgeService.getModule(module.name);
                if (forgeModule?.current_release?.metadata?.dependencies) {
                    for (const dep of forgeModule.current_release.metadata.dependencies) {
                        const childModule: PuppetModule = {
                            name: dep.name,
                            version: this.extractVersionFromRequirement(dep.version_requirement),
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
        const versionText = node.version ? ` (${node.version})` : '';
        const sourceText = node.source === 'git' ? ' [git]' : ' [forge]';
        
        // Add conflict indicator if present
        const conflictText = node.conflict ? ' ❌' : '';
        
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
                // Get available versions from Forge
                const forgeModule = await PuppetForgeService.getModule(moduleName);
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
            const info = this.dependencyGraph[node.name];
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
}
