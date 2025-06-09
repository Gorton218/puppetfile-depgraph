export interface Fix {
    title: string;
    command: string;
}

export interface DependencyGraph {
    [moduleName: string]: {
        requirements: Array<{
            constraint: string;
            imposedBy: string;
            path: string[];
            isDirectDependency: boolean;
        }>;
        mergedConstraint?: VersionRange;
        availableVersions?: string[];
        satisfyingVersions?: string[];
        currentVersion?: string;
        conflict?: {
            type: 'no-intersection' | 'no-available-version' | 'circular';
            details: string;
            suggestedFixes: Fix[];
        };
    };
}

export interface VersionRequirement {
    operator: '>=' | '>' | '<=' | '<' | '=';
    version: string;
}

export interface VersionRange {
    min?: string;
    max?: string;
}
