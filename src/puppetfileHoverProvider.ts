import * as vscode from 'vscode';
import { PuppetfileParser, PuppetModule } from './puppetfileParser';
import { PuppetForgeService, ForgeModule } from './puppetForgeService';

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

        // Try to parse the module from this line
        const module = this.parseModuleFromLine(line, lineNumber);
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

    private parseModuleFromLine(line: string, lineNumber: number): PuppetModule | null {
        try {
            const parseResult = PuppetfileParser.parseContent(line);
            return parseResult.modules.length > 0 ? parseResult.modules[0] : null;
        } catch (error) {
            return null;
        }
    }

    private async getModuleInfo(module: PuppetModule): Promise<vscode.MarkdownString | null> {
        if (module.source === 'git') {
            return this.getGitModuleInfo(module);
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

            // Show upgrade options
            if (module.version) {
                const newer = allReleases.filter(r => PuppetForgeService.compareVersions(r.version, module.version!) > 0);
                if (newer.length > 0) {
                    markdown.appendMarkdown(`**Available Versions:**\n`);
                    for (const rel of newer) {
                        const args = encodeURIComponent(JSON.stringify({ line: module.line, version: rel.version }));
                        markdown.appendMarkdown(`- [\`${rel.version}\`](command:puppetfile-depgraph.updateModuleVersion?${args})\n`);
                    }
                    markdown.appendMarkdown('\n');
                }
            }

            // Dependencies for current version
            let dependencies = forgeModule.current_release?.metadata?.dependencies;
            if (module.version) {
                const release = allReleases.find(r => r.version === module.version);
                dependencies = release?.metadata?.dependencies;
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

    private getGitModuleInfo(module: PuppetModule): vscode.MarkdownString {
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

        if (forgeData?.owner?.username && forgeData.name) {
            base = `https://forge.puppet.com/modules/${forgeData.owner.username}/${forgeData.name}`;
        } else if (module.name.includes('/')) {
            base = `https://forge.puppet.com/modules/${module.name}`;
        } else {
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
        return version ? `${base}/${version}` : base;
    }
}

