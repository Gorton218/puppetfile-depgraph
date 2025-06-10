import { PuppetForgeService } from '../puppetForgeService';
import { VersionRequirement, VersionRange } from '../types/dependencyTypes';

export class VersionParser {
    /**
     * Parse a version constraint string into a list of requirements.
     * Supported formats include:
     *   '>= 1.0.0 < 2.0.0'
     *   '~> 1.2.0'
     *   '1.x'
     *   '= 1.2.3'
     */
    public static parse(constraint: string): VersionRequirement[] {
        const reqs: VersionRequirement[] = [];
        const tokens = constraint.trim().split(/\s+/);
        for (let i = 0; i < tokens.length; ) {
            const token = tokens[i];
            if (token === '~>') {
                const ver = tokens[i + 1];
                if (ver) {
                    reqs.push({ operator: '>=', version: ver });
                    const next = this.incrementMinor(ver);
                    reqs.push({ operator: '<', version: next });
                }
                i += 2;
                continue;
            }

            if (/^\d+\.x(\.x)?$/.test(token)) {
                const major = parseInt(token.split('.')[0], 10);
                reqs.push({ operator: '>=', version: `${major}.0.0` });
                reqs.push({ operator: '<', version: `${major + 1}.0.0` });
                i += 1;
                continue;
            }

            const op = token as VersionRequirement['operator'];
            const ver = tokens[i + 1];
            if (['>=', '>', '<=', '<', '='].includes(op) && ver) {
                reqs.push({ operator: op, version: ver });
                i += 2;
            } else {
                // Fallback to exact version
                reqs.push({ operator: '=', version: token });
                i += 1;
            }
        }
        return reqs;
    }

    /**
     * Check if a version satisfies all given requirements.
     */
    public static satisfies(version: string, requirements: VersionRequirement[]): boolean {
        return requirements.every(req => this.check(version, req));
    }

    /**
     * Find the intersection of multiple requirements.
     */
    public static intersect(requirements: VersionRequirement[]): VersionRange | null {
        let min: string | undefined;
        let max: string | undefined;
        for (const req of requirements) {
            if (req.operator === '>=' || req.operator === '>') {
                if (!min || PuppetForgeService.compareVersions(req.version, min) > 0) {
                    min = req.version;
                }
            } else if (req.operator === '<=' || req.operator === '<') {
                if (!max || PuppetForgeService.compareVersions(req.version, max) < 0) {
                    max = req.version;
                }
            } else if (req.operator === '=') {
                if (!min || PuppetForgeService.compareVersions(req.version, min) > 0) {
                    min = req.version;
                }
                if (!max || PuppetForgeService.compareVersions(req.version, max) < 0) {
                    max = req.version;
                }
            }
        }

        if (min && max && PuppetForgeService.compareVersions(min, max) > 0) {
            return null;
        }
        return { min, max };
    }

    private static check(version: string, req: VersionRequirement): boolean {
        const cmp = PuppetForgeService.compareVersions(version, req.version);
        switch (req.operator) {
            case '>':
                return cmp > 0;
            case '>=':
                return cmp >= 0;
            case '<':
                return cmp < 0;
            case '<=':
                return cmp <= 0;
            case '=':
                return cmp === 0;
            default:
                return false;
        }
    }

    private static incrementMinor(version: string): string {
        const parts = version.split('.').map(p => parseInt(p, 10));
        const major = parts[0] || 0;
        const minor = (parts[1] || 0) + 1;
        return `${major}.${minor}.0`;
    }
}
