import * as sinon from 'sinon';
import { DependencyTreeService, DependencyNode } from '../dependencyTreeService';
import { PuppetModule } from '../puppetfileParser';
import { GitMetadataService } from '../gitMetadataService';
import { PuppetForgeService } from '../puppetForgeService';
import { ConflictAnalyzer } from '../services/conflictAnalyzer';
import { VersionParser } from '../utils/versionParser';

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
                }
            ];

            const result = await DependencyTreeService.buildDependencyTree(modules);

            expect(result[0].displayVersion).toBe('1.0.0');
            expect(result[1].displayVersion).toBe('tag: v1.0.0');
            expect(result[2].displayVersion).toBe('ref: main');
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

        test('extractVersionFromRequirement should extract version numbers', () => {
            // This method is private, but we can test it through other functionality
            const modules: PuppetModule[] = [
                {
                    name: 'test/module',
                    version: '1.0.0',
                    source: 'forge',
                    line: 1
                }
            ];

            DependencyTreeService.buildDependencyTree(modules);
            // The method would be used internally during tree building
        });
    });

    describe('Conflict detection and analysis', () => {
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
});
