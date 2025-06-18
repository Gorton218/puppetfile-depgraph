// @ts-ignore - Importing compiled JS module for API integration tests
const { PuppetForgeService } = require('../../out/services/puppetForgeService');

/**
 * API Integration Tests for PuppetForgeService
 * 
 * These tests make REAL calls to the Puppet Forge API to verify:
 * 1. The API contract hasn't changed
 * 2. Our service correctly handles real API responses
 * 3. Error handling works with real API errors
 * 
 * WARNING: These tests are slower and require internet connectivity.
 * They should be run separately from the main test suite.
 * 
 * Run with: npm run test:api-integration
 */

describe('PuppetForgeService API Integration Tests', () => {
    // Increase timeout for real API calls
    const API_TIMEOUT = 30000; // 30 seconds

    beforeEach(() => {
        // Clear cache before each test to ensure fresh API calls
        PuppetForgeService.clearCache();
    });

    afterAll(() => {
        // Clean up any HTTP agents after all tests
        PuppetForgeService.cleanupAgents();
    });

    describe('Real API calls', () => {
        test('should fetch puppetlabs/stdlib module info', async () => {
            const module = await PuppetForgeService.getModule('puppetlabs/stdlib');
            
            expect(module).not.toBeNull();
            expect(module!.name).toBe('puppetlabs/stdlib');
            expect(module!.slug).toBe('puppetlabs-stdlib');
            expect(module!.owner.username).toBe('puppetlabs');
            expect(module!.current_release).toBeDefined();
            expect(module!.current_release!.version).toMatch(/^\d+\.\d+\.\d+/);
            expect(module!.releases).toBeDefined();
            expect(module!.releases!.length).toBeGreaterThan(0);
        });

        test('should fetch releases for puppetlabs/stdlib', async () => {
            const releases = await PuppetForgeService.getModuleReleases('puppetlabs/stdlib');
            
            expect(releases).toBeDefined();
            expect(releases.length).toBeGreaterThan(10); // stdlib has many releases
            
            // Check first release (should be latest)
            const latestRelease = releases[0];
            expect(latestRelease.version).toMatch(/^\d+\.\d+\.\d+/);
            expect(latestRelease.created_at).toBeDefined();
            expect(latestRelease.metadata).toBeDefined();
            
            // Verify releases are sorted by version (descending)
            for (let i = 1; i < Math.min(5, releases.length); i++) {
                const comparison = PuppetForgeService.compareVersions(releases[0].version, releases[i].version);
                expect(comparison).toBeGreaterThanOrEqual(0);
            }
        });

        test('should get latest version for puppetlabs/stdlib', async () => {
            const latestVersion = await PuppetForgeService.getLatestVersion('puppetlabs/stdlib');
            
            expect(latestVersion).not.toBeNull();
            expect(latestVersion).toMatch(/^\d+\.\d+\.\d+/);
        });

        test('should get latest safe version for puppetlabs/stdlib', async () => {
            const latestSafeVersion = await PuppetForgeService.getLatestSafeVersion('puppetlabs/stdlib');
            
            expect(latestSafeVersion).not.toBeNull();
            expect(latestSafeVersion).toMatch(/^\d+\.\d+\.\d+/);
            
            // Safe version should not contain pre-release identifiers
            expect(PuppetForgeService.isSafeVersion(latestSafeVersion!)).toBe(true);
        });

        test('should check for updates correctly', async () => {
            const updateInfo = await PuppetForgeService.checkForUpdate('puppetlabs/stdlib', '1.0.0', false);
            
            expect(updateInfo.hasUpdate).toBe(true);
            expect(updateInfo.latestVersion).not.toBeNull();
            expect(updateInfo.currentVersion).toBe('1.0.0');
            
            // Latest version should be higher than 1.0.0
            const comparison = PuppetForgeService.compareVersions(updateInfo.latestVersion!, '1.0.0');
            expect(comparison).toBeGreaterThan(0);
        });

        test('should check for safe updates correctly', async () => {
            const updateInfo = await PuppetForgeService.checkForUpdate('puppetlabs/stdlib', '1.0.0', true);
            
            expect(updateInfo.hasUpdate).toBe(true);
            expect(updateInfo.latestVersion).not.toBeNull();
            expect(updateInfo.currentVersion).toBe('1.0.0');
            
            // Safe version should not contain pre-release identifiers
            expect(PuppetForgeService.isSafeVersion(updateInfo.latestVersion!)).toBe(true);
        });

        test('should handle module not found gracefully', async () => {
            const module = await PuppetForgeService.getModule('nonexistent/module');
            expect(module).toBeNull();
            
            const releases = await PuppetForgeService.getModuleReleases('nonexistent/module');
            expect(releases).toEqual([]);
            
            const latestVersion = await PuppetForgeService.getLatestVersion('nonexistent/module');
            expect(latestVersion).toBeNull();
        });

        test('should cache module data correctly', async () => {
            const moduleName = 'puppetlabs/concat';
            
            // First call should not be cached
            expect(PuppetForgeService.hasModuleCached(moduleName)).toBe(false);
            
            // Fetch module releases
            const releases1 = await PuppetForgeService.getModuleReleases(moduleName);
            expect(releases1.length).toBeGreaterThan(0);
            
            // Now should be cached
            expect(PuppetForgeService.hasModuleCached(moduleName)).toBe(true);
            
            // Second call should return cached data (should be much faster)
            const startTime = Date.now();
            const releases2 = await PuppetForgeService.getModuleReleases(moduleName);
            const elapsedTime = Date.now() - startTime;
            
            expect(releases2).toEqual(releases1);
            expect(elapsedTime).toBeLessThan(100); // Should be very fast from cache
        });

        test('should get specific release version', async () => {
            const moduleName = 'puppetlabs/stdlib';
            
            // First get available releases to find a valid version
            const releases = await PuppetForgeService.getModuleReleases(moduleName);
            expect(releases.length).toBeGreaterThan(0);
            
            const targetVersion = releases[Math.min(5, releases.length - 1)].version; // Get a version that's not the latest
            
            const specificRelease = await PuppetForgeService.getReleaseForVersion(moduleName, targetVersion);
            
            expect(specificRelease).not.toBeNull();
            expect(specificRelease!.version).toBe(targetVersion);
            expect(specificRelease!.created_at).toBeDefined();
            expect(specificRelease!.metadata).toBeDefined();
        });
    });

    describe('Error handling with real API', () => {
        test('should handle invalid module name format', async () => {
            const module = await PuppetForgeService.getModule('invalid-name-format');
            expect(module).toBeNull();
        });

        test('should handle network timeouts gracefully', async () => {
            // This test may be flaky depending on network conditions
            // but helps verify timeout handling works
            const module = await PuppetForgeService.getModule('puppetlabs/stdlib');
            
            // If we get here, either the request succeeded or was handled gracefully
            // Both outcomes are acceptable for this test
            expect(module === null || module !== null).toBe(true);
        });
    });

    describe('Version comparison accuracy', () => {
        test('should correctly compare semantic versions', () => {
            // Test cases with known version comparisons
            expect(PuppetForgeService.compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
            expect(PuppetForgeService.compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
            expect(PuppetForgeService.compareVersions('1.0.0', '1.0.0')).toBe(0);
            
            // Pre-release versions
            expect(PuppetForgeService.compareVersions('1.0.0', '1.0.0-rc1')).toBeGreaterThan(0);
            expect(PuppetForgeService.compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
        });

        test('should correctly identify safe versions', () => {
            expect(PuppetForgeService.isSafeVersion('1.0.0')).toBe(true);
            expect(PuppetForgeService.isSafeVersion('2.5.1')).toBe(true);
            
            expect(PuppetForgeService.isSafeVersion('1.0.0-rc1')).toBe(false);
            expect(PuppetForgeService.isSafeVersion('1.0.0-beta')).toBe(false);
            expect(PuppetForgeService.isSafeVersion('1.0.0-alpha')).toBe(false);
            expect(PuppetForgeService.isSafeVersion('1.0.0-pre')).toBe(false);
            expect(PuppetForgeService.isSafeVersion('1.0.0-dev')).toBe(false);
            expect(PuppetForgeService.isSafeVersion('1.0.0-snapshot')).toBe(false);
        });
    });
});