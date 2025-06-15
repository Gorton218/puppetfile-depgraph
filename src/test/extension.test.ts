// Unit tests for extension.ts - Uses Jest syntax
import { deactivate } from '../extension';
import { PuppetForgeService } from '../puppetForgeService';

// Mock the PuppetForgeService
jest.mock('../puppetForgeService');

describe('Extension', () => {
    let mockCleanupAgents: jest.SpyInstance;

    beforeEach(() => {
        mockCleanupAgents = jest.spyOn(PuppetForgeService, 'cleanupAgents').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('deactivate', () => {
        test('should call PuppetForgeService.cleanupAgents when deactivated', () => {
            // Act
            deactivate();

            // Assert
            expect(mockCleanupAgents).toHaveBeenCalledTimes(1);
        });

        test('should not throw when PuppetForgeService.cleanupAgents is called', () => {
            // Act & Assert
            expect(() => {
                deactivate();
            }).not.toThrow();
        });
    });
});