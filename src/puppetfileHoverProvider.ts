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

            // Dependencies
            if (forgeModule.current_release?.metadata?.dependencies && 
                forgeModule.current_release.metadata.dependencies.length > 0) {
                markdown.appendMarkdown(`**Dependencies:**\n`);
                for (const dep of forgeModule.current_release.metadata.dependencies) {
                    markdown.appendMarkdown(`- \`${dep.name}\` ${dep.version_requirement}\n`);
                }
                markdown.appendMarkdown('\n');
            }

            // Actions
            const forgeUrl = this.getForgeModuleUrl(module, forgeModule);
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
            const forgeUrl = this.getForgeModuleUrl(module);
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

    private getForgeModuleUrl(module: PuppetModule, forgeData?: ForgeModule | null): string {
        if (forgeData && forgeData.owner && forgeData.name) {
            return `https://forge.puppet.com/modules/${forgeData.owner.username}/${forgeData.name}`;
        }

        if (module.name.includes('/')) {
            return `https://forge.puppet.com/modules/${module.name}`;
        }

        const dashIndex = module.name.indexOf('-');
        if (dashIndex !== -1) {
            const owner = module.name.substring(0, dashIndex);
            const modName = module.name.substring(dashIndex + 1);
            return `https://forge.puppet.com/modules/${owner}/${modName}`;
        }

        return `https://forge.puppet.com/modules/${module.name}`;
    }
}

