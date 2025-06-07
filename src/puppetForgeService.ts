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

    private static readonly EXT_VERSION: string = pkg.version;
    private static moduleCache: Map<string, ForgeModule | null> = new Map();
    private static releaseCache: Map<string, ForgeVersion[]> = new Map();

    private static getAxiosOptions(): AxiosRequestConfig {
        const options: AxiosRequestConfig = {
            timeout: 10000,
            headers: {
                'User-Agent': 'VSCode-Puppetfile-DepGraph/1.0.0'
            }
        };

        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl) {
            const agent = new HttpsProxyAgent(proxyUrl);
            options.httpAgent = agent;
            options.httpsAgent = agent;
            options.proxy = false;
        }
        return options;
    }

    private static cacheKey(name: string): string {
        return `${name}@${this.EXT_VERSION}`;
    }

    /**
     * Clear all cached Forge responses
     */
    public static clearCache(): void {
        this.moduleCache.clear();
        this.releaseCache.clear();
    }

    /**
     * Get module information from Puppet Forge
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with module information
     */
    public static async getModule(moduleName: string): Promise<ForgeModule | null> {
        const key = this.cacheKey(moduleName);
        if (this.moduleCache.has(key)) {
            return this.moduleCache.get(key) ?? null;
        }

        try {
            const response = await axios.get(
                `${this.BASE_URL}/${this.API_VERSION}/modules/${moduleName}`,
                this.getAxiosOptions()
            );
            this.moduleCache.set(key, response.data);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                this.moduleCache.set(key, null);
                return null; // Module not found
            }
            throw new Error(`Failed to fetch module ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get all releases for a module
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with array of releases
     */
    public static async getModuleReleases(moduleName: string): Promise<ForgeVersion[]> {
        const key = this.cacheKey(moduleName);
        if (this.releaseCache.has(key)) {
            return this.releaseCache.get(key) ?? [];
        }

        try {
            const response = await axios.get(
                `${this.BASE_URL}/${this.API_VERSION}/modules/${moduleName}/releases`,
                {
                    ...this.getAxiosOptions(),
                    params: {
                        limit: 100,
                        sort_by: 'version',
                        order: 'desc'
                    }
                }
            );
            const result = response.data.results || [];
            this.releaseCache.set(key, result);
            return result;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                this.releaseCache.set(key, []);
                return []; // Module not found
            }
            throw new Error(`Failed to fetch releases for ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get the latest version of a module
     * @param moduleName The full module name (e.g., "puppetlabs/stdlib")
     * @returns Promise with the latest version string
     */
    public static async getLatestVersion(moduleName: string): Promise<string | null> {
        try {
            const module = await this.getModule(moduleName);
            return module?.current_release?.version || null;
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
        const parts1 = version1.split('.').map(part => parseInt(part.split('-')[0], 10));
        const parts2 = version2.split('.').map(part => parseInt(part.split('-')[0], 10));
        
        const maxLength = Math.max(parts1.length, parts2.length);
          for (let i = 0; i < maxLength; i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 < part2) {
                return -1;
            }
            if (part1 > part2) {
                return 1;
            }
        }
        
        return 0;
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
