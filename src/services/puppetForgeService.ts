import axios, { AxiosRequestConfig } from 'axios';
import pkg from '../../package.json';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ModuleNameUtils } from '../utils/moduleNameUtils';

/**
 * Represents version information from Puppet Forge
 */
export interface ForgeVersion {
    version: string;
    created_at: string;
    updated_at: string;
    downloads: number;
    file_size: number;
    file_md5: string;
    file_uri: string;
    metadata: {
        dependencies?: Array<{
            name: string;
            version_requirement: string;
        }>;
    };
}

/**
 * Represents a module from Puppet Forge with built-in caching and normalization
 */
export class ForgeModule {
    // Static cache for ForgeModule instances
    private static readonly moduleCache: Map<string, ForgeModule> = new Map();
    
    // Module identification and normalization
    public readonly originalName: string;
    public readonly normalizedName: string;
    public readonly authorName: string;
    public readonly moduleName: string;
    public readonly slashFormat: string;
    public readonly dashFormat: string;
    public readonly variants: readonly string[];
    
    // Forge API data
    public readonly name: string;
    public readonly slug: string;
    public readonly owner: {
        username: string;
        slug: string;
    };
    public current_release?: {
        version: string;
        created_at: string;
        metadata: {
            dependencies?: Array<{
                name: string;
                version_requirement: string;
            }>;
        };
    };
    public releases?: ForgeVersion[];
    public downloads: number;
    public feedback_score: number;
    
    private constructor(
        originalName: string,
        data: {
            current_release?: {
                version: string;
                created_at: string;
                metadata: {
                    dependencies?: Array<{
                        name: string;
                        version_requirement: string;
                    }>;
                };
            };
            releases?: ForgeVersion[];
            downloads: number;
            feedback_score: number;
        }
    ) {
        this.originalName = originalName.trim();
        
        // Parse and normalize the module name
        const parsed = ModuleNameUtils.parseModuleName(this.originalName);
        this.authorName = parsed.owner;
        this.moduleName = parsed.name;
        this.slashFormat = parsed.fullName;
        this.dashFormat = ModuleNameUtils.toDashFormat(this.originalName);
        this.normalizedName = ModuleNameUtils.toCanonicalFormat(this.originalName);
        this.variants = Object.freeze(ModuleNameUtils.getModuleNameVariants(this.originalName));
        
        // Set Forge API data
        this.name = this.slashFormat; // API expects slash format for name
        this.slug = this.dashFormat;  // API uses dash format for slug
        this.owner = {
            username: this.authorName,
            slug: this.authorName
        };
        this.current_release = data.current_release;
        this.releases = data.releases;
        this.downloads = data.downloads;
        this.feedback_score = data.feedback_score;
    }
    
    /**
     * Factory method to create or retrieve a ForgeModule from cache
     * This is the primary way to get ForgeModule instances
     */
    public static create(
        moduleName: string,
        data: {
            current_release?: {
                version: string;
                created_at: string;
                metadata: {
                    dependencies?: Array<{
                        name: string;
                        version_requirement: string;
                    }>;
                };
            };
            releases?: ForgeVersion[];
            downloads: number;
            feedback_score: number;
        }
    ): ForgeModule {
        const normalizedKey = ModuleNameUtils.toCanonicalFormat(moduleName);
        
        // Check cache first
        const cached = this.moduleCache.get(normalizedKey);
        if (cached) {
            // Update cached data with new information
            if (data.current_release) {
                cached.current_release = data.current_release;
            }
            if (data.releases) {
                cached.releases = data.releases;
            }
            cached.downloads = data.downloads;
            cached.feedback_score = data.feedback_score;
            return cached;
        }
        
        // Create new instance and cache it
        const module = new ForgeModule(moduleName, data);
        this.moduleCache.set(normalizedKey, module);
        
        // Also cache under all variants for faster lookups
        for (const variant of module.variants) {
            const variantKey = ModuleNameUtils.toCanonicalFormat(variant);
            if (!this.moduleCache.has(variantKey)) {
                this.moduleCache.set(variantKey, module);
            }
        }
        
        return module;
    }
    
    /**
     * Get a cached ForgeModule by any name variant
     */
    public static getCached(moduleName: string): ForgeModule | null {
        const normalizedKey = ModuleNameUtils.toCanonicalFormat(moduleName);
        return this.moduleCache.get(normalizedKey) ?? null;
    }
    
    /**
     * Check if a module is cached
     */
    public static isCached(moduleName: string): boolean {
        const normalizedKey = ModuleNameUtils.toCanonicalFormat(moduleName);
        return this.moduleCache.has(normalizedKey);
    }
    
    /**
     * Clear the module cache
     */
    public static clearCache(): void {
        this.moduleCache.clear();
    }
    
    /**
     * Get all cached modules
     */
    public static getAllCached(): ForgeModule[] {
        // Return unique modules (since we cache under multiple variants)
        const uniqueModules = new Set<ForgeModule>();
        for (const module of this.moduleCache.values()) {
            uniqueModules.add(module);
        }
        return Array.from(uniqueModules);
    }
    
    /**
     * Check if this module is equivalent to another name
     */
    public isEquivalentTo(other: string | ForgeModule): boolean {
        const otherName = other instanceof ForgeModule ? other.normalizedName : ModuleNameUtils.toCanonicalFormat(other);
        return this.normalizedName === otherName || this.variants.some(variant => 
            ModuleNameUtils.toCanonicalFormat(variant) === otherName
        );
    }
    
    /**
     * Get the latest version of this module
     */
    public getLatestVersion(): string | null {
        return this.current_release?.version ?? null;
    }
    
    /**
     * Get all versions sorted by semantic version (newest first)
     */
    public getVersions(): string[] {
        if (!this.releases) {
            return [];
        }
        
        return this.releases
            .map(r => r.version)
            .sort((a, b) => PuppetForgeService.compareVersions(b, a));
    }
    
    /**
     * Get the latest safe version (excluding pre-releases)
     */
    public getLatestSafeVersion(): string | null {
        if (!this.releases) {
            return this.getLatestVersion();
        }
        
        const safeVersions = this.releases
            .filter(r => PuppetForgeService.isSafeVersion(r.version))
            .map(r => r.version)
            .sort((a, b) => PuppetForgeService.compareVersions(b, a));
            
        return safeVersions.length > 0 ? safeVersions[0] : null;
    }
    
    /**
     * Convert to the legacy interface format for backward compatibility
     */
    public toLegacyFormat(): LegacyForgeModule {
        return {
            name: this.name,
            slug: this.slug,
            owner: this.owner,
            current_release: this.current_release,
            releases: this.releases,
            downloads: this.downloads,
            feedback_score: this.feedback_score
        };
    }
    
    /**
     * String representation uses normalized name
     */
    public toString(): string {
        return this.normalizedName;
    }
    
    /**
     * JSON representation for debugging
     */
    public toJSON(): object {
        return {
            original: this.originalName,
            normalized: this.normalizedName,
            author: this.authorName,
            module: this.moduleName,
            slug: this.slug,
            latestVersion: this.getLatestVersion(),
            releaseCount: this.releases?.length ?? 0,
            downloads: this.downloads,
            variants: this.variants
        };
    }
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use ForgeModule class instead
 */
export interface LegacyForgeModule {
    name: string;
    slug: string;
    owner: {
        username: string;
        slug: string;
    };
    current_release?: {
        version: string;
        created_at: string;
        metadata: {
            dependencies?: Array<{
                name: string;
                version_requirement: string;
            }>;
        };
    };
    releases?: ForgeVersion[];
    downloads: number;
    feedback_score: number;
}

/**
 * Service for interacting with the Puppet Forge API
 */
export class PuppetForgeService {
    private static readonly BASE_URL = 'https://forgeapi.puppet.com';
    private static readonly API_VERSION = 'v3';

    // Two-level cache: module name -> (version -> version data)
    private static readonly moduleVersionCache: Map<string, Map<string, ForgeVersion>> = new Map();
    
    // Keep a single agent instance for reuse
    private static proxyAgent: HttpsProxyAgent<string> | null = null;

    private static getAxiosOptions(): AxiosRequestConfig {
        const options: AxiosRequestConfig = {
            timeout: 10000,
            headers: {
                'User-Agent': `VSCode-Puppetfile-DepGraph/${pkg.version}`,
                'Connection': 'close'  // Ensure connections are closed after requests
            }
        };

        const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
        if (proxyUrl && !this.proxyAgent) {
            this.proxyAgent = new HttpsProxyAgent(proxyUrl);
        }
        
        if (this.proxyAgent) {
            options.httpAgent = this.proxyAgent;
            options.httpsAgent = this.proxyAgent;
            options.proxy = false;
        }
        return options;
    }

    /**
     * Clear all cached Forge responses
     */
    public static clearCache(): void {
        this.moduleVersionCache.clear();
        ForgeModule.clearCache();
    }
    
    /**
     * Cleanup all HTTP agents to prevent hanging connections
     */
    public static cleanupAgents(): void {
        if (this.proxyAgent) {
            this.proxyAgent.destroy();
            this.proxyAgent = null;
        }
    }

    /**
     * Normalize module name for consistent cache keys
     * Uses centralized ModuleNameUtils for consistency across the codebase
     * @deprecated Use ModuleNameUtils.toCanonicalFormat() directly
     */
    private static normalizeCacheKey(moduleName: string): string {
        return ModuleNameUtils.toCanonicalFormat(moduleName);
    }

    /**
     * Check if a module has cached data
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns True if the module has cached data
     */
    public static hasModuleCached(moduleName: string): boolean {
        // Check both ForgeModule cache and version cache
        return ForgeModule.isCached(moduleName) || this.hasVersionsCached(moduleName);
    }
    
    /**
     * Check if a module has cached version data (legacy cache)
     * @param moduleName The full module name
     * @returns True if the module has cached version data
     */
    private static hasVersionsCached(moduleName: string): boolean {
        const normalizedKey = this.normalizeCacheKey(moduleName);
        const moduleCache = this.moduleVersionCache.get(normalizedKey);
        return moduleCache !== undefined && moduleCache.size > 0;
    }

    /**
     * Get module information from Puppet Forge
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with module information
     */
    public static async getModule(moduleName: string): Promise<ForgeModule | null> {
        try {
            // Check if already cached using ForgeModule's cache
            const cached = ForgeModule.getCached(moduleName);
            if (cached) {
                return cached;
            }
            
            // Get all releases to build module info
            const releases = await this.getModuleReleases(moduleName);
            if (releases.length === 0) {
                return null;
            }

            // The first release is the latest (API returns sorted by version desc)
            const latestRelease = releases[0];
            
            // Create ForgeModule using factory method (automatically caches)
            return ForgeModule.create(moduleName, {
                current_release: {
                    version: latestRelease.version,
                    created_at: latestRelease.created_at,
                    metadata: latestRelease.metadata
                },
                releases: releases,
                downloads: 0, // Not available from releases API
                feedback_score: 0 // Not available from releases API
            });
        } catch (error) {
            return null; // Return null for any error when fetching module
        }
    }

    /**
     * Get all releases for a module
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with array of releases
     */
    public static async getModuleReleases(moduleName: string): Promise<ForgeVersion[]> {
        // Check if we already have cached versions for this module using normalized key
        const normalizedKey = this.normalizeCacheKey(moduleName);
        const moduleCache = this.moduleVersionCache.get(normalizedKey);
        if (moduleCache && moduleCache.size > 0) {
            // Return all cached versions as an array, sorted by version descending
            return Array.from(moduleCache.values()).sort((a, b) => 
                this.compareVersions(b.version, a.version)
            );
        }

        try {
            // Use the releases API endpoint that accepts module parameter
            const response = await axios.get(
                `${this.BASE_URL}/${this.API_VERSION}/releases`,
                {
                    ...this.getAxiosOptions(),
                    params: {
                        module: ModuleNameUtils.toDashFormat(moduleName), // API expects puppetlabs-stdlib format
                        limit: 100,
                        sort_by: 'version',
                        order: 'desc'
                    }
                }
            );
            
            const releases: ForgeVersion[] = response.data.results ?? [];
            
            // Populate the two-level cache
            if (releases.length > 0) {
                const versionMap = new Map<string, ForgeVersion>();
                for (const release of releases) {
                    versionMap.set(release.version, release);
                }
                this.moduleVersionCache.set(normalizedKey, versionMap);
            }
            
            return releases;
        } catch (error) {
            if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
                // Try alternative module name formats before giving up
                const variants = ModuleNameUtils.getModuleNameVariants(moduleName);
                for (const variant of variants) {
                    try {
                        const response = await axios.get(
                            `${this.BASE_URL}/${this.API_VERSION}/releases`,
                            {
                                ...this.getAxiosOptions(),
                                params: {
                                    module: ModuleNameUtils.toDashFormat(variant),
                                    limit: 100,
                                    sort_by: 'version',
                                    order: 'desc'
                                }
                            }
                        );
                        
                        const releases: ForgeVersion[] = response.data.results ?? [];
                        if (releases.length > 0) {
                            // Cache under the normalized key for the original module name
                            const versionMap = new Map<string, ForgeVersion>();
                            for (const release of releases) {
                                versionMap.set(release.version, release);
                            }
                            this.moduleVersionCache.set(normalizedKey, versionMap);
                            return releases;
                        }
                    } catch (variantError) {
                        // Continue to next variant
                        continue;
                    }
                }
                return []; // Module not found or invalid module name
            }
            throw new Error(`Failed to fetch releases for ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get information for a specific release version
     * @param moduleName Module name
     * @param version Version to lookup
     */
    public static async getReleaseForVersion(moduleName: string, version: string): Promise<ForgeVersion | null> {
        // Check two-level cache first using normalized key
        const normalizedKey = this.normalizeCacheKey(moduleName);
        const moduleCache = this.moduleVersionCache.get(normalizedKey);
        if (moduleCache) {
            const cachedVersion = moduleCache.get(version);
            if (cachedVersion) {
                return cachedVersion;
            }
        }

        // Fetch all releases (this will populate the cache)
        const releases = await this.getModuleReleases(moduleName);
        
        // Now check the cache again (it should be populated)
        const updatedModuleCache = this.moduleVersionCache.get(normalizedKey);
        if (updatedModuleCache) {
            return updatedModuleCache.get(version) ?? null;
        }
        
        // Fallback: search in releases array
        return releases.find(r => r.version === version) ?? null;
    }

    /**
     * Get the latest version of a module
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with the latest version string
     */
    public static async getLatestVersion(moduleName: string): Promise<string | null> {
        try {
            const module = await this.getModule(moduleName);
            return module?.getLatestVersion() ?? null;
        } catch (error) {
            console.error(`Error fetching latest version for ${moduleName}:`, error);
            return null;
        }
    }

    /**
     * Check if a version is safe to update to (not a pre-release)
     * @param version The version string to check
     * @returns True if the version is considered safe
     */
    public static isSafeVersion(version: string): boolean {
        // Consider a version safe if it doesn't contain pre-release identifiers
        const preReleasePattern = /-(alpha|beta|rc|pre|dev|snapshot)/i;
        return !preReleasePattern.test(version);
    }

    /**
     * Get the latest safe version of a module (excludes pre-releases)
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with the latest safe version string
     */
    public static async getLatestSafeVersion(moduleName: string): Promise<string | null> {
        try {
            const module = await this.getModule(moduleName);
            return module?.getLatestSafeVersion() ?? null;
        } catch (error) {
            console.error(`Error fetching latest safe version for ${moduleName}:`, error);
            return null;
        }
    }

    /**
     * Compare two semantic versions
     * @param version1 First version to compare
     * @param version2 Second version to compare
     * @returns Negative if version1 < version2, 0 if equal, positive if version1 > version2
     */
    public static compareVersions(version1: string, version2: string): number {
        // Split version into main version and pre-release parts
        const parseVersion = (version: string) => {
            const [mainVersion, preRelease] = version.split('-', 2);
            const parts = mainVersion.split('.').map(part => {
                const num = parseInt(part, 10);
                return isNaN(num) ? 0 : num;
            });
            return { parts, preRelease: preRelease ?? '' };
        };

        const v1 = parseVersion(version1);
        const v2 = parseVersion(version2);
        
        // Compare main version parts
        const maxLength = Math.max(v1.parts.length, v2.parts.length);
        for (let i = 0; i < maxLength; i++) {
            const part1 = v1.parts[i] ?? 0;
            const part2 = v2.parts[i] ?? 0;
            
            if (part1 < part2) {
                return -1;
            }
            if (part1 > part2) {
                return 1;
            }
        }
        
        // Main versions are equal, compare pre-release
        // No pre-release is greater than any pre-release (1.0.0 > 1.0.0-beta)
        if (!v1.preRelease && v2.preRelease) {
            return 1;
        }
        if (v1.preRelease && !v2.preRelease) {
            return -1;
        }
        
        // Both have pre-release or both don't
        return v1.preRelease.localeCompare(v2.preRelease);
    }

    /**
     * Check if a module has an update available
     * @param moduleName The full module name
     * @param currentVersion The current version (optional)
     * @param safeOnly Whether to only consider safe versions
     * @returns Promise with update information
     */
    public static async checkForUpdate(
        moduleName: string, 
        currentVersion?: string, 
        safeOnly: boolean = false
    ): Promise<{ hasUpdate: boolean; latestVersion: string | null; currentVersion?: string }> {
        try {
            const latestVersion = safeOnly 
                ? await this.getLatestSafeVersion(moduleName)
                : await this.getLatestVersion(moduleName);

            if (!latestVersion) {
                return { hasUpdate: false, latestVersion: null, currentVersion };
            }

            if (!currentVersion) {
                return { hasUpdate: true, latestVersion, currentVersion };
            }

            const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;
            return { hasUpdate, latestVersion, currentVersion };
        } catch (error) {
            console.error(`Error checking for update for ${moduleName}:`, error);
            return { hasUpdate: false, latestVersion: null, currentVersion };
        }
    }

}
