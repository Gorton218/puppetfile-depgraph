import { VersionRequirement, VersionRange } from '../types/dependencyTypes';

export class VersionParser {
  private static readonly versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;
  
  static parse(constraint: string): VersionRequirement[] {
    // Handle pessimistic constraint (~>)
    if (constraint.includes('~>')) {
      return this.parsePessimistic(constraint);
    }

    // Handle wildcards (1.x, 1.x.x)
    if (constraint.includes('x')) {
      return this.parseWildcard(constraint);
    }

    // Handle compound constraints (>= 1.0.0 < 2.0.0)
    return this.parseCompound(constraint);
  }

  private static parsePessimistic(constraint: string): VersionRequirement[] {
    const match = /~>\s*(.+)/.exec(constraint);
    if (!match) {
      return [];
    }

    const version = match[1].trim();
    const parts = version.split('.');
    if (parts.length < 2) {
      return [];
    }

    const major = Number.parseInt(parts[0], 10);
    const minor = Number.parseInt(parts[1], 10);
    return [
      { operator: '>=', version },
      { operator: '<', version: `${major}.${minor + 1}.0` }
    ];
  }

  private static parseWildcard(constraint: string): VersionRequirement[] {
    const parts = constraint.split('.');
    const nonWildcardParts: string[] = [];

    for (const part of parts) {
      if (part === 'x') {break;}
      nonWildcardParts.push(part);
    }

    if (nonWildcardParts.length === 0) {
      return [];
    }

    const baseVersion = nonWildcardParts.join('.');
    const requirements: VersionRequirement[] = [
      { operator: '>=', version: baseVersion + '.0'.repeat(3 - nonWildcardParts.length) }
    ];

    if (nonWildcardParts.length === 1) {
      const major = Number.parseInt(nonWildcardParts[0], 10);
      requirements.push({ operator: '<', version: `${major + 1}.0.0` });
    } else if (nonWildcardParts.length === 2) {
      const major = Number.parseInt(nonWildcardParts[0], 10);
      const minor = Number.parseInt(nonWildcardParts[1], 10);
      requirements.push({ operator: '<', version: `${major}.${minor + 1}.0` });
    }

    return requirements;
  }

  private static parseCompound(constraint: string): VersionRequirement[] {
    const operators = ['>=', '>', '<=', '<', '='];
    const pattern = new RegExp(String.raw`(${operators.join('|')})\s*([\d\.]+(?:-[\w\.]+)?)`, 'g');
    const requirements: VersionRequirement[] = [];
    let match;

    while ((match = pattern.exec(constraint)) !== null) {
      requirements.push({
        operator: match[1] as VersionRequirement['operator'],
        version: match[2]
      });
    }

    // If no operators found, assume exact version
    if (requirements.length === 0 && /^\d+\.\d+\.\d+/.test(constraint.trim())) {
      requirements.push({ operator: '=', version: constraint.trim() });
    }

    return requirements;
  }
  
  static satisfies(version: string, requirement: VersionRequirement): boolean {
    const cmp = this.compareVersions(version, requirement.version);
    
    switch (requirement.operator) {
      case '>=': return cmp >= 0;
      case '>': return cmp > 0;
      case '<=': return cmp <= 0;
      case '<': return cmp < 0;
      case '=': return cmp === 0;
      case '~>': 
        // Pessimistic constraint is handled by parse() converting to >= and <
        return false;
      default:
        return false;
    }
  }
  
  static satisfiesAll(version: string, requirements: VersionRequirement[]): boolean {
    return requirements.every(req => this.satisfies(version, req));
  }
  
  static intersect(requirements: VersionRequirement[]): VersionRange | null {
    if (requirements.length === 0) {return null;}

    let range: VersionRange = {};

    for (const req of requirements) {
      const result = this.applyRequirementToRange(req, range);
      if (result === null) {
        return null;
      }
      range = result;
    }

    // Check if range is valid
    if (range.min && range.max) {
      const cmp = this.compareVersions(range.min.version, range.max.version);
      if (cmp > 0) {return null;}
      if (cmp === 0 && (!range.min.inclusive || !range.max.inclusive)) {return null;}
    }

    return range;
  }

  private static applyRequirementToRange(req: VersionRequirement, range: VersionRange): VersionRange | null {
    switch (req.operator) {
      case '>=':
        if (!range.min || this.compareVersions(req.version, range.min.version) > 0) {
          range.min = { version: req.version, inclusive: true };
        }
        break;
      case '>':
        if (!range.min || this.compareVersions(req.version, range.min.version) >= 0) {
          range.min = { version: req.version, inclusive: false };
        }
        break;
      case '<=':
        if (!range.max || this.compareVersions(req.version, range.max.version) < 0) {
          range.max = { version: req.version, inclusive: true };
        }
        break;
      case '<':
        if (!range.max || this.compareVersions(req.version, range.max.version) <= 0) {
          range.max = { version: req.version, inclusive: false };
        }
        break;
      case '=':
        return this.applyExactVersion(req.version, range);
    }
    return range;
  }

  private static applyExactVersion(version: string, range: VersionRange): VersionRange | null {
    if (range.min) {
      const minCmp = this.compareVersions(version, range.min.version);
      if (minCmp < 0 || (minCmp === 0 && !range.min.inclusive)) {
        return null;
      }
    }
    if (range.max) {
      const maxCmp = this.compareVersions(version, range.max.version);
      if (maxCmp > 0 || (maxCmp === 0 && !range.max.inclusive)) {
        return null;
      }
    }
    range.min = { version, inclusive: true };
    range.max = { version, inclusive: true };
    return range;
  }
  
  static isVersionInRange(version: string, range: VersionRange): boolean {
    if (range.min) {
      const cmp = this.compareVersions(version, range.min.version);
      if (cmp < 0 || (cmp === 0 && !range.min.inclusive)) {return false;}
    }
    
    if (range.max) {
      const cmp = this.compareVersions(version, range.max.version);
      if (cmp > 0 || (cmp === 0 && !range.max.inclusive)) {return false;}
    }
    
    return true;
  }
  
  static findSatisfyingVersions(availableVersions: string[], requirements: VersionRequirement[]): string[] {
    const range = this.intersect(requirements);
    if (!range) {return [];}
    
    return availableVersions.filter(version => this.isVersionInRange(version, range));
  }
  
  private static compareVersions(v1: string, v2: string): number {
    const parse1 = this.versionRegex.exec(v1);
    const parse2 = this.versionRegex.exec(v2);
    
    if (!parse1 || !parse2) {
      return v1.localeCompare(v2);
    }
    
    const major1 = Number.parseInt(parse1[1], 10);
    const major2 = Number.parseInt(parse2[1], 10);
    if (major1 !== major2) {return major1 - major2;}
    
    const minor1 = Number.parseInt(parse1[2], 10);
    const minor2 = Number.parseInt(parse2[2], 10);
    if (minor1 !== minor2) {return minor1 - minor2;}
    
    const patch1 = Number.parseInt(parse1[3], 10);
    const patch2 = Number.parseInt(parse2[3], 10);
    if (patch1 !== patch2) {return patch1 - patch2;}
    
    // Handle pre-release versions
    const pre1 = parse1[4] ?? '';
    const pre2 = parse2[4] ?? '';
    
    if (!pre1 && pre2) {return 1;} // 1.0.0 > 1.0.0-beta
    if (pre1 && !pre2) {return -1;} // 1.0.0-beta < 1.0.0
    
    return pre1.localeCompare(pre2);
  }
  
  static formatRange(range: VersionRange): string {
    if (!range.min && !range.max) {return 'any version';}
    
    const parts: string[] = [];
    
    if (range.min?.version === range.max?.version && range.min?.inclusive && range.max?.inclusive) {
      return `= ${range.min.version}`;
    }
    
    if (range.min) {
      parts.push(`${range.min.inclusive ? '>=' : '>'} ${range.min.version}`);
    }
    
    if (range.max) {
      parts.push(`${range.max.inclusive ? '<=' : '<'} ${range.max.version}`);
    }
    
    return parts.join(' ');
  }
}