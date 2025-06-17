import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetForgeService, ForgeModule } from './puppetForgeService';
import { GitMetadataService, GitModuleMetadata } from './gitMetadataService';
import { VersionCompatibilityService, VersionCompatibility } from './versionCompatibilityService';
import { CacheService } from './cacheService';

/**
 * Provides hover information for Puppetfile modules
 */
export class PuppetfileHoverProvider implements vscode.HoverProvider {

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Check if this is a Puppetfile
        if (!this.isPuppetfile(document)) {
            return null;
        }

        // Get the word at the current position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        const line = document.lineAt(position).text;

        // Try to parse the module from this line (including multi-line modules)
        const module = this.parseModuleFromPosition(document, position);
        if (!module) {
            return null;
        }

        // Check if the cursor is over the module name
        const moduleNamePattern = /mod\s*['"]([^'"]+)['"]/ ;
        const moduleNameMatch = moduleNamePattern.exec(line);
        if (!moduleNameMatch) {
            return null;
        }

        const moduleNameStart = line.indexOf(moduleNameMatch[1]);
        const moduleNameEnd = moduleNameStart + moduleNameMatch[1].length;
        const cursorChar = position.character;

        // Check if cursor is within the module name
        if (cursorChar < moduleNameStart || cursorChar > moduleNameEnd) {
            return null;
        }

        try {
            // Get module information from Puppet Forge (with timeout)
            const moduleInfo = await Promise.race([
                this.getModuleInfo(module),
                new Promise<vscode.MarkdownString | null>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);

            if (moduleInfo) {
                return new vscode.Hover(moduleInfo);
            }
        } catch (error) {
            console.warn(`Error in hover provider for ${module.name}:`, error);
            // If there's an error fetching module info, show basic info
            try {
                return new vscode.Hover(this.getBasicModuleInfo(module));
            } catch (basicError) {
                console.error(`Error creating basic module info for ${module.name}:`, basicError);
                // Return null to prevent cascade failures
                return null;
            }
        }

        return null;
    }

    private isPuppetfile(document: vscode.TextDocument): boolean {
        return document.fileName.endsWith('Puppetfile') || 
               document.languageId === 'puppetfile';
    }

    private parseModuleFromPosition(document: vscode.TextDocument, position: vscode.Position): PuppetModule | null {
        const line = document.lineAt(position).text;
        
        // Check if this line contains a module declaration
        if (!line.trim().startsWith('mod ')) {
            return null;
        }
        
        // Extract the complete module definition (may span multiple lines)
        const moduleText = this.extractCompleteModuleDefinition(document, position.line);
        
        try {
            // Strip comments from each line before joining them
            const lines = moduleText.split('\n');
            const commentPattern = /^([^#'"]*(?:['"][^'"]*['"][^#'"]*)*)#.*$/;
            const cleanedLines = lines.map(line => {
                // Strip inline comments while preserving # in strings
                const commentMatch = commentPattern.exec(line);
                return commentMatch ? commentMatch[1].trim() : line.trim();
            });
            
            // Join the cleaned lines into a single line
            const singleLineText = cleanedLines.join(' ').trim();
            
            const parseResult = PuppetfileParser.parseContent(singleLineText);
            if (parseResult.modules.length > 0) {
                const module = parseResult.modules[0];
                module.line = position.line + 1; // VS Code uses 0-based line numbers
                return module;
            }
            return null;
        } catch (error) {
            console.debug('Failed to parse module from position:', error);
            return null;
        }
    }

    private extractCompleteModuleDefinition(document: vscode.TextDocument, startLine: number): string {
        let moduleText = document.lineAt(startLine).text;
        let currentLine = startLine + 1;
        
        // Check consecutive lines for Git module parameters
        const gitParameterPattern = /^[\t\s]+:(git|ref|tag|branch)\s*=>/;
        while (currentLine < document.lineCount) {
            const lineText = document.lineAt(currentLine).text;
            
            // Check if this line starts with whitespace followed by :git, :ref, :tag, etc.
            if (gitParameterPattern.exec(lineText)) {
                moduleText += '\n' + lineText;
                currentLine++;
            } else {
                // Stop when we hit a line that doesn't match the pattern
                break;
            }
        }
        
        return moduleText;
    }

    private async getModuleInfo(module: PuppetModule): Promise<vscode.MarkdownString | null> {
        if (module.source === 'git') {
            return await this.getGitModuleInfo(module);
        }

        // Check if we need to trigger caching for all modules
        const needsCaching = await this.checkAndInitializeCache();
        if (needsCaching) {
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.appendMarkdown(`## 📦 ${module.name}\n\n`);
            
            if (CacheService.isCachingInProgress()) {
                markdown.appendMarkdown(`*Module cache is currently being initialized. Check the progress notification.*\n\n`);
                markdown.appendMarkdown(`*Please wait for the caching to complete and then hover again to see version compatibility information.*\n\n`);
            } else {
                markdown.appendMarkdown(`*Module cache is being initialized in the background.*\n\n`);
                markdown.appendMarkdown(`*Please wait for the caching to complete and then hover again to see version compatibility information.*\n\n`);
                markdown.appendMarkdown(`💡 **Tip:** You can also manually run **Cache All Modules** command to pre-cache module information.`);
            }
            return markdown;
        }

        try {
            // Fetch from Puppet Forge
            const forgeModule = await PuppetForgeService.getModule(module.name);
            if (!forgeModule) {
                return this.getBasicModuleInfo(module);
            }

            // Check for updates
            const updateInfo = await PuppetForgeService.checkForUpdate(module.name, module.version);

            const allReleases = await PuppetForgeService.getModuleReleases(module.name);

            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportThemeIcons = true;

            // Module header
            markdown.appendMarkdown(`## 📦 ${module.name}\n\n`);

            // Current version info
            if (module.version) {
                markdown.appendMarkdown(`**Current Version:** \`${module.version}\`\n\n`);
            } else {
                markdown.appendMarkdown(`**Version:** Latest available\n\n`);
            }

            // Latest version info
            if (updateInfo.latestVersion) {
                if (updateInfo.hasUpdate) {
                    markdown.appendMarkdown(`**Latest Version:** \`${updateInfo.latestVersion}\` ⬆️ **Update Available**\n\n`);
                } else {
                    markdown.appendMarkdown(`**Latest Version:** \`${updateInfo.latestVersion}\` ✅ **Up to date**\n\n`);
                }
            }

            // Get all modules for compatibility checking
            const parseResult = PuppetfileParser.parseActiveEditor();
            const allModules = parseResult.modules;
            
            // Log parse errors if any (only for debugging)
            if (parseResult.errors.length > 0) {
                console.debug('Puppetfile parse errors:', parseResult.errors);
            }

            // Show versions based on whether a version is currently specified
            let versionsToShow: Array<{version: string}> = [];
            let versionSectionTitle = '';
            
            if (module.version) {
                // Show only newer versions if a version is specified
                versionsToShow = allReleases.filter(r => PuppetForgeService.compareVersions(r.version, module.version!) > 0);
                versionSectionTitle = '**Available Updates:**\n';
            } else {
                // No version specified, show all versions
                versionsToShow = allReleases;
                versionSectionTitle = '**Available Versions:**\n';
            }
            
            if (versionsToShow.length > 0) {
                markdown.appendMarkdown(versionSectionTitle);
                await this.appendVersionsWithCompatibility(markdown, module, versionsToShow, allModules);
            }

            // Dependencies for current version specified in Puppetfile
            let dependencies: Array<{name: string; version_requirement: string}> | undefined;
            
            if (module.version) {
                // Get dependencies from the specific version
                const release = allReleases.find(r => r.version === module.version);
                if (release?.metadata) {
                    dependencies = release.metadata.dependencies;
                }
                
                // Only fall back to current_release if the specific version wasn't found in releases
                // Do NOT fall back if the version exists but has no dependencies
                if (!release) {
                    dependencies = forgeModule.current_release?.metadata?.dependencies;
                }
            } else {
                // No version specified, use latest (current_release)
                dependencies = forgeModule.current_release?.metadata?.dependencies;
            }

            if (dependencies && dependencies.length > 0) {
                markdown.appendMarkdown(`**Dependencies:**\n`);
                for (const dep of dependencies) {
                    markdown.appendMarkdown(`- \`${dep.name}\` ${dep.version_requirement}\n`);
                }
                markdown.appendMarkdown('\n');
            }

            // Actions
            const forgeUrl = this.getForgeModuleUrl(module, forgeModule, module.version);
            markdown.appendMarkdown(`[View on Puppet Forge](${forgeUrl})`);

            return markdown;

        } catch (error) {
            console.warn(`Error fetching module info for ${module.name}:`, error);
            return this.getBasicModuleInfo(module);
        }
    }

    private async getGitModuleInfo(module: PuppetModule): Promise<vscode.MarkdownString> {
        // Try to fetch metadata.json from the Git repository
        if (module.gitUrl) {
            try {
                const ref = module.gitTag || module.gitRef;
                console.debug(`Fetching Git metadata for ${module.name} from ${module.gitUrl}`);
                const metadata = await GitMetadataService.getModuleMetadataWithFallback(module.gitUrl, ref);
                
                if (metadata) {
                    console.debug(`Retrieved Git metadata for ${module.name}: name="${metadata.name}", version="${metadata.version}"`);
                    // Check for name mismatch and log it
                    if (metadata.name && metadata.name !== module.name) {
                        console.info(`Name mismatch detected: Puppetfile="${module.name}", metadata.json="${metadata.name}"`);
                    }
                    return this.formatGitModuleWithMetadata(module, metadata);
                }
            } catch (error) {
                console.warn(`Failed to fetch Git metadata for ${module.name}:`, error);
                // Continue to fallback - don't rethrow
            }
        }

        // Fallback to basic info if metadata fetch fails or no gitUrl
        try {
            return this.getBasicGitModuleInfo(module);
        } catch (error) {
            console.error(`Error creating basic Git module info for ${module.name}:`, error);
            // Create a minimal markdown as last resort
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.appendMarkdown(`## 📦 ${module.name} [Git]\n\n*Error loading module information*`);
            return markdown;
        }
    }

    private formatGitModuleWithMetadata(module: PuppetModule, metadata: GitModuleMetadata): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        try {
            // Always use the Puppetfile declared name for consistency, but show metadata name if different
            const displayName = module.name;
            const metadataName = metadata.name;
            
            if (metadataName && metadataName !== module.name) {
                markdown.appendMarkdown(`## 📦 ${displayName} [Git]\n\n`);
                markdown.appendMarkdown(`*Repository name: \`${metadataName}\`*\n\n`);
            } else {
                markdown.appendMarkdown(`## 📦 ${displayName} [Git]\n\n`);
            }

        if (metadata.summary) {
            markdown.appendMarkdown(`*${metadata.summary}*\n\n`);
        }

        if (metadata.version) {
            markdown.appendMarkdown(`**Version:** \`${metadata.version}\`\n`);
        }

        if (metadata.author) {
            markdown.appendMarkdown(`**Author:** ${metadata.author}\n`);
        }

        if (metadata.license) {
            markdown.appendMarkdown(`**License:** ${metadata.license}\n`);
        }

        markdown.appendMarkdown('\n');

        if (module.gitUrl) {
            markdown.appendMarkdown(`**Repository:** [${module.gitUrl}](${module.gitUrl})\n`);
        }

        this.appendGitReference(markdown, module);

        markdown.appendMarkdown('\n');

        // Add project and issues links if available
        if (metadata.project_page && metadata.project_page !== module.gitUrl) {
            markdown.appendMarkdown(`**Project Page:** [${metadata.project_page}](${metadata.project_page})\n`);
        }

        if (metadata.issues_url) {
            markdown.appendMarkdown(`**Issues:** [${metadata.issues_url}](${metadata.issues_url})\n`);
        }

        // Add description if available and different from summary
        if (metadata.description && metadata.description !== metadata.summary) {
            markdown.appendMarkdown(`\n**Description:**\n${metadata.description}\n`);
        }

        // Add tags if available
        if (metadata.tags && metadata.tags.length > 0) {
            markdown.appendMarkdown(`\n**Tags:** ${metadata.tags.map(tag => `\`${tag}\``).join(', ')}\n`);
        }

        // Add dependencies if available
        if (metadata.dependencies && metadata.dependencies.length > 0) {
            markdown.appendMarkdown(`\n**Dependencies:** (${metadata.dependencies.length})\n`);
            for (const dep of metadata.dependencies) {
                markdown.appendMarkdown(`- \`${dep.name}\` ${dep.version_requirement}\n`);
            }
            markdown.appendMarkdown('\n');
        } else {
            markdown.appendMarkdown(`\n**Dependencies:** None\n\n`);
        }

            markdown.appendMarkdown(`\n**Source:** Git repository`);

            return markdown;
        } catch (error) {
            console.error(`Error formatting Git module with metadata for ${module.name}:`, error);
            // Fallback to basic Git module info if formatting fails
            return this.getBasicGitModuleInfo(module);
        }
    }

    private getBasicGitModuleInfo(module: PuppetModule): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`## 📦 ${module.name} [Git]\n\n`);

        if (module.gitUrl) {
            markdown.appendMarkdown(`**Repository:** [${module.gitUrl}](${module.gitUrl})\n\n`);
        }

        this.appendGitReference(markdown, module);
        markdown.appendMarkdown('\n');

        markdown.appendMarkdown(`**Source:** Git repository\n\n`);
        markdown.appendMarkdown(`*Loading module information...*\n\n`);
        markdown.appendMarkdown(`*Git modules are not managed through Puppet Forge*`);

        return markdown;
    }

    private getBasicModuleInfo(module: PuppetModule): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`## 📦 ${module.name}\n\n`);

        if (module.version) {
            markdown.appendMarkdown(`**Version:** \`${module.version}\`\n\n`);
        }

        markdown.appendMarkdown(`**Source:** ${module.source === 'forge' ? 'Puppet Forge' : 'Git Repository'}\n\n`);

        if (module.source === 'forge') {
            markdown.appendMarkdown(`*Loading additional information...*\n\n`);
            try {
                const forgeUrl = this.getForgeModuleUrl(module, undefined, module.version);
                markdown.appendMarkdown(`[View on Puppet Forge](${forgeUrl})`);
            } catch (error) {
                console.warn(`Error creating Forge URL for ${module.name}:`, error);
                markdown.appendMarkdown(`*Unable to generate Forge link*`);
            }
        } else if (module.gitUrl) {
            markdown.appendMarkdown(`**Repository:** [${module.gitUrl}](${module.gitUrl})\n\n`);
            this.appendGitReference(markdown, module);
            markdown.appendMarkdown('\n');
        }

        return markdown;
    }

    private getForgeModuleUrl(module: PuppetModule, forgeData?: ForgeModule | null, version?: string): string {
        let base: string;

        // Always use the module.name format (e.g., "puppetlabs/stdlib")
        if (module.name.includes('/')) {
            base = `https://forge.puppet.com/modules/${module.name}`;
        } else {
            // Handle old format "puppetlabs-stdlib" by converting to "puppetlabs/stdlib"
            const dashIndex = module.name.indexOf('-');
            if (dashIndex !== -1) {
                const owner = module.name.substring(0, dashIndex);
                const modName = module.name.substring(dashIndex + 1);
                base = `https://forge.puppet.com/modules/${owner}/${modName}`;
            } else {
                base = `https://forge.puppet.com/modules/${module.name}`;
            }
        }

        // Append the version to the base URL when provided so the link
        // navigates directly to that release on the Forge
        // Also, there is a bug with the Foreman Webstite so it is 
        // impossible to get to the main page of a specific version 
        // as it will redirect to the latest version
        // Try this example: https://forge.puppet.com/modules/puppetlabs/apache/12.0.3/readme
        // Therefore the `/dependencies` endpoint is used as a workaround 
        // to get the dependencies of a specific version
        return version ? `${base}/${version}/dependencies` : `${base}/dependencies`;
    }
    
    /**
     * Check if cache needs to be initialized and trigger caching
     * @returns True if cache is being initialized
     */
    private async checkAndInitializeCache(): Promise<boolean> {
        try {
            // Get all forge modules from the current Puppetfile
            const parseResult = PuppetfileParser.parseActiveEditor();
            const forgeModules = parseResult.modules.filter(m => m.source === 'forge');
            
            // Check if any module is not cached
            const uncachedModules = forgeModules.filter(m => !PuppetForgeService.hasModuleCached(m.name));
            
            if (uncachedModules.length > 0) {
                // Trigger caching with progress indicator
                this.triggerCachingWithProgress(forgeModules);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error in checkAndInitializeCache:', error);
            return false;
        }
    }
    
    /**
     * Trigger caching of modules with progress indicator
     * @param modules All forge modules (we'll filter to uncached ones internally)
     */
    private async triggerCachingWithProgress(modules: PuppetModule[]): Promise<void> {
        // Fire and forget - cache modules with progress
        CacheService.cacheUncachedModules(modules).catch(error => {
            console.warn('Background caching failed:', error);
        });
    }
    
    /**
     * Check version compatibilities for multiple versions
     * @param module The module being checked
     * @param versions Versions to check
     * @param allModules All modules in the Puppetfile
     * @returns Map of version to compatibility info
     */
    private async checkVersionCompatibilities(
        module: PuppetModule, 
        versions: Array<{version: string}>, 
        allModules: PuppetModule[]
    ): Promise<Map<string, VersionCompatibility>> {
        const compatibilityMap = new Map<string, VersionCompatibility>();
        
        // Process versions in chunks to avoid overwhelming the system
        const chunkSize = 10;
        for (let i = 0; i < versions.length; i += chunkSize) {
            const chunk = versions.slice(i, i + chunkSize);
            const chunkResults = await Promise.all(
                chunk.map(async (rel) => {
                    try {
                        const compatibility = await VersionCompatibilityService.checkVersionCompatibility(
                            module,
                            rel.version,
                            allModules
                        );
                        return { version: rel.version, compatibility };
                    } catch (error) {
                        console.warn(`Error checking compatibility for ${module.name}@${rel.version}:`, error);
                        // Return a default compatibility status on error
                        return { 
                            version: rel.version, 
                            compatibility: {
                                version: rel.version,
                                isCompatible: true, // Assume compatible if we can't check
                                conflicts: []
                            }
                        };
                    }
                })
            );
            
            for (const result of chunkResults) {
                compatibilityMap.set(result.version, result.compatibility);
            }
        }
        
        return compatibilityMap;
    }
    
    /**
     * Append Git reference information to markdown
     * @param markdown The markdown string to append to
     * @param module The module with Git information
     */
    private appendGitReference(markdown: vscode.MarkdownString, module: PuppetModule): void {
        if (module.gitTag) {
            markdown.appendMarkdown(`**Tag:** \`${module.gitTag}\`\n`);
        } else if (module.gitRef) {
            markdown.appendMarkdown(`**Reference:** \`${module.gitRef}\`\n`);
        } else {
            markdown.appendMarkdown(`**Reference:** Default branch\n`);
        }
    }
    
    /**
     * Append versions with compatibility indicators to markdown
     * @param markdown The markdown string to append to
     * @param module The module being displayed
     * @param versions Versions to display
     * @param allModules All modules in the Puppetfile
     */
    private async appendVersionsWithCompatibility(
        markdown: vscode.MarkdownString,
        module: PuppetModule,
        versions: Array<{version: string}>,
        allModules: PuppetModule[]
    ): Promise<void> {
        // Check compatibility for each version
        let versionCompatibilities = new Map<string, VersionCompatibility>();
        try {
            versionCompatibilities = await this.checkVersionCompatibilities(module, versions, allModules);
        } catch (error) {
            console.error(`Error checking version compatibilities for ${module.name}:`, error);
            // Continue without compatibility info rather than failing completely
        }
        
        // Group versions into rows of 5
        const versionsPerRow = 5;
        for (let i = 0; i < versions.length; i += versionsPerRow) {
            const rowVersions = versions.slice(i, i + versionsPerRow);
            
            // Create clickable version links with color indicators
            const versionLinks = rowVersions.map(rel => {
                const compatibility = versionCompatibilities.get(rel.version);
                const indicator = compatibility?.isCompatible ? '🟢' : '🟡';
                const args = JSON.stringify([{ line: module.line, version: rel.version }]);
                
                if (compatibility && !compatibility.isCompatible && compatibility.conflicts) {
                    // Add conflict details to tooltip
                    const conflictDetails = compatibility.conflicts
                        .map(c => `${c.moduleName} requires ${c.requirement}`)
                        .join(', ');
                    return `${indicator} [\`${rel.version}\`](command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(args)} "Update to ${rel.version} - Conflicts: ${conflictDetails}")`;
                } else {
                    return `${indicator} [\`${rel.version}\`](command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(args)} "Update to ${rel.version}")`;
                }
            });
            
            markdown.appendMarkdown(versionLinks.join('  ') + '\n');
        }
        markdown.appendMarkdown('\n');
    }
}

