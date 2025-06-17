import axios, { AxiosRequestConfig } from 'axios';
import pkg from '../package.json';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
 * Represents a module from Puppet Forge
 */
export interface ForgeModule {
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
     * Check if a module has cached data
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns True if the module has cached data
     */
    public static hasModuleCached(moduleName: string): boolean {
        const moduleCache = this.moduleVersionCache.get(moduleName);
        return moduleCache !== undefined && moduleCache.size > 0;
    }

    /**
     * Get module information from Puppet Forge
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with module information
     */
    public static async getModule(moduleName: string): Promise<ForgeModule | null> {
        try {
            // Get all releases to build module info
            const releases = await this.getModuleReleases(moduleName);
            if (releases.length === 0) {
                return null;
            }

            // The first release is the latest (API returns sorted by version desc)
            const latestRelease = releases[0];
            
            // Construct a ForgeModule object from release data
            // Note: This is a simplified version - some fields may be missing
            
            // Validate moduleName format
            if (!moduleName.includes('/')) {
                throw new Error(`Invalid moduleName format: "${moduleName}". Expected "owner/module".`);
            }
            
            const moduleSlug = moduleName.replace('/', '-');
            const owner = moduleName.split('/')[0];
            
            return {
                name: moduleName,
                slug: moduleSlug,
                owner: {
                    username: owner,
                    slug: owner
                },
                current_release: {
                    version: latestRelease.version,
                    created_at: latestRelease.created_at,
                    metadata: latestRelease.metadata
                },
                releases: releases,
                downloads: 0, // Not available from releases API
                feedback_score: 0 // Not available from releases API
            };
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
        // Check if we already have cached versions for this module
        const moduleCache = this.moduleVersionCache.get(moduleName);
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
                        module: moduleName.replace('/', '-'), // API expects puppetlabs-stdlib format
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
                this.moduleVersionCache.set(moduleName, versionMap);
            }
            
            return releases;
        } catch (error) {
            if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
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
        // Check two-level cache first
        const moduleCache = this.moduleVersionCache.get(moduleName);
        if (moduleCache) {
            const cachedVersion = moduleCache.get(version);
            if (cachedVersion) {
                return cachedVersion;
            }
        }

        // Fetch all releases (this will populate the cache)
        const releases = await this.getModuleReleases(moduleName);
        
        // Now check the cache again (it should be populated)
        const updatedModuleCache = this.moduleVersionCache.get(moduleName);
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
            return module?.current_release?.version ?? null;
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
            const releases = await this.getModuleReleases(moduleName);
            const safeReleases = releases.filter(release => this.isSafeVersion(release.version));
            return safeReleases.length > 0 ? safeReleases[0].version : null;
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
            return { parts, preRelease: preRelease || '' };
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
