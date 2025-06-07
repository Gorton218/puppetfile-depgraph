import { PuppetModule } from './puppetfileParser';
import { PuppetForgeService, ForgeModule } from './puppetForgeService';

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
}

/**
 * Service for building and managing dependency trees
 */
export class DependencyTreeService {
    private static readonly MAX_DEPTH = 5; // Prevent infinite recursion
    private static visitedModules = new Set<string>();

    /**
     * Build a dependency tree from parsed Puppetfile modules
     * @param modules Array of PuppetModule objects from parser
     * @returns Promise with the root dependency tree
     */
    public static async buildDependencyTree(modules: PuppetModule[]): Promise<DependencyNode[]> {
        this.visitedModules.clear();
        const rootNodes: DependencyNode[] = [];

        for (const module of modules) {
            const node = await this.buildNodeTree(module, 0, true);
            if (node) {
                rootNodes.push(node);
            }
        }

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
        isDirectDependency: boolean
    ): Promise<DependencyNode | null> {
        // Prevent infinite recursion and circular dependencies
        if (depth >= this.MAX_DEPTH || this.visitedModules.has(module.name)) {
            return {
                name: module.name,
                version: module.version,
                source: module.source,
                children: [],
                depth,
                isDirectDependency,
                gitUrl: module.gitUrl,
                gitRef: module.gitRef,
                gitTag: module.gitTag
            };
        }

        this.visitedModules.add(module.name);

        const node: DependencyNode = {
            name: module.name,
            version: module.version,
            source: module.source,
            children: [],
            depth,
            isDirectDependency,
            gitUrl: module.gitUrl,
            gitRef: module.gitRef,
            gitTag: module.gitTag
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

                        const childNode = await this.buildNodeTree(childModule, depth + 1, false);
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
        
        let result = `${prefix}${connector}${node.name}${versionText}${sourceText}\n`;

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
     * Find potential dependency conflicts
     * @param nodes Array of root dependency nodes
     * @returns Array of conflict descriptions
     */
    public static findConflicts(nodes: DependencyNode[]): string[] {
        const conflicts: string[] = [];
        const versionMap = new Map<string, Set<string>>();

        // Collect all versions for each module
        const collectVersions = (node: DependencyNode) => {
            if (node.version) {
                if (!versionMap.has(node.name)) {
                    versionMap.set(node.name, new Set());
                }
                versionMap.get(node.name)!.add(node.version);
            }
            
            for (const child of node.children) {
                collectVersions(child);
            }
        };

        for (const node of nodes) {
            collectVersions(node);
        }

        // Check for conflicts (multiple versions of the same module)
        for (const [moduleName, versions] of versionMap.entries()) {
            if (versions.size > 1) {
                const versionList = Array.from(versions)
                    .sort((a, b) => a.localeCompare(b))
                    .join(', ');
                conflicts.push(
                    `${moduleName}: Multiple versions found (${versionList})`
                );
            }
        }

        return conflicts;
    }
}
