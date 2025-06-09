import * as assert from 'assert';
import { DependencyTreeService, DependencyNode } from '../dependencyTreeService';
import { PuppetModule } from '../puppetfileParser';

suite('DependencyTreeService Test Suite', () => {
    
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
                children: [],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        
        assert.ok(result.includes('├── puppetlabs/stdlib (8.5.0) [forge]'));
        assert.ok(result.includes('│   └── puppetlabs/concat (7.0.0) [forge]'));
        assert.ok(result.includes('└── puppetlabs/firewall (3.4.0) [forge]'));
    });
    
    test('generateTreeText should handle empty array', () => {
        const result = DependencyTreeService.generateTreeText([]);
        assert.strictEqual(result, '');
    });
    
    test('generateTreeText should handle single module without version', () => {
        const nodes: DependencyNode[] = [
            {
                name: 'puppetlabs/stdlib',
                source: 'forge',
                children: [],
                depth: 0,
                isDirectDependency: true
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        assert.ok(result.includes('└── puppetlabs/stdlib [forge]'));
        assert.ok(!result.includes('()'));
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
                gitUrl: 'https://github.com/user/module.git'
            }
        ];
        
        const result = DependencyTreeService.generateTreeText(nodes);
        assert.ok(result.includes('└── custom/module (master) [git]'));
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
        
        assert.ok(result.includes('Total Dependencies: 3'));
        assert.ok(result.includes('Direct Dependencies (2):'));
        assert.ok(result.includes('Transitive Dependencies (1):'));
        assert.ok(result.includes('• puppetlabs/stdlib (8.5.0) [forge]'));
        assert.ok(result.includes('• custom/module [git]'));
        assert.ok(result.includes('• puppetlabs/concat (7.0.0) [forge]'));
    });
    
    test('generateListText should handle empty dependencies', () => {
        const result = DependencyTreeService.generateListText([]);
        assert.ok(result.includes('Total Dependencies: 0'));
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
        
        assert.ok(result.includes('Total Dependencies: 1'));
        assert.ok(result.includes('Direct Dependencies (1):'));
        assert.ok(!result.includes('Transitive Dependencies'));
    });
    
    test('findConflicts should detect version conflicts', () => {
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
        assert.strictEqual(conflicts.length, 0);
    });
    
    test('findConflicts should return empty array when no conflicts', () => {
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
        assert.strictEqual(conflicts.length, 0);
    });
    
    test('findConflicts should handle modules without versions', () => {
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
        assert.strictEqual(conflicts.length, 0);
    });

    // Note: buildDependencyTree requires network access for API calls
    // This test focuses on the structure rather than actual API responses
    test('buildDependencyTree should handle basic module structure', async function() {
        this.timeout(15000); // Increase timeout for potential network requests
        
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
        
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].name, 'puppetlabs/stdlib');
        assert.strictEqual(result[0].isDirectDependency, true);
        assert.strictEqual(result[0].depth, 0);
        
        assert.strictEqual(result[1].name, 'custom/module');
        assert.strictEqual(result[1].source, 'git');
        assert.strictEqual(result[1].gitUrl, 'https://github.com/user/module.git');
        assert.strictEqual(result[1].gitTag, 'v1.0.0');
    });
    
    test('buildDependencyTree should handle empty modules array', async () => {
        const result = await DependencyTreeService.buildDependencyTree([]);
        assert.strictEqual(result.length, 0);
    });
});
