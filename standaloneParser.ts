/**
 * Represents a Puppet module from a Puppetfile
 */
export interface PuppetModule {
    name: string;
    version?: string;
    source: 'forge' | 'git';
    gitUrl?: string;
    gitRef?: string;
    gitTag?: string;
    forgeUrl?: string;
    line: number;
}

/**
 * Result of parsing a Puppetfile
 */
export interface ParseResult {
    modules: PuppetModule[];
    errors: string[];
}

/**
 * Standalone Parser for Puppetfile syntax (without VS Code dependencies)
 */
export class StandalonePuppetfileParser {
    
    /**
     * Parse Puppetfile content from a string
     * @param content The Puppetfile content to parse
     * @returns ParseResult containing modules and any parsing errors
     */
    public static parseContent(content: string): ParseResult {
        const modules: PuppetModule[] = [];
        const errors: string[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNumber = i + 1;

            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
                continue;
            }

            try {
                const module = this.parseModuleLine(line, lineNumber);
                if (module) {
                    modules.push(module);
                }
            } catch (error) {
                errors.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
            }
        }

        return { modules, errors };
    }

    /**
     * Parse a single module line from a Puppetfile
     */
    private static parseModuleLine(line: string, lineNumber: number): PuppetModule | null {
        // Remove leading/trailing whitespace
        line = line.trim();
        
        // Skip non-module lines (forge, etc.)
        if (!line.startsWith('mod ') && !line.startsWith('mod\'') && !line.startsWith('mod"')) {
            return null;
        }

        // Basic regex patterns for different module declaration styles
        const patterns = [
            // mod 'module_name', :git => 'url', :tag => 'tag'
            /^mod\s*['"]([^'"]+)['"],\s*:git\s*=>\s*['"]([^'"]+)['"],\s*:tag\s*=>\s*['"]([^'"]+)['"]$/,
            // mod 'module_name', :git => 'url', :ref => 'ref'
            /^mod\s*['"]([^'"]+)['"],\s*:git\s*=>\s*['"]([^'"]+)['"],\s*:ref\s*=>\s*['"]([^'"]+)['"]$/,
            // mod 'module_name', :git => 'url'
            /^mod\s*['"]([^'"]+)['"],\s*:git\s*=>\s*['"]([^'"]+)['"]$/,
            // mod 'module_name', 'version' - with very flexible whitespace
            /^mod\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*$/,
            // mod 'module_name'
            /^mod\s*['"]([^'"]+)['"]$/
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(line);
            if (match) {
                return this.createModuleFromMatch(match, lineNumber);
            }
        }

        // If no pattern matches, try to parse as a complex module definition
        return this.parseComplexModuleLine(line, lineNumber);
    }

    /**
     * Create a PuppetModule from a regex match
     */
    private static createModuleFromMatch(match: RegExpMatchArray, lineNumber: number): PuppetModule {
        const moduleName = match[1];
        const matchText = match[0];
        
        // Check if it's a git-based module
        if (matchText.includes(':git')) {
            const module: PuppetModule = {
                name: moduleName,
                source: 'git',
                gitUrl: match[2],
                line: lineNumber
            };

            if (match[3]) {
                if (matchText.includes(':tag')) {
                    module.gitTag = match[3];
                } else if (matchText.includes(':ref')) {
                    module.gitRef = match[3];
                }
            }

            return module;
        }

        // Otherwise, it's a forge module
        const module: PuppetModule = {
            name: moduleName,
            source: 'forge',
            line: lineNumber
        };

        // Add version if present and it's not a git URL
        if (match[2] && !match[2].includes('git') && !match[2].includes('http')) {
            module.version = match[2];
        }

        return module;
    }

    /**
     * Parse complex module lines with multiple options
     */
    private static parseComplexModuleLine(line: string, lineNumber: number): PuppetModule | null {
        // Extract module name
        const modMatch = line.match(/^mod\s*['"]([^'"]+)['"]/);
        if (!modMatch) {
            throw new Error('Invalid module declaration syntax');
        }

        const moduleName = modMatch[1];
        const module: PuppetModule = {
            name: moduleName,
            source: 'forge',
            line: lineNumber
        };

        // Check for git source
        const gitMatch = line.match(/:git\s*=>\s*['"]([^'"]+)['"]/);
        if (gitMatch) {
            module.source = 'git';
            module.gitUrl = gitMatch[1];

            // Look for tag or ref
            const tagMatch = line.match(/:tag\s*=>\s*['"]([^'"]+)['"]/);
            const refMatch = line.match(/:ref\s*=>\s*['"]([^'"]+)['"]/);

            if (tagMatch) {
                module.gitTag = tagMatch[1];
            } else if (refMatch) {
                module.gitRef = refMatch[1];
            }
        } else {
            // Look for version - check if it's the second quoted string after the module name
            // But make sure it's not part of a git configuration
            const versionMatch = line.match(/^mod\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"](?:\s*$|,)/);
            if (versionMatch && !line.includes(':git')) {
                module.version = versionMatch[2];
            }
        }

        return module;
    }
}
