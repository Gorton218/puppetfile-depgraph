import * as assert from 'assert';
import { suite, test } from 'mocha';
import { VersionParser } from '../utils/versionParser';
import { VersionRequirement } from '../types/dependencyTypes';

suite('VersionParser Test Suite', () => {
  
  suite('parse()', () => {
    test('should parse single >= constraint', () => {
      const result = VersionParser.parse('>= 1.0.0');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.0.0');
    });
    
    test('should parse single < constraint', () => {
      const result = VersionParser.parse('< 2.0.0');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].operator, '<');
      assert.strictEqual(result[0].version, '2.0.0');
    });
    
    test('should parse compound constraint', () => {
      const result = VersionParser.parse('>= 1.0.0 < 2.0.0');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.0.0');
      assert.strictEqual(result[1].operator, '<');
      assert.strictEqual(result[1].version, '2.0.0');
    });
    
    test('should parse pessimistic constraint', () => {
      const result = VersionParser.parse('~> 1.2.0');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.2.0');
      assert.strictEqual(result[1].operator, '<');
      assert.strictEqual(result[1].version, '1.3.0');
    });
    
    test('should parse wildcard constraint 1.x', () => {
      const result = VersionParser.parse('1.x');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.0.0');
      assert.strictEqual(result[1].operator, '<');
      assert.strictEqual(result[1].version, '2.0.0');
    });
    
    test('should parse wildcard constraint 1.2.x', () => {
      const result = VersionParser.parse('1.2.x');
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.2.0');
      assert.strictEqual(result[1].operator, '<');
      assert.strictEqual(result[1].version, '1.3.0');
    });
    
    test('should parse exact version constraint', () => {
      const result = VersionParser.parse('= 1.2.3');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].operator, '=');
      assert.strictEqual(result[0].version, '1.2.3');
    });
    
    test('should parse version without operator as exact', () => {
      const result = VersionParser.parse('1.2.3');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].operator, '=');
      assert.strictEqual(result[0].version, '1.2.3');
    });
    
    test('should handle pre-release versions', () => {
      const result = VersionParser.parse('>= 1.0.0-beta');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].operator, '>=');
      assert.strictEqual(result[0].version, '1.0.0-beta');
    });
  });
  
  suite('satisfies()', () => {
    test('should check >= constraint', () => {
      const req: VersionRequirement = { operator: '>=', version: '1.0.0' };
      assert.strictEqual(VersionParser.satisfies('1.0.0', req), true);
      assert.strictEqual(VersionParser.satisfies('1.0.1', req), true);
      assert.strictEqual(VersionParser.satisfies('2.0.0', req), true);
      assert.strictEqual(VersionParser.satisfies('0.9.9', req), false);
    });
    
    test('should check > constraint', () => {
      const req: VersionRequirement = { operator: '>', version: '1.0.0' };
      assert.strictEqual(VersionParser.satisfies('1.0.0', req), false);
      assert.strictEqual(VersionParser.satisfies('1.0.1', req), true);
      assert.strictEqual(VersionParser.satisfies('2.0.0', req), true);
      assert.strictEqual(VersionParser.satisfies('0.9.9', req), false);
    });
    
    test('should check < constraint', () => {
      const req: VersionRequirement = { operator: '<', version: '2.0.0' };
      assert.strictEqual(VersionParser.satisfies('1.9.9', req), true);
      assert.strictEqual(VersionParser.satisfies('2.0.0', req), false);
      assert.strictEqual(VersionParser.satisfies('2.0.1', req), false);
    });
    
    test('should check = constraint', () => {
      const req: VersionRequirement = { operator: '=', version: '1.2.3' };
      assert.strictEqual(VersionParser.satisfies('1.2.3', req), true);
      assert.strictEqual(VersionParser.satisfies('1.2.2', req), false);
      assert.strictEqual(VersionParser.satisfies('1.2.4', req), false);
    });
    
    test('should handle pre-release versions correctly', () => {
      const req: VersionRequirement = { operator: '>=', version: '1.0.0' };
      assert.strictEqual(VersionParser.satisfies('1.0.0-beta', req), false);
      assert.strictEqual(VersionParser.satisfies('1.0.0', req), true);
    });
  });
  
  suite('intersect()', () => {
    test('should find intersection of overlapping ranges', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.0.0' },
        { operator: '<', version: '9.0.0' },
        { operator: '>=', version: '8.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.ok(range);
      assert.strictEqual(range.min?.version, '8.0.0');
      assert.strictEqual(range.min?.inclusive, true);
      assert.strictEqual(range.max?.version, '9.0.0');
      assert.strictEqual(range.max?.inclusive, false);
    });
    
    test('should return null for non-overlapping ranges', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '6.0.0' },
        { operator: '<', version: '7.0.0' },
        { operator: '>=', version: '7.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.strictEqual(range, null);
    });
    
    test('should handle exact version constraints', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '1.0.0' },
        { operator: '=', version: '1.2.3' },
        { operator: '<', version: '2.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.ok(range);
      assert.strictEqual(range.min?.version, '1.2.3');
      assert.strictEqual(range.min?.inclusive, true);
      assert.strictEqual(range.max?.version, '1.2.3');
      assert.strictEqual(range.max?.inclusive, true);
    });
    
    test('should handle multiple >= constraints', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '1.0.0' },
        { operator: '>=', version: '1.5.0' },
        { operator: '>=', version: '1.2.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.ok(range);
      assert.strictEqual(range.min?.version, '1.5.0');
      assert.strictEqual(range.min?.inclusive, true);
      assert.strictEqual(range.max, undefined);
    });
  });
  
  suite('findSatisfyingVersions()', () => {
    test('should find versions satisfying all requirements', () => {
      const availableVersions = ['4.0.0', '5.0.0', '6.0.0', '7.0.0', '8.0.0', '8.5.0', '9.0.0', '10.0.0'];
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.0.0' },
        { operator: '<', version: '9.0.0' },
        { operator: '>=', version: '8.0.0' }
      ];
      
      const satisfying = VersionParser.findSatisfyingVersions(availableVersions, requirements);
      assert.deepStrictEqual(satisfying, ['8.0.0', '8.5.0']);
    });
    
    test('should return empty array when no versions satisfy', () => {
      const availableVersions = ['1.0.0', '2.0.0', '8.0.0'];
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '3.0.0' },
        { operator: '<', version: '4.0.0' }
      ];
      
      const satisfying = VersionParser.findSatisfyingVersions(availableVersions, requirements);
      assert.deepStrictEqual(satisfying, []);
    });
  });
  
  suite('compareVersions()', () => {
    test('should compare major versions', () => {
      assert.ok(VersionParser['compareVersions']('2.0.0', '1.0.0') > 0);
      assert.ok(VersionParser['compareVersions']('1.0.0', '2.0.0') < 0);
      assert.strictEqual(VersionParser['compareVersions']('1.0.0', '1.0.0'), 0);
    });
    
    test('should compare minor versions', () => {
      assert.ok(VersionParser['compareVersions']('1.2.0', '1.1.0') > 0);
      assert.ok(VersionParser['compareVersions']('1.1.0', '1.2.0') < 0);
    });
    
    test('should compare patch versions', () => {
      assert.ok(VersionParser['compareVersions']('1.0.2', '1.0.1') > 0);
      assert.ok(VersionParser['compareVersions']('1.0.1', '1.0.2') < 0);
    });
    
    test('should handle pre-release versions', () => {
      assert.ok(VersionParser['compareVersions']('1.0.0', '1.0.0-beta') > 0);
      assert.ok(VersionParser['compareVersions']('1.0.0-beta', '1.0.0') < 0);
      assert.ok(VersionParser['compareVersions']('1.0.0-beta2', '1.0.0-beta1') > 0);
    });
  });
  
  suite('formatRange()', () => {
    test('should format simple range', () => {
      const range = {
        min: { version: '1.0.0', inclusive: true },
        max: { version: '2.0.0', inclusive: false }
      };
      assert.strictEqual(VersionParser.formatRange(range), '>= 1.0.0 < 2.0.0');
    });
    
    test('should format exact version', () => {
      const range = {
        min: { version: '1.2.3', inclusive: true },
        max: { version: '1.2.3', inclusive: true }
      };
      assert.strictEqual(VersionParser.formatRange(range), '= 1.2.3');
    });
    
    test('should format open-ended range', () => {
      const range = {
        min: { version: '1.0.0', inclusive: true }
      };
      assert.strictEqual(VersionParser.formatRange(range), '>= 1.0.0');
    });
  });
});