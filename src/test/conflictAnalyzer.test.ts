import * as assert from 'assert';
import { suite, test } from 'mocha';
import { ConflictAnalyzer } from '../services/conflictAnalyzer';
import { Requirement } from '../types/dependencyTypes';

suite('ConflictAnalyzer Test Suite', () => {
  
  suite('analyzeModule()', () => {
    test('should detect no conflict when versions overlap', () => {
      const requirements: Requirement[] = [
        {
          constraint: '>= 4.0.0 < 9.0.0',
          imposedBy: 'puppetlabs/apache',
          path: ['myapp', 'apache', 'stdlib'],
          isDirectDependency: false
        },
        {
          constraint: '>= 8.0.0',
          imposedBy: 'puppetlabs/mysql',
          path: ['myapp', 'mysql', 'stdlib'],
          isDirectDependency: false
        }
      ];
      
      const availableVersions = ['4.0.0', '5.0.0', '6.0.0', '7.0.0', '8.0.0', '8.5.0', '9.0.0', '10.0.0'];
      
      const result = ConflictAnalyzer.analyzeModule('puppetlabs/stdlib', requirements, availableVersions);
      
      assert.strictEqual(result.hasConflict, false);
      assert.ok(result.satisfyingVersions);
      assert.deepStrictEqual(result.satisfyingVersions, ['8.0.0', '8.5.0']);
    });
    
    test('should detect no-intersection conflict', () => {
      const requirements: Requirement[] = [
        {
          constraint: '>= 6.0.0 < 7.0.0',
          imposedBy: 'puppetlabs/apache',
          path: ['myapp', 'apache', 'concat'],
          isDirectDependency: false
        },
        {
          constraint: '>= 7.0.0',
          imposedBy: 'puppetlabs/mysql',
          path: ['myapp', 'mysql', 'concat'],
          isDirectDependency: false
        }
      ];
      
      const availableVersions = ['5.0.0', '6.0.0', '6.5.0', '7.0.0', '7.5.0', '8.0.0'];
      
      const result = ConflictAnalyzer.analyzeModule('puppetlabs/concat', requirements, availableVersions);
      
      assert.strictEqual(result.hasConflict, true);
      assert.ok(result.conflict);
      assert.strictEqual(result.conflict.type, 'no-intersection');
      assert.ok(result.conflict.details.includes('No version of puppetlabs/concat satisfies all requirements'));
    });
    
    test('should detect no-available-version conflict', () => {
      const requirements: Requirement[] = [
        {
          constraint: '>= 10.0.0',
          imposedBy: 'puppetlabs/apache',
          path: ['myapp', 'apache', 'future'],
          isDirectDependency: false
        }
      ];
      
      const availableVersions = ['1.0.0', '2.0.0', '3.0.0'];
      
      const result = ConflictAnalyzer.analyzeModule('example/future', requirements, availableVersions);
      
      assert.strictEqual(result.hasConflict, true);
      assert.ok(result.conflict);
      assert.strictEqual(result.conflict.type, 'no-available-version');
    });
    
    test('should handle exact version requirements', () => {
      const requirements: Requirement[] = [
        {
          constraint: '= 1.2.3',
          imposedBy: 'Puppetfile',
          path: ['mymodule'],
          isDirectDependency: true
        },
        {
          constraint: '>= 1.0.0 < 2.0.0',
          imposedBy: 'other/module',
          path: ['myapp', 'other', 'mymodule'],
          isDirectDependency: false
        }
      ];
      
      const availableVersions = ['1.0.0', '1.1.0', '1.2.3', '1.3.0', '2.0.0'];
      
      const result = ConflictAnalyzer.analyzeModule('mymodule', requirements, availableVersions);
      
      assert.strictEqual(result.hasConflict, false);
      assert.ok(result.satisfyingVersions);
      assert.deepStrictEqual(result.satisfyingVersions, ['1.2.3']);
    });
    
    test('should generate suggested fixes for conflicts', () => {
      const requirements: Requirement[] = [
        {
          constraint: '>= 6.0.0 < 7.0.0',
          imposedBy: 'puppetlabs/apache',
          path: ['myapp', 'apache', 'concat'],
          isDirectDependency: false
        },
        {
          constraint: '>= 7.0.0',
          imposedBy: 'puppetlabs/mysql',
          path: ['myapp', 'mysql', 'concat'],
          isDirectDependency: false
        }
      ];
      
      const availableVersions = ['6.0.0', '6.5.0', '7.0.0', '7.5.0'];
      
      const result = ConflictAnalyzer.analyzeModule('puppetlabs/concat', requirements, availableVersions);
      
      assert.strictEqual(result.hasConflict, true);
      assert.ok(result.conflict);
      assert.ok(result.conflict.suggestedFixes.length > 0);
    });
  });
  
  suite('checkForCircularDependencies()', () => {
    test('should detect circular dependency', () => {
      const path = ['moduleA', 'moduleB', 'moduleC'];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleB', path);
      
      assert.ok(conflict);
      assert.strictEqual(conflict.type, 'circular');
      assert.ok(conflict.details.includes('Circular dependency detected'));
      assert.ok(conflict.details.includes('moduleB -> moduleC -> moduleB'));
    });
    
    test('should not detect circular dependency when none exists', () => {
      const path = ['moduleA', 'moduleB', 'moduleC'];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleD', path);
      
      assert.strictEqual(conflict, null);
    });
    
    test('should handle empty path', () => {
      const path: string[] = [];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleA', path);
      
      assert.strictEqual(conflict, null);
    });
  });
});