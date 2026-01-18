import { ConflictAnalyzer } from '../../src/services/conflictAnalyzer';
import { Requirement } from '../../src/types/dependencyTypes';

describe('ConflictAnalyzer Test Suite', () => {
  
  describe('analyzeModule()', () => {
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
      
      expect(result.hasConflict).toBe(false);
      expect(result.satisfyingVersions).toBeTruthy();
      expect(result.satisfyingVersions).toEqual(['8.0.0', '8.5.0']);
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
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflict).toBeTruthy();
      expect(result.conflict!.type).toBe('no-intersection');
      expect(result.conflict!.details).toContain('No version of puppetlabs/concat satisfies all requirements');
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
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflict).toBeTruthy();
      expect(result.conflict!.type).toBe('no-available-version');
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
      
      expect(result.hasConflict).toBe(false);
      expect(result.satisfyingVersions).toBeTruthy();
      expect(result.satisfyingVersions).toEqual(['1.2.3']);
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
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflict).toBeTruthy();
      expect(result.conflict!.suggestedFixes.length).toBeGreaterThan(0);
    });
  });
  
  describe('checkForCircularDependencies()', () => {
    test('should detect circular dependency', () => {
      const path = ['moduleA', 'moduleB', 'moduleC'];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleB', path);
      
      expect(conflict).toBeTruthy();
      expect(conflict!.type).toBe('circular');
      expect(conflict!.details).toContain('Circular dependency detected');
      expect(conflict!.details).toContain('moduleB -> moduleC -> moduleB');
    });
    
    test('should not detect circular dependency when none exists', () => {
      const path = ['moduleA', 'moduleB', 'moduleC'];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleD', path);
      
      expect(conflict).toBeNull();
    });
    
    test('should handle empty path', () => {
      const path: string[] = [];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleA', path);
      
      expect(conflict).toBeNull();
    });
    
    test('should suggest removing the last module in cycle', () => {
      const path = ['moduleA', 'moduleB', 'moduleC', 'moduleD'];
      const conflict = ConflictAnalyzer.checkForCircularDependencies('moduleB', path);
      
      expect(conflict).toBeTruthy();
      expect(conflict!.suggestedFixes).toHaveLength(1);
      expect(conflict!.suggestedFixes[0].module).toBe('moduleD');
      expect(conflict!.suggestedFixes[0].suggestedVersion).toBe('none');
      expect(conflict!.suggestedFixes[0].reason).toContain('break the circular reference');
    });
  });
});