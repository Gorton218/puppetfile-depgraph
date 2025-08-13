import { 
    getVersionDisplay, 
    formatVersionTransition, 
    createGitCacheKey,
    getArrayValueOrZero 
} from '../../src/utils/versionUtils';

describe('versionUtils', () => {
    describe('getVersionDisplay', () => {
        it('should return version string if provided', () => {
            expect(getVersionDisplay('1.2.3')).toBe('1.2.3');
            expect(getVersionDisplay('0.0.0')).toBe('0.0.0');
            expect(getVersionDisplay('')).toBe(''); // Empty string is preserved
        });

        it('should return "unversioned" for null', () => {
            expect(getVersionDisplay(null)).toBe('unversioned');
        });

        it('should return "unversioned" for undefined', () => {
            expect(getVersionDisplay(undefined)).toBe('unversioned');
        });

        it('should preserve falsy values that are not null/undefined', () => {
            expect(getVersionDisplay('')).toBe('');
            expect(getVersionDisplay('0')).toBe('0');
            expect(getVersionDisplay('false')).toBe('false');
        });
    });

    describe('formatVersionTransition', () => {
        it('should format version transition correctly', () => {
            expect(formatVersionTransition('1.0.0', '2.0.0')).toBe('1.0.0 → 2.0.0');
            expect(formatVersionTransition('0.9.1', '1.0.0')).toBe('0.9.1 → 1.0.0');
        });

        it('should handle undefined current version', () => {
            expect(formatVersionTransition(undefined, '2.0.0')).toBe('unversioned → 2.0.0');
        });

        it('should handle null current version', () => {
            expect(formatVersionTransition(null, '2.0.0')).toBe('unversioned → 2.0.0');
        });

        it('should preserve empty string as current version', () => {
            expect(formatVersionTransition('', '2.0.0')).toBe(' → 2.0.0');
        });

        it('should handle version with pre-release tags', () => {
            expect(formatVersionTransition('1.0.0-beta', '1.0.0')).toBe('1.0.0-beta → 1.0.0');
            expect(formatVersionTransition('2.0.0-rc.1', '2.0.0')).toBe('2.0.0-rc.1 → 2.0.0');
        });
    });

    describe('createGitCacheKey', () => {
        it('should create cache key with ref', () => {
            expect(createGitCacheKey('https://github.com/user/repo.git', 'main'))
                .toBe('https://github.com/user/repo.git:main');
            expect(createGitCacheKey('git@github.com:user/repo.git', 'v1.0.0'))
                .toBe('git@github.com:user/repo.git:v1.0.0');
        });

        it('should use "default" when ref is undefined', () => {
            expect(createGitCacheKey('https://github.com/user/repo.git'))
                .toBe('https://github.com/user/repo.git:default');
            expect(createGitCacheKey('https://github.com/user/repo.git', undefined))
                .toBe('https://github.com/user/repo.git:default');
        });

        it('should preserve empty string as ref', () => {
            expect(createGitCacheKey('https://github.com/user/repo.git', ''))
                .toBe('https://github.com/user/repo.git:');
        });

        it('should handle complex git URLs', () => {
            expect(createGitCacheKey('https://gitlab.com/group/subgroup/project.git', 'feature/branch'))
                .toBe('https://gitlab.com/group/subgroup/project.git:feature/branch');
            expect(createGitCacheKey('ssh://git@bitbucket.org:7999/project/repo.git', 'develop'))
                .toBe('ssh://git@bitbucket.org:7999/project/repo.git:develop');
        });
    });

    describe('getArrayValueOrZero', () => {
        it('should return numeric values directly', () => {
            const arr = [1, 2, 3, 4];
            expect(getArrayValueOrZero(arr, 0)).toBe(1);
            expect(getArrayValueOrZero(arr, 1)).toBe(2);
            expect(getArrayValueOrZero(arr, 3)).toBe(4);
        });

        it('should parse string numbers', () => {
            const arr = ['1', '2', '3', '10'];
            expect(getArrayValueOrZero(arr, 0)).toBe(1);
            expect(getArrayValueOrZero(arr, 1)).toBe(2);
            expect(getArrayValueOrZero(arr, 3)).toBe(10);
        });

        it('should return 0 for undefined indices', () => {
            const arr = [1, 2];
            expect(getArrayValueOrZero(arr, 5)).toBe(0);
            expect(getArrayValueOrZero(arr, -1)).toBe(0);
            expect(getArrayValueOrZero(arr, 100)).toBe(0);
        });

        it('should return 0 for non-numeric strings', () => {
            const arr = ['abc', 'def', ''];
            expect(getArrayValueOrZero(arr, 0)).toBe(0);
            expect(getArrayValueOrZero(arr, 1)).toBe(0);
            expect(getArrayValueOrZero(arr, 2)).toBe(0);
        });

        it('should handle mixed arrays', () => {
            const arr = [1, '2', undefined, 'abc', 5];
            expect(getArrayValueOrZero(arr, 0)).toBe(1);
            expect(getArrayValueOrZero(arr, 1)).toBe(2);
            expect(getArrayValueOrZero(arr, 2)).toBe(0);
            expect(getArrayValueOrZero(arr, 3)).toBe(0);
            expect(getArrayValueOrZero(arr, 4)).toBe(5);
        });

        it('should handle zero values correctly', () => {
            const arr = [0, '0', false, null];
            expect(getArrayValueOrZero(arr, 0)).toBe(0);
            expect(getArrayValueOrZero(arr, 1)).toBe(0);
            expect(getArrayValueOrZero(arr, 2)).toBe(0);
            expect(getArrayValueOrZero(arr, 3)).toBe(0);
        });
    });
});