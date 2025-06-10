import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetForgeService, ForgeModule } from './puppetForgeService';
import { GitMetadataService, GitModuleMetadata } from './gitMetadataService';

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
        const lineNumber = position.line + 1;

        // Try to parse the module from this line (including multi-line modules)
        const module = this.parseModuleFromPosition(document, position);
        if (!module) {
            return null;
        }

        // Check if the cursor is over the module name
        const moduleNameMatch = line.match(/mod\s*['"]([^'"]+)['"]/);
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
            // If there's an error fetching from Forge, show basic info
            return new vscode.Hover(this.getBasicModuleInfo(module));
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
            // Convert multi-line to single line for easier parsing
            const singleLineText = moduleText.replace(/\n\s*/g, ' ').trim();
            
            const parseResult = PuppetfileParser.parseContent(singleLineText);
            if (parseResult.modules.length > 0) {
                const module = parseResult.modules[0];
                module.line = position.line + 1; // VS Code uses 0-based line numbers
                return module;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    private extractCompleteModuleDefinition(document: vscode.TextDocument, startLine: number): string {
        let moduleText = document.lineAt(startLine).text;
        let currentLine = startLine + 1;
        
        // Check consecutive lines for Git module parameters
        while (currentLine < document.lineCount) {
            const lineText = document.lineAt(currentLine).text;
            
            // Check if this line starts with whitespace followed by :git, :ref, :tag, etc.
            if (lineText.match(/^[\t\s]+:(git|ref|tag|branch)\s*=>/)) {
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

            // Show only newer versions if a version is specified
            if (module.version) {
                const newerVersions = allReleases.filter(r => PuppetForgeService.compareVersions(r.version, module.version!) > 0);
                if (newerVersions.length > 0) {
                    markdown.appendMarkdown(`**Available Updates:**\n`);
                    
                    // Group versions into rows of 5
                    const versionsPerRow = 5;
                    for (let i = 0; i < newerVersions.length; i += versionsPerRow) {
                        const rowVersions = newerVersions.slice(i, i + versionsPerRow);
                        
                        // Create clickable version links without dots
                        const versionLinks = rowVersions.map(rel => {
                            // Try a simpler command format that VS Code can handle
                            const args = JSON.stringify([{ line: module.line, version: rel.version }]);
                            return `[\`${rel.version}\`](command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(args)} "Update to ${rel.version}")`;
                        });
                        
                        markdown.appendMarkdown(versionLinks.join('  ') + '\n');
                    }
                    markdown.appendMarkdown('\n');
                }
            } else {
                // No version specified, show all versions
                if (allReleases.length > 0) {
                    markdown.appendMarkdown(`**Available Versions:**\n`);
                    
                    // Group versions into rows of 5
                    const versionsPerRow = 5;
                    for (let i = 0; i < allReleases.length; i += versionsPerRow) {
                        const rowVersions = allReleases.slice(i, i + versionsPerRow);
                        
                        // Create clickable version links without dots
                        const versionLinks = rowVersions.map(rel => {
                            // Try a simpler command format that VS Code can handle
                            const args = JSON.stringify([{ line: module.line, version: rel.version }]);
                            return `[\`${rel.version}\`](command:puppetfile-depgraph.updateModuleVersion?${encodeURIComponent(args)} "Update to ${rel.version}")`;
                        });
                        
                        markdown.appendMarkdown(versionLinks.join('  ') + '\n');
                    }
                    markdown.appendMarkdown('\n');
                }
            }

            // Dependencies for current version specified in Puppetfile
            let dependencies: Array<{name: string; version_requirement: string}> | undefined;
            
            if (module.version) {
                // Get dependencies from the specific version
                const release = allReleases.find(r => r.version === module.version);
                if (release && release.metadata) {
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
            return this.getBasicModuleInfo(module);
        }
    }

    private async getGitModuleInfo(module: PuppetModule): Promise<vscode.MarkdownString> {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        // Try to fetch metadata.json from the Git repository
        if (module.gitUrl) {
            try {
                const ref = module.gitTag || module.gitRef;
                const metadata = await GitMetadataService.getModuleMetadataWithFallback(module.gitUrl, ref);
                
                if (metadata) {
                    return this.formatGitModuleWithMetadata(module, metadata);
                }
            } catch (error) {
                console.warn(`Failed to fetch Git metadata for ${module.name}:`, error);
            }
        }

        // Fallback to basic info if metadata fetch fails
        return this.getBasicGitModuleInfo(module);
    }

    private formatGitModuleWithMetadata(module: PuppetModule, metadata: GitModuleMetadata): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`## 📦 ${metadata.name || module.name} [Git]\n\n`);

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

        if (module.gitTag) {
            markdown.appendMarkdown(`**Tag:** \`${module.gitTag}\`\n`);
        } else if (module.gitRef) {
            markdown.appendMarkdown(`**Reference:** \`${module.gitRef}\`\n`);
        } else {
            markdown.appendMarkdown(`**Reference:** Default branch\n`);
        }

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
            markdown.appendMarkdown(`\n**Dependencies:**\n`);
            for (const dep of metadata.dependencies) {
                markdown.appendMarkdown(`- \`${dep.name}\` ${dep.version_requirement}\n`);
            }
            markdown.appendMarkdown('\n');
        }

        markdown.appendMarkdown(`\n**Source:** Git repository`);

        return markdown;
    }

    private getBasicGitModuleInfo(module: PuppetModule): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`## 📦 ${module.name} [Git]\n\n`);

        if (module.gitUrl) {
            markdown.appendMarkdown(`**Repository:** [${module.gitUrl}](${module.gitUrl})\n\n`);
        }

        if (module.gitTag) {
            markdown.appendMarkdown(`**Tag:** \`${module.gitTag}\`\n\n`);
        } else if (module.gitRef) {
            markdown.appendMarkdown(`**Reference:** \`${module.gitRef}\`\n\n`);
        } else {
            markdown.appendMarkdown(`**Reference:** Default branch\n\n`);
        }

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
            const forgeUrl = this.getForgeModuleUrl(module, undefined, module.version);
            markdown.appendMarkdown(`[View on Puppet Forge](${forgeUrl})`);
        } else if (module.gitUrl) {
            markdown.appendMarkdown(`**Repository:** [${module.gitUrl}](${module.gitUrl})\n\n`);
            if (module.gitTag) {
                markdown.appendMarkdown(`**Tag:** \`${module.gitTag}\`\n\n`);
            } else if (module.gitRef) {
                markdown.appendMarkdown(`**Reference:** \`${module.gitRef}\`\n\n`);
            }
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
}

