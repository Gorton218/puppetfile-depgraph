import { VersionParser } from '../utils/versionParser';
import { 
  Requirement, 
  ConflictResult, 
  DependencyConflict, 
  Fix,
  VersionRequirement 
} from '../types/dependencyTypes';

export class ConflictAnalyzer {
  static analyzeModule(
    moduleName: string,
    requirements: Requirement[],
    availableVersions: string[]
  ): ConflictResult {
    // Step 1: Parse all requirement strings
    const parsedRequirements: VersionRequirement[] = [];
    const requirementMap = new Map<string, Requirement[]>();
    
    for (const req of requirements) {
      const parsed = VersionParser.parse(req.constraint);
      parsedRequirements.push(...parsed);
      
      // Group requirements by imposing module
      if (!requirementMap.has(req.imposedBy)) {
        requirementMap.set(req.imposedBy, []);
      }
      requirementMap.get(req.imposedBy)!.push(req);
    }
    
    // Step 2: Find intersection of all requirements
    const mergedConstraint = VersionParser.intersect(parsedRequirements);
    
    // Step 3: If no intersection, return 'no-intersection' conflict
    if (!mergedConstraint) {
      const conflict: DependencyConflict = {
        type: 'no-intersection',
        details: this.formatNoIntersectionDetails(moduleName, requirements),
        suggestedFixes: this.generateFixesForNoIntersection(moduleName, requirements, availableVersions)
      };
      
      return {
        hasConflict: true,
        conflict,
        mergedConstraint: undefined
      };
    }
    
    // Step 4: Check which available versions satisfy all requirements
    const satisfyingVersions = VersionParser.findSatisfyingVersions(availableVersions, parsedRequirements);
    
    // Step 5: If none, return 'no-available-version' conflict
    if (satisfyingVersions.length === 0) {
      const conflict: DependencyConflict = {
        type: 'no-available-version',
        details: this.formatNoAvailableVersionDetails(moduleName, mergedConstraint, availableVersions),
        suggestedFixes: this.generateFixesForNoAvailableVersion(moduleName, requirements, mergedConstraint, availableVersions)
      };
      
      return {
        hasConflict: true,
        conflict,
        mergedConstraint
      };
    }
    
    // Step 6: Return success with satisfying versions
    return {
      hasConflict: false,
      satisfyingVersions,
      mergedConstraint
    };
  }
  
  private static formatNoIntersectionDetails(moduleName: string, requirements: Requirement[]): string {
    const lines: string[] = [`No version of ${moduleName} satisfies all requirements:`];
    
    for (const req of requirements) {
      lines.push(`  - ${req.imposedBy} requires ${req.constraint}`);
    }
    
    return lines.join('\n');
  }
  
  private static formatNoAvailableVersionDetails(
    moduleName: string, 
    mergedConstraint: any,
    availableVersions: string[]
  ): string {
    const constraintStr = VersionParser.formatRange(mergedConstraint);
    const latest = availableVersions.length > 0 ? availableVersions.at(-1) : 'none';
    
    return `${moduleName} requires ${constraintStr}, but only versions ${availableVersions.slice(0, 3).join(', ')}${availableVersions.length > 3 ? '...' : ''} are available (latest: ${latest})`;
  }
  
  private static generateFixesForNoIntersection(
    moduleName: string,
    requirements: Requirement[],
    availableVersions: string[]
  ): Fix[] {
    const fixes: Fix[] = [];
    
    // Group requirements by constraint to find conflicting modules
    const constraintGroups = new Map<string, Requirement[]>();
    for (const req of requirements) {
      if (!constraintGroups.has(req.constraint)) {
        constraintGroups.set(req.constraint, []);
      }
      constraintGroups.get(req.constraint)!.push(req);
    }
    
    // If we have two distinct constraint groups, suggest updating one
    if (constraintGroups.size === 2) {
      const groups = Array.from(constraintGroups.values());
      const [group1, group2] = groups;
      
      // Analyze which group has more restrictive constraints
      const parsed1 = VersionParser.parse(group1[0].constraint);
      const parsed2 = VersionParser.parse(group2[0].constraint);
      
      // Check if updating modules in one group might resolve the conflict
      for (const req of group1) {
        if (!req.isDirectDependency) {
          fixes.push({
            module: req.imposedBy,
            currentVersion: 'current',
            suggestedVersion: 'latest',
            reason: `Update to a version that accepts ${moduleName} ${group2[0].constraint}`
          });
        }
      }
    }
    
    return fixes;
  }
  
  private static generateFixesForNoAvailableVersion(
    moduleName: string,
    requirements: Requirement[],
    mergedConstraint: any,
    availableVersions: string[]
  ): Fix[] {
    const fixes: Fix[] = [];
    
    // Suggest relaxing constraints if possible
    const latest = availableVersions.length > 0 ? availableVersions.at(-1) : null;
    
    if (latest && mergedConstraint.max && VersionParser['compareVersions'](latest, mergedConstraint.max.version) < 0) {
      // Latest available is older than required minimum
      for (const req of requirements) {
        if (req.constraint.includes('>=') || req.constraint.includes('>')) {
          fixes.push({
            module: req.imposedBy,
            currentVersion: 'current',
            suggestedVersion: 'previous',
            reason: `Downgrade to a version that accepts ${moduleName} <= ${latest}`
          });
        }
      }
    }
    
    return fixes;
  }
  
  static checkForCircularDependencies(
    moduleName: string,
    path: string[]
  ): DependencyConflict | null {
    const index = path.indexOf(moduleName);
    if (index !== -1 && index < path.length - 1) {
      // Found circular dependency
      const cycle = path.slice(index);
      return {
        type: 'circular',
        details: `Circular dependency detected: ${cycle.join(' -> ')} -> ${moduleName}`,
        suggestedFixes: [{
          module: cycle.at(-1)!,
          currentVersion: 'current',
          suggestedVersion: 'none',
          reason: 'Remove this dependency to break the circular reference'
        }]
      };
    }
    return null;
  }
}