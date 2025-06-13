import * as vscode from 'vscode';

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
 * Parser for Puppetfile syntax
 */
export class PuppetfileParser {
    
    /**
     * Parse the content of the active text editor
     * @returns ParseResult containing modules and any parsing errors
     */
    public static parseActiveEditor(): ParseResult {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return { modules: [], errors: ['No active editor found'] };
        }

        const document = editor.document;
        if (!this.isPuppetfile(document)) {
            return { modules: [], errors: ['Active file is not a Puppetfile'] };
        }

        return this.parseContent(document.getText());
    }

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
                // Check if this is the start of a module definition
                if (line.startsWith('mod ')) {
                    // First, strip any inline comment from the line
                    const cleanLine = this.stripInlineComment(line);
                    
                    // Check if this might be a multi-line module definition
                    // A multi-line module definition typically ends with a comma and doesn't have a complete definition
                    if (cleanLine.endsWith(',') && !cleanLine.includes(';')) {
                        // This might be a multi-line module definition
                        const multiLineModule = this.parseMultiLineModule(lines, i);
                        if (multiLineModule.module) {
                            modules.push(multiLineModule.module);
                            i = multiLineModule.lastLine; // Skip the lines we've already processed
                            continue;
                        }
                    }
                }
                
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
     * Parse a multi-line module definition
     * @param lines Array of all lines in the file
     * @param startIndex Index of the line where the module definition starts
     * @returns Object containing the parsed module and the last line index processed
     */
    private static parseMultiLineModule(lines: string[], startIndex: number): { module: PuppetModule | null, lastLine: number } {
        let currentIndex = startIndex;
        let accumulatedLine = '';
        let foundEnd = false;
        const startLineNumber = startIndex + 1;

        // Accumulate lines until we find the end of the module definition
        while (currentIndex < lines.length && !foundEnd) {
            const line = lines[currentIndex].trim();
            
            // Skip empty lines and comments within the module definition
            if (!line || line.startsWith('#')) {
                currentIndex++;
                continue;
            }

            // Strip inline comments before adding to accumulated content
            const cleanLine = this.stripInlineComment(line);
            
            // Add the line to our accumulated content
            if (accumulatedLine) {
                accumulatedLine += ' ' + cleanLine;
            } else {
                accumulatedLine = cleanLine;
            }

            // Check if this line ends the module definition
            // A module definition ends when we find a line that doesn't end with a comma
            // or when we encounter a closing parenthesis/bracket
            if (!cleanLine.endsWith(',') || cleanLine.includes(')') || cleanLine.includes(']')) {
                foundEnd = true;
            }

            currentIndex++;
        }

        // If we didn't find a proper end, treat it as a single line
        if (!foundEnd) {
            return { module: null, lastLine: startIndex };
        }

        // Clean up the accumulated line - remove extra whitespace
        accumulatedLine = accumulatedLine.replace(/\s+/g, ' ').trim();

        try {
            // Parse the complete multi-line module definition
            const module = this.parseModuleLine(accumulatedLine, startLineNumber);
            return { module, lastLine: currentIndex - 1 };
        } catch (error) {
            // If parsing fails, return null and let the regular parsing handle it line by line
            return { module: null, lastLine: startIndex };
        }
    }

    /**
     * Parse a single module line from a Puppetfile
     * @param line The line to parse
     * @param lineNumber The line number for error reporting
     * @returns PuppetModule if the line contains a module definition, null otherwise
     */
    private static parseModuleLine(line: string, lineNumber: number): PuppetModule | null {
        // Remove leading/trailing whitespace and strip inline comments
        line = this.stripInlineComment(line);
        
        // Skip non-module lines (forge, etc.)
        if (!line.startsWith('mod ') && !line.startsWith('mod\'') && !line.startsWith('mod"')) {
            return null;
        }
        
        // Common regex components
        const MOD_START = /^mod\s*['"]([^'"]+)['"]/.source;
        const GIT_URL = /:git\s*=>\s*['"]([^'"]+)['"]/.source;
        const GIT_TAG = /:tag\s*=>\s*['"]([^'"]+)['"]/.source;
        const GIT_REF = /:ref\s*=>\s*['"]([^'"]+)['"]/.source;
        const VERSION = /,\s*['"]([^'"]+)['"]/.source;
        
        // Build patterns from components
        const patterns = [
            // Git modules with tag or ref
            new RegExp(`${MOD_START}.*${GIT_URL}.*${GIT_TAG}`, 's'),
            new RegExp(`${MOD_START}.*${GIT_URL}.*${GIT_REF}`, 's'),
            new RegExp(`${MOD_START}.*${GIT_URL}`, 's'),
            // Forge modules
            new RegExp(`${MOD_START}\\s*${VERSION}\\s*$`),
            new RegExp(`${MOD_START}$`)
        ];
        
        for (const pattern of patterns) {
            const match = line.match(pattern);
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

            this.extractGitRef(matchText, match[3], module);

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

        // Check for git source (handle multi-line with dotall flag)
        const gitMatch = line.match(/:git\s*=>\s*['"]([^'"]+)['"]/s);
        if (gitMatch) {
            module.source = 'git';
            module.gitUrl = gitMatch[1];

            // Look for tag or ref (handle multi-line)
            const tagMatch = line.match(/:tag\s*=>\s*['"]([^'"]+)['"]/s);
            const refMatch = line.match(/:ref\s*=>\s*['"]([^'"]+)['"]/s);

            this.extractGitRef(line, tagMatch?.[1] || refMatch?.[1], module, tagMatch ? 'tag' : 'ref');
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

    /**
     * Strip inline comments from a line while preserving # in strings
     */
    private static stripInlineComment(line: string): string {
        // This regex looks for # that's not inside quotes
        const commentMatch = line.match(/^([^#'"]*(?:['"][^'"]*['"][^#'"]*)*)#.*$/);
        if (commentMatch) {
            return commentMatch[1].trim();
        }
        return line.trim();
    }

    /**
     * Extract Git ref or tag information and add to module
     */
    private static extractGitRef(text: string, refValue: string | undefined, module: PuppetModule, refType?: 'tag' | 'ref'): void {
        if (!refValue) return;
        
        if (refType === 'tag' || text.includes(':tag')) {
            module.gitTag = refValue;
        } else if (refType === 'ref' || text.includes(':ref')) {
            module.gitRef = refValue;
        }
    }

    /**
     * Check if a document is a Puppetfile
     */
    private static isPuppetfile(document: vscode.TextDocument): boolean {
        const fileName = document.fileName.toLowerCase();
        return fileName.endsWith('puppetfile') || 
               fileName.includes('puppetfile') ||
               document.languageId === 'puppetfile';
    }

    /**
     * Get the active Puppetfile document if available
     */
    public static getActivePuppetfileDocument(): vscode.TextDocument | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const document = editor.document;
        return this.isPuppetfile(document) ? document : null;
    }
}
