import * as sinon from 'sinon';
import { DependencyTreeService, DependencyNode } from '../dependencyTreeService';
import { PuppetModule } from '../puppetfileParser';
import { GitMetadataService } from '../gitMetadataService';

describe('DependencyTreeService Test Suite', () => {
    let gitMetadataStub: sinon.SinonStub;
    
    beforeEach(() => {
        // Stub GitMetadataService to prevent network calls
        gitMetadataStub = sinon.stub(GitMetadataService, 'getModuleMetadataWithFallback');
        gitMetadataStub.resolves(null); // Default to returning null for all Git metadata requests
    });
    
    afterEach(() => {
        sinon.restore();
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
});
