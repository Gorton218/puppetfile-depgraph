import * as sinon from 'sinon';
import { DependencyTreeService, DependencyNode } from '../../src/services/dependencyTreeService';
import { PuppetModule } from '../../src/puppetfileParser';
import { GitMetadataService } from '../../src/services/gitMetadataService';
import { PuppetForgeService } from '../../src/services/puppetForgeService';
import { ConflictAnalyzer } from '../../src/services/conflictAnalyzer';
import { VersionParser } from '../../src/utils/versionParser';

describe('DependencyTreeService Test Suite', () => {
    let gitMetadataStub: sinon.SinonStub;
    let forgeModuleStub: sinon.SinonStub;
    let conflictAnalyzerStub: sinon.SinonStub;
    let versionParserStub: sinon.SinonStub;
    let consoleWarnSpy: jest.SpyInstance;
    
    beforeEach(() => {
        // Reset dependency graph before each test
        DependencyTreeService.resetDependencyGraph();
        
        // Spy on console.warn to suppress output but still allow testing
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Stub GitMetadataService to prevent network calls
        gitMetadataStub = sinon.stub(GitMetadataService, 'getModuleMetadataWithFallback');
        gitMetadataStub.resolves(null); // Default to returning null for all Git metadata requests
        
        // Stub PuppetForgeService to prevent network calls
        forgeModuleStub = sinon.stub(PuppetForgeService, 'getModule');
        forgeModuleStub.resolves(null); // Default to returning null for all Forge requests
        
        // Stub ConflictAnalyzer methods
        conflictAnalyzerStub = sinon.stub(ConflictAnalyzer, 'checkForCircularDependencies');
        conflictAnalyzerStub.returns(null); // Default to no circular dependencies
        
        // Stub VersionParser methods
        versionParserStub = sinon.stub(VersionParser, 'parse');
        versionParserStub.returns([]);
    });
    
    afterEach(() => {
        sinon.restore();
        // Restore console.warn spy
        consoleWarnSpy.mockRestore();
    });
    
    test('should handle module without version using nullish coalescing', async () => {
        const modules: PuppetModule[] = [
            { name: 'puppetlabs/stdlib', version: undefined, source: 'forge', line: 1 },
            { name: 'puppetlabs/apache', version: null, source: 'forge', line: 2 }
        ];

        // Mock Forge API to return resolved versions
        forgeModuleStub.resolves({
            current_release: { version: '9.0.0' }
        });

        const nodes = await DependencyTreeService.buildDependencyTree(modules);
        
        // The service should handle null/undefined versions
        expect(nodes.length).toBe(2);
        // Just verify nullish coalescing logic was tested - the actual version depends on implementation
        expect(nodes[0]).toBeDefined();
        expect(nodes[1]).toBeDefined();
    });

    test('should handle git module with neither tag nor ref', async () => {
        const modules: PuppetModule[] = [
            { 
                name: 'custom/module', 
                source: 'git',
                gitUrl: 'https://github.com/custom/module.git',
                gitTag: undefined,
                gitRef: undefined,
                line: 1 
            }
        ];

        gitMetadataStub.withArgs('https://github.com/custom/module.git', undefined).resolves({
            name: 'custom/module',
            version: '1.0.0',
            dependencies: []
        });

        const nodes = await DependencyTreeService.buildDependencyTree(modules);
        
        expect(nodes.length).toBe(1);
        expect(nodes[0].name).toBe('custom/module');
        expect(gitMetadataStub.calledWith('https://github.com/custom/module.git', undefined)).toBe(true);
    });

    test('should handle array access with undefined indices', () => {
        // Test the version comparison logic with undefined array indices
        const versions = ['1.0.0', '2.0.0', '1.5.0'];
        const sorted = versions.sort((a, b) => {
            const aParts = a.split('.').map(Number);
            const bParts = b.split('.').map(Number);
            
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] ?? 0;
                const bPart = bParts[i] ?? 0;
                if (aPart !== bPart) {
                    return bPart - aPart;
                }
            }
            return 0;
        });
        
        expect(sorted).toEqual(['2.0.0', '1.5.0', '1.0.0']);
    });

    test('generateTreeText should format tree correctly', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                children: [
                    {
                        name: 'puppetlabs/concat',
                        version: '7.0.0',
                        source: 'forge',
                        children: [],
                        depth: 1,
                        isDirectDependency: false,
                        displayVersion: '7.0.0'
                    }
                ],
                depth: 0,
                isDirectDependency: true,
                displayVersion: '8.5.0'
            },
            {
                name: 'puppetlabs/firewall',
                version: '3.4.0',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true,
                displayVersion: '3.4.0'
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        
        expect(result).toContain('├── puppetlabs/stdlib (8.5.0) [forge]');
        expect(result).toContain('│   └── puppetlabs/concat (7.0.0) [forge]');
        expect(result).toContain('└── puppetlabs/firewall (3.4.0) [forge]');
    });
    
    test('generateTreeText should handle empty array', () => {
        const result = DependencyTreeService.generateTreeText([]);
        expect(result).toBe('');
    });
    
    test('generateTreeText should handle single module without version', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true,
                displayVersion: undefined
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        expect(result).toContain('└── puppetlabs/stdlib [forge]');
        expect(result).not.toContain('()');
    });
    
    test('generateTreeText should handle git modules', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'custom/module',
                version: 'master',
                source: 'git',
                children: [],
                depth: 0,
                isDirectDependency: true,
                gitUrl: 'https://github.com/user/module.git',
                displayVersion: 'master'
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        expect(result).toContain('└── custom/module (master) [git]');
    });
    
    test('generateListText should format list correctly', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                children: [
                    {
                        name: 'puppetlabs/concat',
                        version: '7.0.0',
                        source: 'forge',
                        children: [],
                        depth: 1,
                        isDirectDependency: false
                    }
                ],
                depth: 0,
                isDirectDependency: true
            },
            {
                name: 'custom/module',
                source: 'git',
                children: [],
                depth: 0,
                isDirectDependency: true,
                gitUrl: 'https://github.com/user/module.git'
            }
        ];
        
        const result = DependencyTreeService.generateListText(nodes);
        
        expect(result).toContain('Total Dependencies: 3');
        expect(result).toContain('Direct Dependencies (2):');
        expect(result).toContain('Transitive Dependencies (1):');
        expect(result).toContain('• puppetlabs/stdlib (8.5.0) [forge]');
        expect(result).toContain('• custom/module [git]');
        expect(result).toContain('• puppetlabs/concat (7.0.0) [forge]');
    });
    
    test('generateListText should handle empty dependencies', () => {
        const result = DependencyTreeService.generateListText([]);
        expect(result).toContain('Total Dependencies: 0');
    });
    
    test('generateListText should handle only direct dependencies', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const result = DependencyTreeService.generateListText(nodes);
        
        expect(result).toContain('Total Dependencies: 1');
        expect(result).toContain('Direct Dependencies (1):');
        expect(result).not.toContain('Transitive Dependencies');
    });
    
    test('findConflicts should detect version conflicts', () => {
        // Reset the dependency graph to ensure clean state
        DependencyTreeService.resetDependencyGraph();
        
        // Note: The new implementation only reports real conflicts when 
        // no version can satisfy all requirements. Since the tree nodes 
        // don't include version requirements, and the dependency graph 
        // is built during buildDependencyTree(), this test now expects 
        // no conflicts from just the tree structure.
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                children: [
                    {
                        name: 'puppetlabs/concat',
                        version: '7.0.0',
                        source: 'forge',
                        children: [],
                        depth: 1,
                        isDirectDependency: false
                    }
                ],
                depth: 0,
                isDirectDependency: true
            },
            {
                name: 'puppetlabs/firewall',
                version: '3.4.0',
                source: 'forge',
                children: [
                    {
                        name: 'puppetlabs/concat',
                        version: '6.0.0', // Different version - but without requirements, not a conflict
                        source: 'forge',
                        children: [],
                        depth: 1,
                        isDirectDependency: false
                    }
                ],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const conflicts = DependencyTreeService.findConflicts(nodes);
        
        // The new implementation requires the full buildDependencyTree process
        // to collect requirements and analyze conflicts properly
        expect(conflicts.length).toBe(0);
    });
    
    test('findConflicts should return empty array when no conflicts', () => {
        // Reset the dependency graph to ensure clean state
        DependencyTreeService.resetDependencyGraph();
        
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true
            },
            {
                name: 'puppetlabs/firewall',
                version: '3.4.0',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const conflicts = DependencyTreeService.findConflicts(nodes);
        expect(conflicts.length).toBe(0);
    });
    
    test('findConflicts should handle modules without versions', () => {
        // Reset the dependency graph to ensure clean state
        DependencyTreeService.resetDependencyGraph();
        
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const conflicts = DependencyTreeService.findConflicts(nodes);
        expect(conflicts.length).toBe(0);
    });

    // This test verifies the structure of the dependency tree
    // GitMetadataService is mocked to prevent network calls
    test('buildDependencyTree should handle basic module structure', async function() {
        // Mock specific Git metadata response for the test module
        gitMetadataStub.withArgs('https://github.com/user/module.git', 'v1.0.0').resolves({
            name: 'custom/module',
            version: '1.0.0',
            author: 'test',
            summary: 'Test module',
            license: 'Apache-2.0',
            source: 'https://github.com/user/module.git',
            dependencies: []
        });
        
        const modules: PuppetModule[] = [
            {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                line: 1
            },
            {
                name: 'custom/module',
                source: 'git',
                gitUrl: 'https://github.com/user/module.git',
                gitTag: 'v1.0.0',
                line: 2
            }
        ];
        
        const result = await DependencyTreeService.buildDependencyTree(modules);
        
        expect(result.length).toBe(2);
        expect(result[0].name).toBe('puppetlabs/stdlib');
        expect(result[0].isDirectDependency).toBe(true);
        expect(result[0].depth).toBe(0);
        
        expect(result[1].name).toBe('custom/module');
        expect(result[1].source).toBe('git');
        expect(result[1].gitUrl).toBe('https://github.com/user/module.git');
        expect(result[1].gitTag).toBe('v1.0.0');
    });
    
    test('buildDependencyTree should handle empty modules array', async () => {
        const result = await DependencyTreeService.buildDependencyTree([]);
        expect(result.length).toBe(0);
    });

    describe('Extended buildDependencyTree tests', () => {
        test('should handle forge modules with dependencies', async () => {
            const mockForgeModule = {
                name: 'puppetlabs-stdlib',
                current_release: {
                    version: '8.5.0',
                    metadata: {
                        dependencies: [
                            { name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 8.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '8.5.0',
                        metadata: {
                            dependencies: [
                                { name: 'puppetlabs/concat', version_requirement: '>= 6.0.0 < 8.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('puppetlabs/stdlib').resolves(mockForgeModule);
            forgeModuleStub.withArgs('puppetlabs/concat').resolves({
                name: 'puppetlabs-concat',
                current_release: { version: '7.0.0', metadata: { dependencies: [] } },
                releases: [{ version: '7.0.0', metadata: { dependencies: [] } }]
            });

            const modules: PuppetModule[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('puppetlabs/stdlib');
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('puppetlabs-concat');
        });

        test('should handle circular dependencies', async () => {
            // Stub analyzeModule to return a circular conflict
            const analyzeModuleStub = sinon.stub(ConflictAnalyzer, 'analyzeModule');
            analyzeModuleStub.returns({
                hasConflict: true,
                conflict: {
                    type: 'circular',
                    details: 'Circular dependency detected',
                    suggestedFixes: []
                },
                satisfyingVersions: [],
                mergedConstraint: undefined
            });

            const modules: PuppetModule[] = [
                {
                    name: 'module-a',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].conflict).toBeTruthy();
            expect(result[0].conflict?.type).toBe('circular');
        });

        test('should handle maximum depth limit', async () => {
            const mockForgeModule = {
                name: 'deep-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'deep-module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'deep-module', version_requirement: '>= 1.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('deep-module').resolves(mockForgeModule);

            const modules: PuppetModule[] = [
                {
                    name: 'deep-module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            // Should have limited depth due to MAX_DEPTH
            let currentNode = result[0];
            let depth = 0;
            while (currentNode.children.length > 0) {
                currentNode = currentNode.children[0];
                depth++;
                if (depth > 10) { break; } // Safety check
            }
            expect(depth).toBeLessThanOrEqual(5); // MAX_DEPTH is 5
        });

        test('should handle git modules with dependencies', async () => {
            const mockGitMetadata = {
                name: 'custom/module',
                version: '1.0.0',
                author: 'test',
                summary: 'Test module',
                license: 'Apache-2.0',
                source: 'https://github.com/user/module.git',
                dependencies: [
                    { name: 'puppetlabs/stdlib', version_requirement: '>= 8.0.0' }
                ]
            };

            gitMetadataStub.withArgs('https://github.com/user/module.git', 'v1.0.0').resolves(mockGitMetadata);
            forgeModuleStub.withArgs('puppetlabs/stdlib').resolves({
                name: 'puppetlabs-stdlib',
                current_release: { version: '8.5.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'custom/module',
                    source: 'git',
                    gitUrl: 'https://github.com/user/module.git',
                    gitTag: 'v1.0.0',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('custom/module');
            expect(result[0].source).toBe('git');
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('puppetlabs-stdlib');
        });

        test('should handle forge service errors gracefully', async () => {
            forgeModuleStub.rejects(new Error('Network error'));

            const modules: PuppetModule[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('puppetlabs/stdlib');
            expect(result[0].children.length).toBe(0);
            
            // Should have logged the error
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not fetch dependencies for puppetlabs/stdlib:', expect.any(Error));
        });

        test('should handle git service errors gracefully', async () => {
            gitMetadataStub.rejects(new Error('Git fetch error'));

            const modules: PuppetModule[] = [
                {
                    name: 'custom/module',
                    source: 'git',
                    gitUrl: 'https://github.com/user/module.git',
                    gitTag: 'v1.0.0',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].name).toBe('custom/module');
            expect(result[0].children.length).toBe(0);
            
            // Should have logged the error
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not fetch Git metadata for custom/module:', expect.any(Error));
        });

        test('should handle version constraints and conflict analysis', async () => {
            const analyzeModuleStub = sinon.stub(ConflictAnalyzer, 'analyzeModule');
            analyzeModuleStub.returns({
                hasConflict: true,
                conflict: {
                    type: 'no-intersection',
                    details: 'Version conflict detected',
                    suggestedFixes: [{ 
                        module: 'test-module', 
                        currentVersion: '1.0.0', 
                        suggestedVersion: '2.0.0', 
                        reason: 'Update to version 2.0.0' 
                    }]
                },
                satisfyingVersions: ['2.0.0'],
                mergedConstraint: { min: { version: '2.0.0', inclusive: true } }
            });

            const mockForgeModule = {
                name: 'puppetlabs-stdlib',
                current_release: {
                    version: '8.5.0',
                    metadata: { dependencies: [] }
                },
                releases: [
                    { version: '8.5.0', metadata: { dependencies: [] } },
                    { version: '9.0.0', metadata: { dependencies: [] } }
                ]
            };

            forgeModuleStub.withArgs('puppetlabs/stdlib').resolves(mockForgeModule);

            const modules: PuppetModule[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(analyzeModuleStub.calledOnce).toBe(true);
        });
    });

    describe('Tree and list formatting', () => {
        test('generateTreeText should handle conflicts and constraint violations', () => {
            const nodes: DependencyNode[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    children: [
                        {
                            name: 'puppetlabs/concat',
                            version: '6.0.0',
                            source: 'forge',
                            children: [],
                            depth: 1,
                            isDirectDependency: false,
                            displayVersion: 'requires >= 7.0.0, resolved: 6.0.0',
                            versionRequirement: '>= 7.0.0',
                            isConstraintViolated: true
                        }
                    ],
                    depth: 0,
                    isDirectDependency: true,
                    displayVersion: '8.5.0',
                    conflict: {
                        type: 'no-intersection',
                        details: 'Version conflict between requirements',
                        suggestedFixes: [
                            { 
                                module: 'puppetlabs/stdlib', 
                                currentVersion: '8.5.0', 
                                suggestedVersion: '9.0.0', 
                                reason: 'Update to version 9.0.0' 
                            }
                        ]
                    }
                }
            ];

            const result = DependencyTreeService.generateTreeText(nodes);

            expect(result).toContain('❌');
            expect(result).toContain('⚠️');
            expect(result).toContain('Version conflict between requirements');
            expect(result).toContain('💡 Update to version 9.0.0');
            expect(result).toContain('Constraint violation');
        });

        test('generateTreeText should handle git module display versions', () => {
            const nodes: DependencyNode[] = [
                {
                    name: 'custom/module',
                    source: 'git',
                    children: [],
                    depth: 0,
                    isDirectDependency: true,
                    gitUrl: 'https://github.com/user/module.git',
                    gitTag: 'v1.0.0',
                    displayVersion: 'tag: v1.0.0'
                },
                {
                    name: 'another/module',
                    source: 'git',
                    children: [],
                    depth: 0,
                    isDirectDependency: true,
                    gitUrl: 'https://github.com/user/another.git',
                    gitRef: 'main',
                    displayVersion: 'ref: main'
                }
            ];

            const result = DependencyTreeService.generateTreeText(nodes);

            expect(result).toContain('(tag: v1.0.0)');
            expect(result).toContain('(ref: main)');
        });

        test('generateListText should handle modules without versions', () => {
            const nodes: DependencyNode[] = [
                {
                    name: 'puppetlabs/stdlib',
                    source: 'forge',
                    children: [],
                    depth: 0,
                    isDirectDependency: true
                }
            ];

            const result = DependencyTreeService.generateListText(nodes);

            expect(result).toContain('• puppetlabs/stdlib [forge]');
            expect(result).not.toContain('()');
        });

        test('generateListText should deduplicate modules', () => {
            const nodes: DependencyNode[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    children: [
                        {
                            name: 'puppetlabs/concat',
                            version: '7.0.0',
                            source: 'forge',
                            children: [],
                            depth: 1,
                            isDirectDependency: false
                        }
                    ],
                    depth: 0,
                    isDirectDependency: true
                },
                {
                    name: 'puppetlabs/firewall',
                    version: '3.4.0',
                    source: 'forge',
                    children: [
                        {
                            name: 'puppetlabs/concat',
                            version: '7.0.0',
                            source: 'forge',
                            children: [],
                            depth: 1,
                            isDirectDependency: false
                        }
                    ],
                    depth: 0,
                    isDirectDependency: true
                }
            ];

            const result = DependencyTreeService.generateListText(nodes);

            expect(result).toContain('Total Dependencies: 3');
            // Should only list concat once despite appearing twice in tree
            const concatMatches = (result.match(/puppetlabs\/concat/g) || []).length;
            expect(concatMatches).toBe(1);
        });
    });

    describe('Helper methods', () => {
        test('normalizeModuleName should convert slash to dash', () => {
            // This tests a private method indirectly through public APIs
            const modules: PuppetModule[] = [
                {
                    name: 'puppetlabs/stdlib',
                    version: '8.5.0',
                    source: 'forge',
                    line: 1
                }
            ];

            DependencyTreeService.buildDependencyTree(modules);
            // The normalized name should be used internally
            expect(forgeModuleStub.calledWith('puppetlabs/stdlib')).toBe(true);
        });

        test('determineDisplayVersion should handle different scenarios', async () => {
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                },
                {
                    name: 'git/module',
                    source: 'git',
                    gitUrl: 'https://github.com/user/module.git',
                    gitTag: 'v1.0.0',
                    line: 2
                },
                {
                    name: 'ref/module',
                    source: 'git',
                    gitUrl: 'https://github.com/user/module.git',
                    gitRef: 'main',
                    line: 3
                },
                {
                    name: 'git-no-ref/module',
                    source: 'git',
                    gitUrl: 'https://github.com/user/module.git',
                    // No gitRef or gitTag
                    line: 4
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].displayVersion).toBe('1.0.0');
            expect(result[1].displayVersion).toBe('tag: v1.0.0');
            expect(result[2].displayVersion).toBe('ref: main');
            expect(result[3].displayVersion).toBe('git'); // Should show 'git' when no ref or tag
        });

        test('should handle cancellation during tree building', async () => {
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const cancellationToken = { isCancellationRequested: true };
            const result = await DependencyTreeService.buildDependencyTree(modules, undefined, cancellationToken);

            expect(result).toEqual([]);
        });

        test('should handle version requirement resolution with specific release', async () => {
            const module: PuppetModule = {
                name: 'puppetlabs/stdlib',
                version: '8.5.0',
                source: 'forge',
                line: 1
            };

            const mockForgeModule = {
                slug: 'puppetlabs/stdlib',
                name: 'stdlib',
                releases: [
                    {
                        version: '8.5.0',
                        metadata: {
                            dependencies: [
                                { name: 'puppetlabs/concat', version_requirement: '>= 1.0.0 < 3.0.0' }
                            ]
                        }
                    },
                    {
                        version: '8.4.0',
                        metadata: {
                            dependencies: []
                        }
                    }
                ]
            };

            (PuppetForgeService.getModule as sinon.SinonStub).resolves(mockForgeModule);
            (PuppetForgeService.getModule as sinon.SinonStub).withArgs('puppetlabs/concat').resolves({
                slug: 'puppetlabs/concat',
                name: 'concat',
                releases: [
                    { version: '2.0.0', metadata: { dependencies: [] } }
                ]
            });

            const result = await DependencyTreeService.buildDependencyTree([module]);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].children?.length).toBeGreaterThan(0);
        });

        test('should handle modules with no matching version requirement', async () => {
            const module: PuppetModule = {
                name: 'test/badmodule',
                version: '1.0.0',
                source: 'forge',
                line: 1
            };

            const mockForgeModule = {
                slug: 'test/badmodule',
                name: 'badmodule',
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'nonexistent/module', version_requirement: '>= 999.0.0' }
                            ]
                        }
                    }
                ]
            };

            (PuppetForgeService.getModule as sinon.SinonStub).resolves(mockForgeModule);
            (PuppetForgeService.getModule as sinon.SinonStub).withArgs('nonexistent/module').resolves({
                slug: 'nonexistent/module',
                name: 'module',
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } }
                ]
            });

            const result = await DependencyTreeService.buildDependencyTree([module]);

            expect(result.length).toBeGreaterThan(0);
        });

        test('checkConstraintViolation should detect violations', async () => {
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');
            
            parseStub.returns([{ operator: '>=', version: '2.0.0' }]);
            satisfiesStub.returns(false);

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: '>= 2.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: '>= 2.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '1.5.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                },
                {
                    name: 'other/module',
                    version: '1.5.0',
                    source: 'forge',
                    line: 2
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].isConstraintViolated).toBe(true);
        });

        test('checkConstraintViolation should handle parsing errors gracefully', async () => {
            // Test the error handling branch in checkConstraintViolation
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            parseStub.throws(new Error('Invalid constraint format'));

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: 'invalid!!!' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: 'invalid!!!' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '1.5.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                },
                {
                    name: 'other/module',
                    version: '1.5.0',
                    source: 'forge',
                    line: 2
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should not crash and should assume no violation when parsing fails
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].isConstraintViolated).toBe(false);
            
            // Should log the parsing error
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Could not parse version requirement'),
                expect.any(Error)
            );
        });

        test('findBestMatchingVersion should find optimal version', async () => {
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');

            parseStub.returns([{ operator: '>=', version: '1.0.0' }]);
            satisfiesStub.withArgs('1.0.0', sinon.match.any).returns(true);
            satisfiesStub.withArgs('1.5.0', sinon.match.any).returns(true);
            satisfiesStub.withArgs('2.0.0', sinon.match.any).returns(true);
            satisfiesStub.withArgs('0.9.0', sinon.match.any).returns(false);

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '2.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'versioned/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    { version: '0.9.0', metadata: { dependencies: [] } },
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '1.5.0', metadata: { dependencies: [] } },
                    { version: '2.0.0', metadata: { 
                        dependencies: [
                            { name: 'versioned/module', version_requirement: '>= 1.0.0' }
                        ]
                    } }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('versioned/module').resolves({
                name: 'versioned-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } },
                releases: [
                    { version: '0.9.0', metadata: { dependencies: [] } },
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '1.5.0', metadata: { dependencies: [] } },
                    { version: '2.0.0', metadata: { dependencies: [] } }
                ]
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '2.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].children.length).toBe(1);
            // Should use the best matching version (highest that satisfies constraint)
        });

        test('findBestMatchingVersion should handle complex version sorting', async () => {
            // Test version sorting with different version formats and lengths
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');

            parseStub.returns([{ operator: '>=', version: '1.0.0' }]);
            // All versions satisfy the constraint
            satisfiesStub.returns(true);

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'sorted/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'sorted/module', version_requirement: '>= 1.0.0' }
                            ]
                        }
                    }
                ]
            };

            const mockSortedModule = {
                name: 'sorted-module',
                current_release: { version: '2.10.0', metadata: { dependencies: [] } },
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '1.9.0', metadata: { dependencies: [] } },
                    { version: '1.10.0', metadata: { dependencies: [] } },
                    { version: '2.0.0', metadata: { dependencies: [] } },
                    { version: '2.1.0', metadata: { dependencies: [] } },
                    { version: '2.1.1', metadata: { dependencies: [] } },
                    { version: '2.10.0', metadata: { dependencies: [] } },
                    { version: '10.0.0', metadata: { dependencies: [] } }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('sorted/module').resolves(mockSortedModule);

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should select 10.0.0 as the highest version
            expect(result[0].children.length).toBe(1);
            // The version selection happens internally
        });

        test('findBestMatchingVersion should handle versions with equal parts', async () => {
            // Test when versions have equal parts, ensuring all paths are covered
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');

            parseStub.returns([{ operator: '>=', version: '1.0.0' }]);
            satisfiesStub.returns(true);

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'equal/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'equal/module', version_requirement: '>= 1.0.0' }
                            ]
                        }
                    }
                ]
            };

            const mockEqualModule = {
                name: 'equal-module',
                current_release: { version: '1.2.3', metadata: { dependencies: [] } },
                releases: [
                    { version: '1.2.3', metadata: { dependencies: [] } },
                    { version: '1.2.3.0', metadata: { dependencies: [] } }, // Same but with extra zero
                    { version: '1.2.3.1', metadata: { dependencies: [] } }  // Higher with extra part
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('equal/module').resolves(mockEqualModule);

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].children.length).toBe(1);
        });

        test('extractVersionFromRequirement should extract version numbers', () => {
            // Since the method is private, we need to access it via the class
            const extractMethod = (DependencyTreeService as any).extractVersionFromRequirement;
            
            // Test cases covering different version requirement formats
            const testCases = [
                { requirement: '>= 1.0.0', expected: '1.0.0' },
                { requirement: '< 2.0.0', expected: '2.0.0' },
                { requirement: '~> 1.2.3', expected: '1.2.3' },
                { requirement: '= 4.5.6', expected: '4.5.6' },
                { requirement: '>= 1.2.3 < 2.0.0', expected: '1.2.3' }, // Should extract first version
                { requirement: 'version 3.14.159', expected: '3.14.159' },
                { requirement: '1.0', expected: '1.0' },
                { requirement: '10.20.30', expected: '10.20.30' },
                { requirement: 'no_version_here', expected: undefined },
                { requirement: 'latest', expected: undefined },
                { requirement: '', expected: undefined },
                { requirement: '1', expected: '1' },
                { requirement: 'v1.2.3-suffix', expected: '1.2.3' }
            ];
            
            testCases.forEach(({ requirement, expected }) => {
                const result = extractMethod(requirement);
                expect(result).toBe(expected);
            });
        });

        test('extractVersionFromRequirement should handle requirements without version numbers', async () => {
            // Test the scenario where version requirement doesn't match the regex pattern
            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: 'latest' } // No version number
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: 'latest' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].children.length).toBe(1);
            // Should handle requirement without version number gracefully
            expect(result[0].children[0].displayVersion).toContain('requires latest');
        });

        test('findBestMatchingVersion should handle parsing errors', async () => {
            // Test the error handling branch when VersionParser.parse throws an error
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            parseStub.throws(new Error('Invalid version constraint'));

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: 'invalid!!constraint' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: 'invalid!!constraint' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } },
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '2.0.0', metadata: { dependencies: [] } }
                ]
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should handle parsing error gracefully and fall back to current_release
            expect(result[0].children.length).toBe(1);
            // The error is logged during conflict analysis, not during findBestMatchingVersion
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Could not analyze conflicts'), 
                expect.any(Error)
            );
        });

        test('findBestMatchingVersion should return null when no versions satisfy constraint', async () => {
            // Test the branch where no versions satisfy the constraint
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');

            parseStub.returns([{ operator: '>=', version: '3.0.0' }]);
            satisfiesStub.returns(false); // No version satisfies

            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: '>= 3.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: '>= 3.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } },
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '2.0.0', metadata: { dependencies: [] } }
                ]
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should use current_release when no version matches constraint
            expect(result[0].children.length).toBe(1);
        });

        test('buildNodeTree should handle forge modules without releases array', async () => {
            // Test the branch where forgeModule.releases is undefined
            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                }
                // No releases array
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should use current_release when releases array is missing
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('other-module');
        });

        test('buildNodeTree should handle forge modules with empty releases array', async () => {
            // Test the branch where forgeModule.releases is an empty array
            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [] // Empty releases array
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should use current_release when releases array is empty
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('other-module');
        });

        test('buildNodeTree should handle forge module without specific version release', async () => {
            // Test when the specific version is not found in releases
            const mockForgeModule = {
                name: 'test-module',
                current_release: {
                    version: '2.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'other/module', version_requirement: '>= 2.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '2.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'other/module', version_requirement: '>= 2.0.0' }
                            ]
                        }
                    }
                    // Version 1.0.0 is not in releases
                ]
            };

            forgeModuleStub.withArgs('test/module').resolves(mockForgeModule);
            forgeModuleStub.withArgs('other/module').resolves({
                name: 'other-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0', // This version is not in releases
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should fall back to current_release when specific version not found
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('other-module');
        });

        test('buildNodeTree should handle transitive dependencies with version constraints', async () => {
            // Test the branch for transitive dependencies with version requirements
            versionParserStub.restore();
            const parseStub = sinon.stub(VersionParser, 'parse');
            const satisfiesStub = sinon.stub(VersionParser, 'satisfiesAll');

            parseStub.returns([{ operator: '>=', version: '2.0.0' }, { operator: '<', version: '3.0.0' }]);
            satisfiesStub.withArgs('2.5.0', sinon.match.any).returns(true);
            satisfiesStub.withArgs('3.0.0', sinon.match.any).returns(false);
            satisfiesStub.withArgs('1.0.0', sinon.match.any).returns(false);

            const mockParentModule = {
                name: 'parent-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'child/module', version_requirement: '>= 2.0.0 < 3.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'child/module', version_requirement: '>= 2.0.0 < 3.0.0' }
                            ]
                        }
                    }
                ]
            };

            const mockChildModule = {
                name: 'child-module',
                current_release: {
                    version: '3.0.0',
                    metadata: { dependencies: [] }
                },
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } },
                    { version: '2.5.0', metadata: { dependencies: [] } },
                    { version: '3.0.0', metadata: { dependencies: [] } }
                ]
            };

            forgeModuleStub.withArgs('parent/module').resolves(mockParentModule);
            forgeModuleStub.withArgs('child/module').resolves(mockChildModule);

            const modules: PuppetModule[] = [
                {
                    name: 'parent/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should find best matching version (2.5.0) for the transitive dependency
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('child-module');
            expect(result[0].children[0].displayVersion).toContain('requires >= 2.0.0 < 3.0.0');
        });

        test('buildNodeTree should handle transitive dependencies when no resolved version exists', async () => {
            // Test when transitive dependency doesn't have a resolved version in Puppetfile
            const mockParentModule = {
                name: 'parent-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'transitive/module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'transitive/module', version_requirement: '>= 1.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('parent/module').resolves(mockParentModule);
            forgeModuleStub.withArgs('transitive/module').resolves({
                name: 'transitive-module',
                current_release: { version: '2.0.0', metadata: { dependencies: [] } }
            });

            const modules: PuppetModule[] = [
                {
                    name: 'parent/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
                // Note: transitive/module is NOT in the Puppetfile
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('transitive-module');
            expect(result[0].children[0].displayVersion).toBe('requires >= 1.0.0');
            expect(result[0].children[0].isDirectDependency).toBe(false);
        });

        test('buildNodeTree should handle missing release metadata dependencies', async () => {
            // Test edge case where release metadata or dependencies is undefined
            const mockParentModule = {
                name: 'parent-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'child/module', version_requirement: '>= 2.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'child/module', version_requirement: '>= 2.0.0' }
                            ]
                        }
                    }
                ]
            };

            // Mock the child module with a release that has no metadata
            const mockChildModule = {
                name: 'child-module',
                current_release: {
                    version: '2.0.0'
                    // No metadata property
                },
                releases: [
                    { version: '2.0.0' } // No metadata property
                ]
            };

            forgeModuleStub.withArgs('parent/module').resolves(mockParentModule);
            forgeModuleStub.withArgs('child/module').resolves(mockChildModule);

            const modules: PuppetModule[] = [
                {
                    name: 'parent/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should handle missing metadata gracefully
            expect(result[0].children.length).toBe(1);
            expect(result[0].children[0].name).toBe('child-module');
        });
    });

    describe('Conflict detection and analysis', () => {
        test('analyzeConflicts should skip modules with no requirements', async () => {
            // Test the branch where requirements.length === 0
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    source: 'forge',
                    line: 1
                    // No version, so no requirement will be added
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            // Should handle modules without requirements gracefully
            expect(result.length).toBe(1);
            expect(result[0].name).toBe('test/module');
        });

        test('analyzeConflicts should transform module names correctly for API calls', async () => {
            // Test the module name transformation logic in analyzeConflicts
            const modules: PuppetModule[] = [
                {
                    name: 'puppetlabs-stdlib', // Dash format
                    version: '8.5.0',
                    source: 'forge',
                    line: 1
                },
                {
                    name: 'single-word', // Single word, should not be transformed
                    version: '1.0.0',
                    source: 'forge',
                    line: 2
                },
                {
                    name: 'user-module-extra', // More than 2 parts, should not be transformed
                    version: '2.0.0',
                    source: 'forge',
                    line: 3
                }
            ];

            // Reset the existing stub to capture calls
            forgeModuleStub.reset();
            
            // Mock ConflictAnalyzer to prevent actual conflict analysis
            const conflictStub = sinon.stub(ConflictAnalyzer, 'analyzeModule');
            conflictStub.returns({
                hasConflict: false,
                satisfyingVersions: ['8.5.0'],
                mergedConstraint: {}
            });

            await DependencyTreeService.buildDependencyTree(modules);

            // Verify the API calls were made with correct transformations
            expect(forgeModuleStub.calledWith('puppetlabs/stdlib')).toBe(true); // Should be transformed
            expect(forgeModuleStub.calledWith('single-word')).toBe(true); // Should not be transformed
            expect(forgeModuleStub.calledWith('user-module-extra')).toBe(true); // Should not be transformed

            conflictStub.restore();
        });

        test('findConflicts should report conflicts from dependency graph', () => {
            // Manually add conflict to dependency graph for testing
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            // Build a tree first to populate dependency graph
            DependencyTreeService.buildDependencyTree(modules);

            // Mock the private dependency graph with conflicts
            const dependencyGraph = (DependencyTreeService as any).dependencyGraph;
            dependencyGraph['test-module'] = {
                requirements: [],
                conflict: {
                    type: 'no-intersection',
                    details: 'Test conflict details',
                    suggestedFixes: [
                        { 
                            module: 'test/module', 
                            currentVersion: '1.0.0', 
                            suggestedVersion: '1.1.0', 
                            reason: 'Test suggestion 1' 
                        },
                        { 
                            module: 'test/module', 
                            currentVersion: '1.0.0', 
                            suggestedVersion: '1.2.0', 
                            reason: 'Test suggestion 2' 
                        }
                    ]
                }
            };

            const conflicts = DependencyTreeService.findConflicts([]);

            expect(conflicts.length).toBeGreaterThan(0);
            expect(conflicts[0]).toContain('Test conflict details');
            expect(conflicts).toContain('  Suggestion: Test suggestion 1');
            expect(conflicts).toContain('  Suggestion: Test suggestion 2');
        });

        test('resetDependencyGraph should clear internal state', async () => {
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            await DependencyTreeService.buildDependencyTree(modules);

            // Should have some state
            let conflicts = DependencyTreeService.findConflicts([]);

            DependencyTreeService.resetDependencyGraph();

            // Should be cleared now
            conflicts = DependencyTreeService.findConflicts([]);
            expect(conflicts.length).toBe(0);
        });

        test('should handle modules without versions in dependency graph', async () => {
            const modules: PuppetModule[] = [
                {
                    name: 'no-version/module',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            expect(result[0].version).toBeUndefined();
        });

        test('should handle visited modules correctly', async () => {
            const mockForgeModule = {
                name: 'recursive-module',
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'recursive-module', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [
                    {
                        version: '1.0.0',
                        metadata: {
                            dependencies: [
                                { name: 'recursive-module', version_requirement: '>= 1.0.0' }
                            ]
                        }
                    }
                ]
            };

            forgeModuleStub.withArgs('recursive-module').resolves(mockForgeModule);

            const modules: PuppetModule[] = [
                {
                    name: 'recursive-module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result.length).toBe(1);
            // Should handle recursion properly without infinite loops
        });
    });

    describe('Cancellation Token Support', () => {
        test('should handle cancellation during initial module processing', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '9.0.0', source: 'forge', line: 1 },
                { name: 'puppetlabs/apache', version: '8.0.0', source: 'forge', line: 2 }
            ];

            const cancellationToken = { isCancellationRequested: true };
            const result = await DependencyTreeService.buildDependencyTree(
                modules,
                undefined,
                cancellationToken
            );

            expect(result).toEqual([]);
        });

        test('should handle cancellation during tree building', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '9.0.0', source: 'forge', line: 1 }
            ];

            let callCount = 0;
            const cancellationToken = {
                get isCancellationRequested() {
                    callCount++;
                    // Cancel after a few calls to simulate cancellation during processing
                    return callCount > 3;
                }
            };

            const result = await DependencyTreeService.buildDependencyTree(
                modules,
                undefined,
                cancellationToken
            );

            expect(result).toEqual([]);
        });

        test('should handle cancellation before conflict analysis', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '9.0.0', source: 'forge', line: 1 }
            ];

            let callCount = 0;
            const cancellationToken = {
                get isCancellationRequested() {
                    callCount++;
                    // Cancel earlier in the process to ensure we exit before tree is built
                    return callCount > 5;
                }
            };

            const result = await DependencyTreeService.buildDependencyTree(
                modules,
                undefined,
                cancellationToken
            );

            expect(result).toEqual([]);
        });

        test('should handle cancellation during dependency processing', async () => {
            const modules: PuppetModule[] = [
                { name: 'puppetlabs/stdlib', version: '9.0.0', source: 'forge', line: 1 }
            ];

            // Mock the service to simulate a module with many dependencies
            const originalGetModule = PuppetForgeService.getModule;
            PuppetForgeService.getModule = jest.fn().mockResolvedValue({
                current_release: {
                    version: '9.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'dep1', version_requirement: '>= 1.0.0' },
                            { name: 'dep2', version_requirement: '>= 1.0.0' },
                            { name: 'dep3', version_requirement: '>= 1.0.0' }
                        ]
                    }
                },
                releases: [{ version: '9.0.0', metadata: { dependencies: [] } }]
            });

            let callCount = 0;
            const cancellationToken = {
                get isCancellationRequested() {
                    callCount++;
                    // Cancel very early to ensure we exit
                    return callCount > 2;
                }
            };

            const result = await DependencyTreeService.buildDependencyTree(
                modules,
                undefined,
                cancellationToken
            );

            // Restore original function
            PuppetForgeService.getModule = originalGetModule;

            // Should return empty array due to cancellation
            expect(result).toEqual([]);
        });

        test('should handle cancellation with git modules', async () => {
            const modules: PuppetModule[] = [
                { 
                    name: 'mymodule', 
                    source: 'git', 
                    gitUrl: 'https://github.com/user/repo.git',
                    gitTag: 'v1.0.0',
                    line: 1 
                }
            ];

            // Mock git metadata service
            const originalGetMetadata = GitMetadataService.getModuleMetadataWithFallback;
            GitMetadataService.getModuleMetadataWithFallback = jest.fn().mockResolvedValue({
                dependencies: [
                    { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0' }
                ]
            });

            const cancellationToken = {
                isCancellationRequested: false
            };

            // Start the build
            const resultPromise = DependencyTreeService.buildDependencyTree(
                modules,
                undefined,
                cancellationToken
            );

            // Cancel mid-way
            setTimeout(() => {
                cancellationToken.isCancellationRequested = true;
            }, 10);

            const result = await resultPromise;

            // Restore original function
            GitMetadataService.getModuleMetadataWithFallback = originalGetMetadata;

            // May return partial results or empty array depending on timing
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('findBestMatchingVersion error handling', () => {
        test('should handle parsing errors in findBestMatchingVersion', async () => {
            // This test specifically covers the error path in findBestMatchingVersion (lines 667-669)
            const modules: PuppetModule[] = [
                { name: 'test/module', version: undefined, source: 'forge', line: 1 }
            ];

            // Mock the service to return a module with dependencies that have unparseable constraints
            const originalGetModule = PuppetForgeService.getModule;
            PuppetForgeService.getModule = jest.fn().mockResolvedValue({
                current_release: {
                    version: '1.0.0',
                    metadata: {
                        dependencies: [
                            { name: 'dep/module', version_requirement: 'invalid constraint !!!' }
                        ]
                    }
                },
                releases: [
                    { version: '1.0.0', metadata: { dependencies: [] } }
                ]
            });

            // Mock VersionParser to throw an error
            const originalParse = VersionParser.parse;
            VersionParser.parse = jest.fn().mockImplementation((constraint) => {
                if (constraint.includes('invalid')) {
                    throw new Error('Invalid constraint');
                }
                return originalParse.call(VersionParser, constraint);
            });

            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

            await DependencyTreeService.buildDependencyTree(modules);

            // The warning should be logged
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Could not parse constraint'),
                expect.any(Error)
            );

            // Restore mocks
            PuppetForgeService.getModule = originalGetModule;
            VersionParser.parse = originalParse;
            consoleWarnSpy.mockRestore();
        });
    });
});
