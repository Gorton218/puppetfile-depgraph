/**
 * Utility functions for version handling
 */

/**
 * Returns the version string or 'unversioned' if null/undefined
 * @param version The version string or undefined
 * @returns The version string or 'unversioned'
 */
export function getVersionDisplay(version: string | undefined | null): string {
    return version ?? 'unversioned';
}

/**
 * Formats a version transition for display
 * @param currentVersion The current version (may be undefined)
 * @param newVersion The new version
 * @returns Formatted transition string like "1.0.0 → 2.0.0" or "unversioned → 2.0.0"
 */
export function formatVersionTransition(currentVersion: string | undefined | null, newVersion: string): string {
    return `${getVersionDisplay(currentVersion)} → ${newVersion}`;
}

/**
 * Creates a cache key for git references
 * @param gitUrl The git URL
 * @param ref The git reference (branch, tag, or commit)
 * @returns Cache key string
 */
export function createGitCacheKey(gitUrl: string, ref?: string): string {
    return `${gitUrl}:${ref ?? 'default'}`;
}

/**
 * Gets a numeric value from an array index with fallback to 0
 * @param arr The array
 * @param index The index to access
 * @returns The value at index or 0 if undefined
 */
export function getArrayValueOrZero(arr: (string | number | undefined)[], index: number): number {
    const value = arr[index];
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        return parseInt(value, 10) || 0;
    }
    return 0;
}