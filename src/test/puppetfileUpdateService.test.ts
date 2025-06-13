import * as assert from 'assert';
import { PuppetfileUpdateService } from '../puppetfileUpdateService';

interface TestCase {
    description: string;
    input: string;
    newVersion: string;
    expected: string;
}

suite('PuppetfileUpdateService Test Suite', () => {
    const updateVersionTestCases: TestCase[] = [
        {
            description: 'update forge module version',
            input: "mod 'puppetlabs-stdlib', '9.4.1'",
            newVersion: '9.5.0',
            expected: "mod 'puppetlabs-stdlib', '9.5.0'"
        },
        {
            description: 'update forge module version with inline comment',
            input: "mod 'puppetlabs-mongodb', '0.17.0' # Example of commit",
            newVersion: '0.18.0',
            expected: "mod 'puppetlabs-mongodb', '0.18.0' # Example of commit"
        },
        {
            description: 'add version to forge module without version',
            input: "mod 'puppetlabs-apache'",
            newVersion: '2.11.0',
            expected: "mod 'puppetlabs-apache', '2.11.0'"
        },
        {
            description: 'add version to forge module without version but with comment',
            input: "mod 'puppetlabs-mysql' # No version specified",
            newVersion: '16.2.0',
            expected: "mod 'puppetlabs-mysql', '16.2.0' # No version specified"
        },
        {
            description: 'update git module tag',
            input: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'",
            newVersion: 'v1.1.0',
            expected: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0'"
        },
        {
            description: 'update git module tag with inline comment',
            input: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0' # Stable release",
            newVersion: 'v1.1.0',
            expected: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0' # Stable release"
        },
        {
            description: 'update git module ref',
            input: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main'",
            newVersion: 'develop',
            expected: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop'"
        },
        {
            description: 'update git module ref with inline comment',
            input: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main' # Main branch",
            newVersion: 'develop',
            expected: "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop' # Main branch"
        }
    ];

    updateVersionTestCases.forEach(testCase => {
        test(`updateVersionInLine should ${testCase.description}`, () => {
            const result = PuppetfileUpdateService['updateVersionInLine'](testCase.input, testCase.newVersion);
            assert.strictEqual(result, testCase.expected);
        });
    });

    const edgeCaseTestCases: TestCase[] = [
        {
            description: 'handle double quotes',
            input: 'mod "puppetlabs-stdlib", "9.4.1" # With double quotes',
            newVersion: '9.5.0',
            expected: 'mod "puppetlabs-stdlib", \'9.5.0\' # With double quotes'
        },
        {
            description: 'handle mixed quotes',
            input: "mod \"puppetlabs-stdlib\", '9.4.1' # Mixed quotes",
            newVersion: '9.5.0',
            expected: "mod \"puppetlabs-stdlib\", '9.5.0' # Mixed quotes"
        },
        {
            description: 'preserve whitespace around comments',
            input: "mod 'puppetlabs-stdlib', '9.4.1'    # Lots of spaces",
            newVersion: '9.5.0',
            expected: "mod 'puppetlabs-stdlib', '9.5.0'    # Lots of spaces"
        },
        {
            description: 'handle comment without spaces',
            input: "mod 'puppetlabs-stdlib', '9.4.1'#NoSpaces",
            newVersion: '9.5.0',
            expected: "mod 'puppetlabs-stdlib', '9.5.0'#NoSpaces"
        },
        {
            description: 'not modify non-module lines',
            input: "forge 'https://forgeapi.puppet.com' # Comment",
            newVersion: '9.5.0',
            expected: "forge 'https://forgeapi.puppet.com' # Comment"
        },
        {
            description: 'not modify comment-only lines',
            input: "# This is just a comment",
            newVersion: '9.5.0',
            expected: "# This is just a comment"
        }
    ];

    edgeCaseTestCases.forEach(testCase => {
        test(`updateVersionInLine should ${testCase.description}`, () => {
            const result = PuppetfileUpdateService['updateVersionInLine'](testCase.input, testCase.newVersion);
            assert.strictEqual(result, testCase.expected);
        });
    });
});