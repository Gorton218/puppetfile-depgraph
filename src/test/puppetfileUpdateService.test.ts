import * as assert from 'assert';
import { PuppetfileUpdateService } from '../puppetfileUpdateService';

interface TestCase {
    description: string;
    input: string;
    newVersion: string;
    expected: string;
}

suite('PuppetfileUpdateService Test Suite', () => {
    const createTestCase = (description: string, input: string, newVersion: string, expected: string): TestCase => ({
        description,
        input,
        newVersion,
        expected
    });

    const runTestCases = (testCases: TestCase[]) => {
        testCases.forEach(testCase => {
            test(`updateVersionInLine should ${testCase.description}`, () => {
                const result = PuppetfileUpdateService['updateVersionInLine'](testCase.input, testCase.newVersion);
                assert.strictEqual(result, testCase.expected);
            });
        });
    };

    const updateVersionTestCases: TestCase[] = [
        createTestCase(
            'update forge module version',
            "mod 'puppetlabs-stdlib', '9.4.1'",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'"
        ),
        createTestCase(
            'update forge module version with inline comment',
            "mod 'puppetlabs-mongodb', '0.17.0' # Example of commit",
            '0.18.0',
            "mod 'puppetlabs-mongodb', '0.18.0' # Example of commit"
        ),
        createTestCase(
            'add version to forge module without version',
            "mod 'puppetlabs-apache'",
            '2.11.0',
            "mod 'puppetlabs-apache', '2.11.0'"
        ),
        createTestCase(
            'add version to forge module without version but with comment',
            "mod 'puppetlabs-mysql' # No version specified",
            '16.2.0',
            "mod 'puppetlabs-mysql', '16.2.0' # No version specified"
        ),
        createTestCase(
            'update git module tag',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0'",
            'v1.1.0',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0'"
        ),
        createTestCase(
            'update git module tag with inline comment',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.0.0' # Stable release",
            'v1.1.0',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :tag => 'v1.1.0' # Stable release"
        ),
        createTestCase(
            'update git module ref',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main'",
            'develop',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop'"
        ),
        createTestCase(
            'update git module ref with inline comment',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'main' # Main branch",
            'develop',
            "mod 'mymodule', :git => 'https://github.com/user/mymodule.git', :ref => 'develop' # Main branch"
        )
    ];

    const edgeCaseTestCases: TestCase[] = [
        createTestCase(
            'handle double quotes',
            'mod "puppetlabs-stdlib", "9.4.1" # With double quotes',
            '9.5.0',
            'mod "puppetlabs-stdlib", \'9.5.0\' # With double quotes'
        ),
        createTestCase(
            'handle mixed quotes',
            "mod \"puppetlabs-stdlib\", '9.4.1' # Mixed quotes",
            '9.5.0',
            "mod \"puppetlabs-stdlib\", '9.5.0' # Mixed quotes"
        ),
        createTestCase(
            'preserve whitespace around comments',
            "mod 'puppetlabs-stdlib', '9.4.1'    # Lots of spaces",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'    # Lots of spaces"
        ),
        createTestCase(
            'handle comment without spaces',
            "mod 'puppetlabs-stdlib', '9.4.1'#NoSpaces",
            '9.5.0',
            "mod 'puppetlabs-stdlib', '9.5.0'#NoSpaces"
        ),
        createTestCase(
            'not modify non-module lines',
            "forge 'https://forgeapi.puppet.com' # Comment",
            '9.5.0',
            "forge 'https://forgeapi.puppet.com' # Comment"
        ),
        createTestCase(
            'not modify comment-only lines',
            "# This is just a comment",
            '9.5.0',
            "# This is just a comment"
        )
    ];

    runTestCases(updateVersionTestCases);
    runTestCases(edgeCaseTestCases);
});