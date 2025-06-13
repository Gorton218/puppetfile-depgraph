import * as assert from 'assert';
import { suite, test } from 'mocha';
import { VersionParser } from '../utils/versionParser';
import { VersionRequirement } from '../types/dependencyTypes';

interface ParseTestCase {
  input: string;
  expected: VersionRequirement[];
}

interface SatisfiesTestCase {
  version: string;
  requirement: VersionRequirement;
  expected: boolean;
}

interface CompareTestCase {
  v1: string;
  v2: string;
  expectedSign: number; // -1, 0, or 1
}

suite('VersionParser Test Suite', () => {
  
  suite('parse()', () => {
    const parseTestCases: ParseTestCase[] = [
      {
        input: '>= 1.0.0',
        expected: [{ operator: '>=', version: '1.0.0' }]
      },
      {
        input: '< 2.0.0',
        expected: [{ operator: '<', version: '2.0.0' }]
      },
      {
        input: '>= 1.0.0 < 2.0.0',
        expected: [
          { operator: '>=', version: '1.0.0' },
          { operator: '<', version: '2.0.0' }
        ]
      },
      {
        input: '~> 1.2.0',
        expected: [
          { operator: '>=', version: '1.2.0' },
          { operator: '<', version: '1.3.0' }
        ]
      },
      {
        input: '1.x',
        expected: [
          { operator: '>=', version: '1.0.0' },
          { operator: '<', version: '2.0.0' }
        ]
      },
      {
        input: '1.2.x',
        expected: [
          { operator: '>=', version: '1.2.0' },
          { operator: '<', version: '1.3.0' }
        ]
      },
      {
        input: '= 1.2.3',
        expected: [{ operator: '=', version: '1.2.3' }]
      },
      {
        input: '1.2.3',
        expected: [{ operator: '=', version: '1.2.3' }]
      },
      {
        input: '>= 1.0.0-beta',
        expected: [{ operator: '>=', version: '1.0.0-beta' }]
      }
    ];

    parseTestCases.forEach(({ input, expected }) => {
      test(`should parse '${input}'`, () => {
        const result = VersionParser.parse(input);
        assert.strictEqual(result.length, expected.length);
        expected.forEach((exp, i) => {
          assert.strictEqual(result[i].operator, exp.operator);
          assert.strictEqual(result[i].version, exp.version);
        });
      });
    });
  });
  
  suite('satisfies()', () => {
    const satisfiesTestCases: SatisfiesTestCase[] = [
      // >= constraint tests
      { version: '1.0.0', requirement: { operator: '>=', version: '1.0.0' }, expected: true },
      { version: '1.0.1', requirement: { operator: '>=', version: '1.0.0' }, expected: true },
      { version: '2.0.0', requirement: { operator: '>=', version: '1.0.0' }, expected: true },
      { version: '0.9.9', requirement: { operator: '>=', version: '1.0.0' }, expected: false },
      // > constraint tests
      { version: '1.0.0', requirement: { operator: '>', version: '1.0.0' }, expected: false },
      { version: '1.0.1', requirement: { operator: '>', version: '1.0.0' }, expected: true },
      { version: '2.0.0', requirement: { operator: '>', version: '1.0.0' }, expected: true },
      { version: '0.9.9', requirement: { operator: '>', version: '1.0.0' }, expected: false },
      // < constraint tests
      { version: '1.9.9', requirement: { operator: '<', version: '2.0.0' }, expected: true },
      { version: '2.0.0', requirement: { operator: '<', version: '2.0.0' }, expected: false },
      { version: '2.0.1', requirement: { operator: '<', version: '2.0.0' }, expected: false },
      // = constraint tests
      { version: '1.2.3', requirement: { operator: '=', version: '1.2.3' }, expected: true },
      { version: '1.2.2', requirement: { operator: '=', version: '1.2.3' }, expected: false },
      { version: '1.2.4', requirement: { operator: '=', version: '1.2.3' }, expected: false },
      // pre-release tests
      { version: '1.0.0-beta', requirement: { operator: '>=', version: '1.0.0' }, expected: false },
      { version: '1.0.0', requirement: { operator: '>=', version: '1.0.0' }, expected: true }
    ];

    satisfiesTestCases.forEach(({ version, requirement, expected }) => {
      test(`should check '${version}' ${requirement.operator} '${requirement.version}' = ${expected}`, () => {
        assert.strictEqual(VersionParser.satisfies(version, requirement), expected);
      });
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

    // Test cases for the exact version intersection bug fix
    test('should reject exact version that violates upper bound', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '9.4.1' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.strictEqual(range, null, 'Should return null when exact version violates upper bound');
    });
    
    test('should reject exact version that violates lower bound', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '3.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.strictEqual(range, null, 'Should return null when exact version violates lower bound');
    });
    
    test('should accept exact version within bounds', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '5.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.ok(range, 'Should return valid range when exact version is within bounds');
      assert.strictEqual(range.min?.version, '5.0.0');
      assert.strictEqual(range.max?.version, '5.0.0');
      assert.strictEqual(range.min?.inclusive, true);
      assert.strictEqual(range.max?.inclusive, true);
    });
    
    test('should accept exact version at inclusive lower boundary', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '4.13.1' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.ok(range, 'Should accept exact version at inclusive lower boundary');
      assert.strictEqual(range.min?.version, '4.13.1');
      assert.strictEqual(range.max?.version, '4.13.1');
    });
    
    test('should reject exact version at exclusive upper boundary', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>=', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '7.0.0' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.strictEqual(range, null, 'Should reject exact version at exclusive upper boundary');
    });
    
    test('should reject exact version at exclusive lower boundary', () => {
      const requirements: VersionRequirement[] = [
        { operator: '>', version: '4.13.1' },
        { operator: '<', version: '7.0.0' },
        { operator: '=', version: '4.13.1' }
      ];
      
      const range = VersionParser.intersect(requirements);
      assert.strictEqual(range, null, 'Should reject exact version at exclusive lower boundary');
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
    const compareTestCases: CompareTestCase[] = [
      // Major version comparisons
      { v1: '2.0.0', v2: '1.0.0', expectedSign: 1 },
      { v1: '1.0.0', v2: '2.0.0', expectedSign: -1 },
      { v1: '1.0.0', v2: '1.0.0', expectedSign: 0 },
      // Minor version comparisons
      { v1: '1.2.0', v2: '1.1.0', expectedSign: 1 },
      { v1: '1.1.0', v2: '1.2.0', expectedSign: -1 },
      // Patch version comparisons
      { v1: '1.0.2', v2: '1.0.1', expectedSign: 1 },
      { v1: '1.0.1', v2: '1.0.2', expectedSign: -1 },
      // Pre-release comparisons
      { v1: '1.0.0', v2: '1.0.0-beta', expectedSign: 1 },
      { v1: '1.0.0-beta', v2: '1.0.0', expectedSign: -1 },
      { v1: '1.0.0-beta2', v2: '1.0.0-beta1', expectedSign: 1 }
    ];

    compareTestCases.forEach(({ v1, v2, expectedSign }) => {
      test(`should compare '${v1}' ${expectedSign > 0 ? '>' : expectedSign < 0 ? '<' : '='} '${v2}'`, () => {
        const result = VersionParser['compareVersions'](v1, v2);
        if (expectedSign > 0) {
          assert.ok(result > 0);
        } else if (expectedSign < 0) {
          assert.ok(result < 0);
        } else {
          assert.strictEqual(result, 0);
        }
      });
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