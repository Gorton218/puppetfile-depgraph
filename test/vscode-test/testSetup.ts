import * as sinon from 'sinon';
import { PuppetForgeService } from '../../../src/services/puppetForgeService';
import { MockPuppetForgeService } from '../../unit/mocks/puppetForgeServiceMock';

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
    }
}