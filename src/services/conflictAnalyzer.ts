import { PuppetForgeService } from '../puppetForgeService';
import { VersionParser } from '../utils/versionParser';
import { VersionRequirement } from '../types/dependencyTypes';

export interface Requirement {
    requirement: string;
    imposedBy: string;
}

export interface ConflictResult {
    satisfyingVersions: string[];
    conflict?: {
        type: 'no-intersection' | 'no-available-version';
        details: string;
    };
}

export class ConflictAnalyzer {
    public static analyzeModule(
        moduleName: string,
        requirements: Requirement[],
        availableVersions: string[]
    ): ConflictResult {
        const parsed: VersionRequirement[] = [];
        for (const r of requirements) {
            parsed.push(...VersionParser.parse(r.requirement));
        }

        const range = VersionParser.intersect(parsed);
        if (!range) {
            return {
                satisfyingVersions: [],
                conflict: {
                    type: 'no-intersection',
                    details: 'Requirements have no common version'
                }
            };
        }

        const satisfying = availableVersions.filter(v => VersionParser.satisfies(v, parsed));
        if (satisfying.length === 0) {
            return {
                satisfyingVersions: [],
                conflict: {
                    type: 'no-available-version',
                    details: 'No available versions satisfy all requirements'
                }
            };
        }

        return { satisfyingVersions: satisfying };
    }
}
