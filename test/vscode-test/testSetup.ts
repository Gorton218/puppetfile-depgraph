import * as sinon from 'sinon';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { MockPuppetForgeService } from '../unit/mocks/puppetForgeServiceMock';
import { GitMetadataService, GitModuleMetadata } from '../../src/services/gitMetadataService';

/**
 * Sets up mocks for integration tests to avoid real API calls
 */
export class TestSetup {
    private static stubs: sinon.SinonStub[] = [];

    /**
     * Mock the PuppetForgeService to use test data instead of real API calls
     */
    public static mockPuppetForgeService(): void {
        // Clear any existing stubs
        this.restore();

        // Stub all static methods of PuppetForgeService
        this.stubs.push(sinon.stub(PuppetForgeService, 'clearCache').callsFake(() => MockPuppetForgeService.clearCache()));
        this.stubs.push(sinon.stub(PuppetForgeService, 'cleanupAgents').callsFake(() => MockPuppetForgeService.cleanupAgents()));
        this.stubs.push(sinon.stub(PuppetForgeService, 'hasModuleCached').callsFake((moduleName: string) => MockPuppetForgeService.hasModuleCached(moduleName)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'getModule').callsFake((moduleName: string) => MockPuppetForgeService.getModule(moduleName)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'getModuleReleases').callsFake((moduleName: string) => MockPuppetForgeService.getModuleReleases(moduleName)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'getReleaseForVersion').callsFake((moduleName: string, version: string) => MockPuppetForgeService.getReleaseForVersion(moduleName, version)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'getLatestVersion').callsFake((moduleName: string) => MockPuppetForgeService.getLatestVersion(moduleName)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'getLatestSafeVersion').callsFake((moduleName: string) => MockPuppetForgeService.getLatestSafeVersion(moduleName)));
        this.stubs.push(sinon.stub(PuppetForgeService, 'checkForUpdate').callsFake((moduleName: string, currentVersion?: string, safeOnly: boolean = false) => MockPuppetForgeService.checkForUpdate(moduleName, currentVersion, safeOnly)));
        
        // Note: We don't stub isSafeVersion and compareVersions as they are pure functions without side effects
    }

    /**
     * Mock the GitMetadataService to avoid real API calls
     */
    public static mockGitMetadataService(): void {
        // Stub GitMetadataService methods to return mock data
        this.stubs.push(sinon.stub(GitMetadataService, 'getGitModuleMetadata').callsFake(async (gitUrl: string, ref?: string): Promise<GitModuleMetadata | null> => {
            // Return mock metadata for known test modules
            if (gitUrl.includes('internal-module') || gitUrl.includes('custom-module') || gitUrl.includes('another-module')) {
                return {
                    name: 'company-internal',
                    version: ref?.replace('v', '') || '1.0.0',
                    author: 'Company',
                    summary: 'Internal module',
                    license: 'Apache-2.0',
                    source: gitUrl,
                    dependencies: []
                };
            }
            
            // For unknown modules, return minimal metadata
            return {
                name: 'unknown-module',
                version: '0.0.1',
                author: 'Unknown',
                summary: 'Unknown module',
                license: 'Unknown',
                source: gitUrl,
                dependencies: []
            };
        }));
        
        // Also stub the fallback method that might be called
        this.stubs.push(sinon.stub(GitMetadataService, 'getModuleMetadataWithFallback').callsFake(async (gitUrl: string, ref?: string): Promise<GitModuleMetadata | null> => {
            // Use the same logic as getGitModuleMetadata
            return GitMetadataService.getGitModuleMetadata(gitUrl, ref);
        }));
        
        this.stubs.push(sinon.stub(GitMetadataService, 'clearCache').callsFake(() => {
            // Mock cache clear - no-op
        }));
    }

    /**
     * Restore all stubs
     */
    public static restore(): void {
        this.stubs.forEach(stub => stub.restore());
        this.stubs = [];
    }

    /**
     * Setup all mocks for integration tests
     */
    public static setupAll(): void {
        this.mockPuppetForgeService();
        this.mockGitMetadataService();
    }
}