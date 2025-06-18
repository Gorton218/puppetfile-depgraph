import * as vscode from 'vscode';
import { UpgradeDiffCodeLensProvider } from '../../src/services/upgradeDiffCodeLensProvider';
import { UpgradePlan, UpgradeCandidate } from '../../src/services/upgradePlannerService';
import { PuppetModule } from '../../src/puppetfileParser';

// Mock VS Code module
jest.mock('vscode', () => ({
    CodeLens: jest.fn().mockImplementation((range, command) => ({ range, command })),
    Range: jest.fn().mockImplementation((start, startChar, end, endChar) => ({ start, startChar, end, endChar })),
    EventEmitter: jest.fn().mockImplementation(() => ({
        fire: jest.fn(),
        event: jest.fn()
    })),
    Uri: {
        parse: jest.fn().mockReturnValue({
            scheme: 'puppetfile-diff'
        })
    }
}));

describe('UpgradeDiffCodeLensProvider', () => {
    let provider: UpgradeDiffCodeLensProvider;
    let mockDocument: any;
    let mockToken: any;
    let mockUpgradePlan: UpgradePlan;
    let mockUpgradeCandidate: UpgradeCandidate;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create provider instance
        provider = new UpgradeDiffCodeLensProvider();
        
        // Mock document
        mockDocument = {
            uri: {
                scheme: 'puppetfile-diff'
            },
            getText: jest.fn()
        };

        // Mock cancellation token
        mockToken = {
            isCancellationRequested: false
        };

        // Mock upgrade candidate
        const mockModule: PuppetModule = {
            name: 'apache',
            source: 'forge',
            version: '1.0.0',
            line: 1
        };

        mockUpgradeCandidate = {
            module: mockModule,
            currentVersion: '1.0.0',
            maxSafeVersion: '2.0.0',
            availableVersions: ['1.0.0', '1.5.0', '2.0.0'],
            isUpgradeable: true
        };

        // Mock upgrade plan
        mockUpgradePlan = {
            candidates: [mockUpgradeCandidate],
            totalUpgradeable: 1,
            totalModules: 1,
            totalGitModules: 0,
            hasConflicts: false,
            gitModules: []
        };

        // Reset static state
        UpgradeDiffCodeLensProvider.setUpgradePlan(null as any);
        UpgradeDiffCodeLensProvider.setInstance(undefined as any);
    });

    describe('provideCodeLenses', () => {
        test('should return empty array for non-puppetfile-diff documents', async () => {
            // Arrange
            mockDocument.uri.scheme = 'file';
            mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache\nmod "apache", "1.0.0"');

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when no upgrade plan is set', async () => {
            // Arrange
            mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache\nmod "apache", "1.0.0"');
            UpgradeDiffCodeLensProvider.setUpgradePlan(null as any);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should return empty array when upgrade plan has no upgradeable candidates', async () => {
            // Arrange
            const nonUpgradeableCandidate = {
                ...mockUpgradeCandidate,
                isUpgradeable: false
            };
            const planWithNoUpgrades = {
                ...mockUpgradePlan,
                candidates: [nonUpgradeableCandidate]
            };
            
            UpgradeDiffCodeLensProvider.setUpgradePlan(planWithNoUpgrades);
            mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache\nmod "apache", "1.0.0"');

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should create Apply and Skip CodeLenses for valid upgrade comments', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            const documentText = '# Some diff content\n# ↑ UPGRADE: apache\n+mod "apache", "2.0.0"\n-mod "apache", "1.0.0"';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(2);
            
            // Check Apply CodeLens
            const applyCodeLens = result[0];
            expect(applyCodeLens.command?.title).toBe('$(arrow-up) Apply');
            expect(applyCodeLens.command?.tooltip).toBe('Apply upgrade: apache 1.0.0 → 2.0.0');
            expect(applyCodeLens.command?.command).toBe('puppetfile-depgraph.applySingleUpgradeFromDiff');
            expect(applyCodeLens.command?.arguments).toEqual([{
                moduleName: 'apache',
                currentVersion: '1.0.0',
                newVersion: '2.0.0'
            }]);

            // Check Skip CodeLens
            const skipCodeLens = result[1];
            expect(skipCodeLens.command?.title).toBe('$(x) Skip');
            expect(skipCodeLens.command?.tooltip).toBe('Skip upgrade for apache');
            expect(skipCodeLens.command?.command).toBe('puppetfile-depgraph.skipSingleUpgradeFromDiff');
            expect(skipCodeLens.command?.arguments).toEqual([{
                moduleName: 'apache'
            }]);
        });

        test('should handle multiple upgrade comments', async () => {
            // Arrange
            const apacheModule: PuppetModule = { name: 'apache', source: 'forge', version: '1.0.0', line: 1 };
            const nginxModule: PuppetModule = { name: 'nginx', source: 'forge', version: '1.5.0', line: 2 };
            
            const apacheCandidate: UpgradeCandidate = {
                module: apacheModule,
                currentVersion: '1.0.0',
                maxSafeVersion: '2.0.0',
                availableVersions: ['1.0.0', '2.0.0'],
                isUpgradeable: true
            };
            
            const nginxCandidate: UpgradeCandidate = {
                module: nginxModule,
                currentVersion: '1.5.0',
                maxSafeVersion: '1.8.0',
                availableVersions: ['1.5.0', '1.8.0'],
                isUpgradeable: true
            };

            const multiUpgradePlan: UpgradePlan = {
                candidates: [apacheCandidate, nginxCandidate],
                totalUpgradeable: 2,
                totalModules: 2,
                totalGitModules: 0,
                hasConflicts: false,
                gitModules: []
            };

            UpgradeDiffCodeLensProvider.setUpgradePlan(multiUpgradePlan);
            const documentText = '# ↑ UPGRADE: apache\n+mod "apache", "2.0.0"\n# ↑ UPGRADE: nginx\n+mod "nginx", "1.8.0"';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(4); // 2 Apply + 2 Skip CodeLenses
            
            // Verify apache CodeLenses
            expect(result[0].command?.arguments?.[0].moduleName).toBe('apache');
            expect(result[1].command?.arguments?.[0].moduleName).toBe('apache');
            
            // Verify nginx CodeLenses
            expect(result[2].command?.arguments?.[0].moduleName).toBe('nginx');
            expect(result[3].command?.arguments?.[0].moduleName).toBe('nginx');
        });

        test('should ignore upgrade comments for modules not in upgrade plan', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            const documentText = '# ↑ UPGRADE: nonexistent\n+mod "nonexistent", "2.0.0"';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should ignore malformed upgrade comments', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            const documentText = '# ↑ UPGRADE:\n# ↑ UPGRADE\n# UPGRADE: apache\n# ↑ UPGRADE: apache extra text';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(2); // Only the last valid comment should generate CodeLenses
        });

        test('should handle documents with no upgrade comments', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            const documentText = 'mod "apache", "1.0.0"\nmod "nginx", "1.5.0"';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toEqual([]);
        });

        test('should create correct ranges for Apply and Skip CodeLenses', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            const documentText = '# ↑ UPGRADE: apache';
            mockDocument.getText.mockReturnValue(documentText);

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert
            expect(result).toHaveLength(2);
            
            // Verify ranges are created with correct parameters
            expect(vscode.Range).toHaveBeenCalledWith(0, 0, 0, Math.floor(documentText.length / 2));
            expect(vscode.Range).toHaveBeenCalledWith(0, Math.floor(documentText.length / 2), 0, documentText.length);
        });
    });

    describe('refresh', () => {
        test('should fire onDidChangeCodeLenses event', () => {
            // Arrange
            const mockEventEmitter = new (vscode.EventEmitter as any)();
            provider['_onDidChangeCodeLenses'] = mockEventEmitter;

            // Act
            provider.refresh();

            // Assert
            expect(mockEventEmitter.fire).toHaveBeenCalled();
        });
    });

    describe('static methods', () => {
        describe('setUpgradePlan', () => {
            test('should set the current upgrade plan', async () => {
                // Arrange
                mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache');
                
                // Act
                UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);

                // Assert - Verify plan is set by checking provideCodeLenses behavior
                await provider.provideCodeLenses(mockDocument, mockToken);
                expect(mockDocument.getText).toHaveBeenCalled();
            });

            test('should allow setting null upgrade plan', async () => {
                // Arrange
                mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache');
                
                // Act
                UpgradeDiffCodeLensProvider.setUpgradePlan(null as any);

                // Assert - Should not throw and return empty array
                const result = await provider.provideCodeLenses(mockDocument, mockToken);
                expect(result).toEqual([]);
            });
        });

        describe('getInstance and setInstance', () => {
            test('should set and get instance correctly', () => {
                // Act
                UpgradeDiffCodeLensProvider.setInstance(provider);
                const instance = UpgradeDiffCodeLensProvider.getInstance();

                // Assert
                expect(instance).toBe(provider);
            });

            test('should return undefined when no instance is set', () => {
                // Act
                const instance = UpgradeDiffCodeLensProvider.getInstance();

                // Assert
                expect(instance).toBeUndefined();
            });
        });
    });

    describe('event handling', () => {
        test('should have onDidChangeCodeLenses event property', () => {
            // Assert
            expect(provider.onDidChangeCodeLenses).toBeDefined();
            expect(typeof provider.onDidChangeCodeLenses).toBe('function');
        });
    });

    describe('URI scheme filtering', () => {
        test('should only provide CodeLenses for puppetfile-diff scheme', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache');

            const testSchemes = [
                'file',
                'untitled',
                'git',
                'puppetfile',
                'diff'
            ];

            for (const scheme of testSchemes) {
                mockDocument.uri.scheme = scheme;

                // Act
                const result = await provider.provideCodeLenses(mockDocument, mockToken);

                // Assert
                expect(result).toEqual([]);
            }

            // Test valid scheme
            mockDocument.uri.scheme = 'puppetfile-diff';
            const validResult = await provider.provideCodeLenses(mockDocument, mockToken);
            expect(validResult).toHaveLength(2);
        });

        test('should reject schemes that are not exactly puppetfile-diff', async () => {
            // Arrange
            UpgradeDiffCodeLensProvider.setUpgradePlan(mockUpgradePlan);
            mockDocument.uri.scheme = 'custom-puppetfile-diff-view';
            mockDocument.getText.mockReturnValue('# ↑ UPGRADE: apache');

            // Act
            const result = await provider.provideCodeLenses(mockDocument, mockToken);

            // Assert - Should return empty array for non-exact match
            expect(result).toEqual([]);
        });
    });
});