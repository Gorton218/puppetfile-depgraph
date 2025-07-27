import { PuppetfileUpdateService, UpdateResult } from '../../src/services/puppetfileUpdateService';
import { PuppetfileParser } from '../../src/puppetfileParser';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import * as vscode from 'vscode';

jest.mock('../../src/puppetfileParser');
jest.mock('../../src/services/puppetForgeService');
jest.mock('vscode', () => ({
    window: {
        activeTextEditor: null
    },
    workspace: {
        applyEdit: jest.fn()
    },
    WorkspaceEdit: jest.fn().mockImplementation(() => ({
        replace: jest.fn()
    })),
    Range: jest.fn(),
    Position: jest.fn()
}));

interface TestCase {
    description: string;
    input: string;
    newVersion: string;
    expected: string;
}

describe('PuppetfileUpdateService Test Suite', () => {
    const createTestCase = (description: string, input: string, newVersion: string, expected: string): TestCase => ({
        description,
        input,
        newVersion,
        expected
    });

    const runTestCases = (testCases: TestCase[]) => {
        testCases.forEach(testCase => {
            test(`updateVersionInLine should ${testCase.description}`, () => {
                const result = PuppetfileUpdateService['updateVersionInLine'](testCase.input, testCase.newVersion);
                expect(result).toBe(testCase.expected);
            });
        });
    };

    const updateVersionTestCases: TestCase[] = [
        createTestCase(
            'update forge module version',
            "mod 'puppetlabs-stdlib', '9.4.1'",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'"
        ),
        createTestCase(
            'update forge module version with inline comment',
            "mod 'puppetlabs-mongodb', '0.17.0' # Example of commit",
            '0.18.0',
            "mod 'puppetlabs-mongodb', '0.18.0' # Example of commit"
        ),
        createTestCase(
            'add version to forge module without version',
            "mod 'puppetlabs-apache'",
            '2.11.0',
            "mod 'puppetlabs-apache', '2.11.0'"
        ),
        createTestCase(
            'add version to forge module without version but with comment',
            "mod 'puppetlabs-mysql' # No version specified",
            '16.2.0',
            "mod 'puppetlabs-mysql', '16.2.0' # No version specified"
        ),
        createTestCase(
            'update git module tag',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'",
            'v1.1.0',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0'"
        ),
        createTestCase(
            'update git module tag with inline comment',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0' # Stable release",
            'v1.1.0',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0' # Stable release"
        ),
        createTestCase(
            'update git module ref',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main'",
            'develop',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop'"
        ),
        createTestCase(
            'update git module ref with inline comment',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main' # Main branch",
            'develop',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop' # Main branch"
        )
    ];

    const edgeCaseTestCases: TestCase[] = [
        createTestCase(
            'handle double quotes',
            'mod "puppetlabs-stdlib", "9.4.1" # With double quotes',
            '9.5.0',
            'mod "puppetlabs-stdlib", \'9.5.0\' # With double quotes'
        ),
        createTestCase(
            'handle mixed quotes',
            "mod \"puppetlabs-stdlib\", '9.4.1' # Mixed quotes",
            '9.5.0',
            "mod \"puppetlabs-stdlib\", '9.5.0' # Mixed quotes"
        ),
        createTestCase(
            'preserve whitespace around comments',
            "mod 'puppetlabs-stdlib', '9.4.1'    # Lots of spaces",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'    # Lots of spaces"
        ),
        createTestCase(
            'handle comment without spaces',
            "mod 'puppetlabs-stdlib', '9.4.1'#NoSpaces",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'#NoSpaces"
        ),
        createTestCase(
            'not modify non-module lines',
            "forge 'https://forgeapi.puppet.com' # Comment",
            '9.5.0',
            "forge 'https://forgeapi.puppet.com' # Comment"
        ),
        createTestCase(
            'not modify comment-only lines',
            "# This is just a comment",
            '9.5.0',
            "# This is just a comment"
        )
    ];

    runTestCases(updateVersionTestCases);
    runTestCases(edgeCaseTestCases);

    describe('Service Methods', () => {
        let mockEditor: any;
        let mockDocument: any;
        let mockParsedResult: any;
        let mockUpdateInfo: any;

        beforeEach(() => {
            jest.clearAllMocks();
            
            mockDocument = {
                lineCount: 5,
                lineAt: jest.fn().mockImplementation((index) => ({
                    text: `mod 'test-module-${index}', '1.0.0'`,
                    range: { start: { line: index, character: 0 }, end: { line: index, character: 30 } }
                })),
                uri: 'test-uri'
            };

            mockEditor = {
                document: mockDocument,
                edit: jest.fn().mockImplementation((callback) => {
                    const edit = { replace: jest.fn() };
                    callback(edit);
                    return Promise.resolve(true);
                })
            };

            mockParsedResult = {
                modules: [
                    { name: 'test-module', version: '1.0.0', source: 'forge', line: 1 },
                    { name: 'another-module', version: '2.0.0', source: 'forge', line: 2 }
                ],
                errors: []
            };

            mockUpdateInfo = {
                hasUpdate: true,
                latestVersion: '1.1.0'
            };

            (vscode.window as any).activeTextEditor = mockEditor;
            (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue(mockParsedResult);
            (PuppetForgeService.checkForUpdate as jest.Mock).mockResolvedValue(mockUpdateInfo);
        });

        describe('updateAllToSafeVersions', () => {
            test('should update all modules to safe versions', async () => {
                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(PuppetfileParser.parseActiveEditor).toHaveBeenCalled();
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledTimes(2);
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledWith('test-module', '1.0.0', true);
                expect(results).toHaveLength(2);
                expect(results[0].success).toBe(true);
                expect(results[0].newVersion).toBe('1.1.0');
            });

            test('should throw error when no active editor', async () => {
                (vscode.window as any).activeTextEditor = null;
                
                await expect(PuppetfileUpdateService.updateAllToSafeVersions())
                    .rejects.toThrow('No active editor found');
            });

            test('should throw error on parsing errors', async () => {
                (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                    modules: [],
                    errors: ['Parse error']
                });
                
                await expect(PuppetfileUpdateService.updateAllToSafeVersions())
                    .rejects.toThrow('Puppetfile parsing errors: Parse error');
            });

            test('should handle forge service errors', async () => {
                (PuppetForgeService.checkForUpdate as jest.Mock).mockRejectedValue(new Error('Network error'));
                
                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(results[0].success).toBe(false);
                expect(results[0].error).toBe('Network error');
            });

            test('should handle missing latest version', async () => {
                (PuppetForgeService.checkForUpdate as jest.Mock).mockResolvedValue({
                    hasUpdate: false,
                    latestVersion: null
                });
                
                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(results[0].success).toBe(false);
                expect(results[0].error).toBe('Could not fetch latest version from Forge');
            });

            test('should handle no updates available', async () => {
                (PuppetForgeService.checkForUpdate as jest.Mock).mockResolvedValue({
                    hasUpdate: false,
                    latestVersion: '1.0.0'
                });
                
                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(results[0].success).toBe(true);
                expect(results[0].newVersion).toBe('1.0.0');
            });
        });

        describe('updateAllToLatestVersions', () => {
            test('should update all modules to latest versions', async () => {
                const results = await PuppetfileUpdateService.updateAllToLatestVersions();
                
                expect(PuppetfileParser.parseActiveEditor).toHaveBeenCalled();
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledWith('test-module', '1.0.0', false);
                expect(results).toHaveLength(2);
                expect(results[0].success).toBe(true);
            });

            test('should throw error when no active editor', async () => {
                (vscode.window as any).activeTextEditor = null;
                
                await expect(PuppetfileUpdateService.updateAllToLatestVersions())
                    .rejects.toThrow('No active editor found');
            });
        });

        describe('updateModuleVersionAtLine', () => {
            test('should update module version at specific line', async () => {
                await PuppetfileUpdateService.updateModuleVersionAtLine(1, '2.0.0');
                
                expect(mockEditor.edit).toHaveBeenCalled();
            });

            test('should handle no active editor', async () => {
                (vscode.window as any).activeTextEditor = null;
                
                await PuppetfileUpdateService.updateModuleVersionAtLine(1, '2.0.0');
                
                // Should not throw, just return early
                expect(mockEditor.edit).not.toHaveBeenCalled();
            });

            test('should handle invalid line numbers', async () => {
                await PuppetfileUpdateService.updateModuleVersionAtLine(-1, '2.0.0');
                await PuppetfileUpdateService.updateModuleVersionAtLine(100, '2.0.0');
                
                expect(mockEditor.edit).not.toHaveBeenCalled();
            });

            test('should handle no change needed', async () => {
                mockDocument.lineAt.mockReturnValue({
                    text: "mod 'test', '2.0.0'",
                    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 20 } }
                });
                
                await PuppetfileUpdateService.updateModuleVersionAtLine(1, '2.0.0');
                
                // Should not call edit since no change is needed (version is same)
                expect(mockEditor.edit).not.toHaveBeenCalled();
            });
        });

        describe('generateUpdateSummary', () => {
            test('should generate summary for successful updates', () => {
                const results: UpdateResult[] = [
                    { moduleName: 'module1', currentVersion: '1.0.0', newVersion: '1.1.0', success: true, line: 1 },
                    { moduleName: 'module2', currentVersion: '2.0.0', newVersion: '2.0.0', success: true, line: 2 },
                    { moduleName: 'module3', currentVersion: '3.0.0', newVersion: undefined, success: false, error: 'Network error', line: 3 }
                ];
                
                const summary = PuppetfileUpdateService.generateUpdateSummary(results);
                
                expect(summary).toContain('Updated (1):');
                expect(summary).toContain('module1: 1.0.0 → 1.1.0');
                expect(summary).toContain('Already up-to-date (1):');
                expect(summary).toContain('module2: 2.0.0');
                expect(summary).toContain('Failed (1):');
                expect(summary).toContain('module3: Network error');
            });

            test('should handle empty results', () => {
                const summary = PuppetfileUpdateService.generateUpdateSummary([]);
                
                expect(summary).toBe('Update Summary:\n\n');
            });

            test('should handle modules without current version', () => {
                const results: UpdateResult[] = [
                    { moduleName: 'module1', currentVersion: undefined, newVersion: '1.1.0', success: true, line: 1 }
                ];
                
                const summary = PuppetfileUpdateService.generateUpdateSummary(results);
                
                expect(summary).toContain('Added version 1.1.0');
            });
        });

        describe('checkForAvailableUpdates', () => {
            test('should check for updates without applying them', async () => {
                const results = await PuppetfileUpdateService.checkForAvailableUpdates(true);
                
                expect(PuppetfileParser.parseActiveEditor).toHaveBeenCalled();
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledWith('test-module', '1.0.0', true);
                expect(results).toHaveLength(2);
                expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
            });

            test('should default to safe updates', async () => {
                await PuppetfileUpdateService.checkForAvailableUpdates();
                
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledWith('test-module', '1.0.0', true);
            });

            test('should check for latest updates when specified', async () => {
                await PuppetfileUpdateService.checkForAvailableUpdates(false);
                
                expect(PuppetForgeService.checkForUpdate).toHaveBeenCalledWith('test-module', '1.0.0', false);
            });

            test('should throw error on parsing errors', async () => {
                (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                    modules: [],
                    errors: ['Parse error']
                });
                
                await expect(PuppetfileUpdateService.checkForAvailableUpdates())
                    .rejects.toThrow('Puppetfile parsing errors: Parse error');
            });
        });

        describe('applyUpdates', () => {
            test('should apply multiple updates in reverse line order', async () => {
                const mockWorkspaceEdit = {
                    replace: jest.fn()
                };
                (vscode.WorkspaceEdit as jest.Mock).mockReturnValue(mockWorkspaceEdit);
                (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

                const updates: UpdateResult[] = [
                    { moduleName: 'module1', currentVersion: '1.0.0', newVersion: '1.1.0', success: true, line: 1 },
                    { moduleName: 'module2', currentVersion: '2.0.0', newVersion: '2.1.0', success: true, line: 3 }
                ];

                // Call the private method via the public methods that use it
                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(vscode.workspace.applyEdit).toHaveBeenCalled();
            });

            test('should handle empty updates array', async () => {
                (PuppetfileParser.parseActiveEditor as jest.Mock).mockReturnValue({
                    modules: [],
                    errors: []
                });

                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                expect(results).toHaveLength(0);
            });

            test('should filter out updates with no version change', async () => {
                (PuppetForgeService.checkForUpdate as jest.Mock).mockResolvedValue({
                    hasUpdate: false,
                    latestVersion: '1.0.0'
                });

                const results = await PuppetfileUpdateService.updateAllToSafeVersions();
                
                // Should not apply workspace edits since no actual changes
                expect(results[0].newVersion).toBe('1.0.0');
                expect(results[0].currentVersion).toBe('1.0.0');
            });
        });
    });
});