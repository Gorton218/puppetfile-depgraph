/**
 * Utility functions for normalizing and working with Puppet module names
 * 
 * Puppet module names can appear in various formats:
 * - puppetlabs/stdlib (Puppetfile format)
 * - puppetlabs-stdlib (Puppet Forge API format)
 * - puppetlabs/puppet-nginx vs puppet/nginx (naming variants)
 * 
 * This utility provides consistent normalization across the codebase.
 */

export interface ModuleNameParts {
    owner: string;
    name: string;
    fullName: string;
}

/**
 * Formats supported for module names
 */
export enum ModuleNameFormat {
    SLASH = 'slash',    // puppetlabs/stdlib
    DASH = 'dash',      // puppetlabs-stdlib
    CANONICAL = 'canonical' // Normalized lowercase dash format
}

export class ModuleNameUtils {
    
    /**
     * Parse a module name into its component parts
     * Handles both slash and dash formats
     */
    static parseModuleName(moduleName: string): ModuleNameParts {
        const normalized = moduleName.trim();
        
        let owner: string;
        let name: string;
        
        if (normalized.includes('/')) {
            const parts = normalized.split('/');
            owner = parts[0];
            name = parts[1];
        } else if (normalized.includes('-')) {
            const dashIndex = normalized.indexOf('-');
            owner = normalized.substring(0, dashIndex);
            name = normalized.substring(dashIndex + 1);
        } else {
            // Single name without owner, assume 'unknown' owner
            owner = 'unknown';
            name = normalized;
        }
        
        return {
            owner,
            name,
            fullName: `${owner}/${name}`
        };
    }
    
    /**
     * Convert module name to canonical format (lowercase dash format)
     * This is used for cache keys and internal consistency
     * 
     * Examples:
     * - "puppetlabs/stdlib" -> "puppetlabs-stdlib"
     * - "Puppetlabs/StdLib" -> "puppetlabs-stdlib"
     * - "puppetlabs-stdlib" -> "puppetlabs-stdlib"
     */
    static toCanonicalFormat(moduleName: string): string {
        const parts = this.parseModuleName(moduleName);
        return `${parts.owner}-${parts.name}`.toLowerCase();
    }
    
    /**
     * Convert module name to slash format (Puppetfile format)
     * 
     * Examples:
     * - "puppetlabs-stdlib" -> "puppetlabs/stdlib"
     * - "puppetlabs/stdlib" -> "puppetlabs/stdlib"
     */
    static toSlashFormat(moduleName: string): string {
        const parts = this.parseModuleName(moduleName);
        return parts.fullName;
    }
    
    /**
     * Convert module name to dash format (Puppet Forge API format)
     * 
     * Examples:
     * - "puppetlabs/stdlib" -> "puppetlabs-stdlib"
     * - "puppetlabs-stdlib" -> "puppetlabs-stdlib"
     */
    static toDashFormat(moduleName: string): string {
        const parts = this.parseModuleName(moduleName);
        return `${parts.owner}-${parts.name}`;
    }
    
    /**
     * Convert module name to specified format
     */
    static toFormat(moduleName: string, format: ModuleNameFormat): string {
        switch (format) {
            case ModuleNameFormat.SLASH:
                return this.toSlashFormat(moduleName);
            case ModuleNameFormat.DASH:
                return this.toDashFormat(moduleName);
            case ModuleNameFormat.CANONICAL:
                return this.toCanonicalFormat(moduleName);
            default:
                return moduleName;
        }
    }
    
    /**
     * Generate common variants of a module name for lookup operations
     * Handles special cases like puppetlabs/puppet-nginx -> puppet/nginx
     * 
     * Returns array of possible names in order of preference
     */
    static getModuleNameVariants(moduleName: string): string[] {
        const variants = new Set<string>();
        const parts = this.parseModuleName(moduleName);
        
        // Add original formats
        variants.add(this.toSlashFormat(moduleName));
        variants.add(this.toDashFormat(moduleName));
        variants.add(this.toCanonicalFormat(moduleName));
        
        // Handle puppetlabs/puppet-* -> puppet/* pattern
        if (parts.owner === 'puppetlabs' && parts.name.startsWith('puppet-')) {
            const shortName = parts.name.replace('puppet-', '');
            variants.add(`puppet/${shortName}`);
            variants.add(`puppet-${shortName}`);
            variants.add(`puppet-${shortName}`.toLowerCase());
        }
        
        // Handle reverse: puppet/* -> puppetlabs/puppet-* pattern
        if (parts.owner === 'puppet') {
            variants.add(`puppetlabs/puppet-${parts.name}`);
            variants.add(`puppetlabs-puppet-${parts.name}`);
            variants.add(`puppetlabs-puppet-${parts.name}`.toLowerCase());
        }
        
        // Convert to array and remove duplicates while preserving order
        return Array.from(variants);
    }
    
    /**
     * Check if two module names refer to the same module
     * Accounts for different naming formats and conventions
     */
    static areEquivalent(name1: string, name2: string): boolean {
        const canonical1 = this.toCanonicalFormat(name1);
        const canonical2 = this.toCanonicalFormat(name2);
        
        if (canonical1 === canonical2) {
            return true;
        }
        
        // Check if they're variants of each other
        const variants1 = this.getModuleNameVariants(name1);
        const variants2 = this.getModuleNameVariants(name2);
        
        return variants1.some(v1 => 
            variants2.some(v2 => 
                this.toCanonicalFormat(v1) === this.toCanonicalFormat(v2)
            )
        );
    }
    
    /**
     * Extract owner from module name
     */
    static getOwner(moduleName: string): string {
        return this.parseModuleName(moduleName).owner;
    }
    
    /**
     * Extract module name (without owner) from full module name
     */
    static getModuleName(moduleName: string): string {
        return this.parseModuleName(moduleName).name;
    }
    
    /**
     * Legacy method for backward compatibility
     * @deprecated Use toCanonicalFormat instead
     */
    static normalizeModuleName(moduleName: string): string {
        return this.toCanonicalFormat(moduleName);
    }
}