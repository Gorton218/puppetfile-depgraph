import { VersionRequirement, VersionRange } from '../types/dependencyTypes';

export class VersionParser {
  private static versionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;
  
  static parse(constraint: string): VersionRequirement[] {
    const requirements: VersionRequirement[] = [];
    
    // Handle pessimistic constraint (~>)
    if (constraint.includes('~>')) {
      const match = /~>\s*(.+)/.exec(constraint);
      if (match) {
        const version = match[1].trim();
        const parts = version.split('.');
        if (parts.length >= 2) {
          requirements.push({ operator: '>=', version });
          
          // Calculate upper bound
          const major = parseInt(parts[0]);
          const minor = parseInt(parts[1]);
          const upperBound = `${major}.${minor + 1}.0`;
          requirements.push({ operator: '<', version: upperBound });
        }
      }
      return requirements;
    }
    
    // Handle wildcards (1.x, 1.x.x)
    if (constraint.includes('x')) {
      const parts = constraint.split('.');
      const nonWildcardParts: string[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'x') {break;}
        nonWildcardParts.push(parts[i]);
      }
      
      if (nonWildcardParts.length > 0) {
        const baseVersion = nonWildcardParts.join('.');
        requirements.push({ operator: '>=', version: baseVersion + '.0'.repeat(3 - nonWildcardParts.length) });
        
        if (nonWildcardParts.length === 1) {
          const major = parseInt(nonWildcardParts[0]);
          requirements.push({ operator: '<', version: `${major + 1}.0.0` });
        } else if (nonWildcardParts.length === 2) {
          const major = parseInt(nonWildcardParts[0]);
          const minor = parseInt(nonWildcardParts[1]);
          requirements.push({ operator: '<', version: `${major}.${minor + 1}.0` });
        }
      }
      return requirements;
    }
    
    // Handle compound constraints (>= 1.0.0 < 2.0.0)
    const operators = ['>=', '>', '<=', '<', '='];
    const pattern = new RegExp(`(${operators.join('|')})\\s*([\\d\\.]+(?:-[\\w\\.]+)?)`, 'g');
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
          // Exact version must be within existing range constraints
          // First check if the exact version violates existing constraints
          if (range.min) {
            const minCmp = this.compareVersions(req.version, range.min.version);
            if (minCmp < 0 || (minCmp === 0 && !range.min.inclusive)) {
              return null; // Exact version violates minimum constraint
            }
          }
          if (range.max) {
            const maxCmp = this.compareVersions(req.version, range.max.version);
            if (maxCmp > 0 || (maxCmp === 0 && !range.max.inclusive)) {
              return null; // Exact version violates maximum constraint
            }
          }
          // If we get here, the exact version is valid - set it as the only acceptable version
          range.min = { version: req.version, inclusive: true };
          range.max = { version: req.version, inclusive: true };
          break;
      }
    }
    
    // Check if range is valid
    if (range.min && range.max) {
      const cmp = this.compareVersions(range.min.version, range.max.version);
      if (cmp > 0) {return null;} // No intersection
      if (cmp === 0 && (!range.min.inclusive || !range.max.inclusive)) {return null;} // No intersection
    }
    
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
    
    const major1 = parseInt(parse1[1]);
    const major2 = parseInt(parse2[1]);
    if (major1 !== major2) {return major1 - major2;}
    
    const minor1 = parseInt(parse1[2]);
    const minor2 = parseInt(parse2[2]);
    if (minor1 !== minor2) {return minor1 - minor2;}
    
    const patch1 = parseInt(parse1[3]);
    const patch2 = parseInt(parse2[3]);
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
    
    if (range.min && range.max && range.min.version === range.max.version && range.min.inclusive && range.max.inclusive) {
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