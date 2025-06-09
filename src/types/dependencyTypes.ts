export interface VersionRequirement {
  operator: '>=' | '>' | '<=' | '<' | '=' | '~>';
  version: string;
}

export interface VersionRange {
  min?: { version: string; inclusive: boolean };
  max?: { version: string; inclusive: boolean };
}

export interface Requirement {
  constraint: string;           // e.g., ">= 4.0.0 < 9.0.0"
  imposedBy: string;           // e.g., "puppetlabs/apache"
  path: string[];              // e.g., ["myapp", "apache", "stdlib"]
  isDirectDependency: boolean; // true if in Puppetfile
}

export interface Fix {
  module: string;
  currentVersion: string;
  suggestedVersion: string;
  reason: string;
}

export interface DependencyConflict {
  type: 'no-intersection' | 'no-available-version' | 'circular';
  details: string;
  suggestedFixes: Fix[];
}

export interface DependencyInfo {
  requirements: Requirement[];
  mergedConstraint?: VersionRange;
  availableVersions?: string[];
  satisfyingVersions?: string[];
  currentVersion?: string;
  conflict?: DependencyConflict;
}

export interface DependencyGraph {
  [moduleName: string]: DependencyInfo;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: DependencyConflict;
  satisfyingVersions?: string[];
  mergedConstraint?: VersionRange;
}