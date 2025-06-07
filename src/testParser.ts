import { PuppetfileParser } from './puppetfileParser';
import * as fs from 'fs';
import * as path from 'path';

// Simple test script to validate our parser works
const puppetfilePath = path.join(__dirname, '..', 'Puppetfile');
const content = fs.readFileSync(puppetfilePath, 'utf8');

console.log('=== Puppetfile Content ===');
console.log(content);
console.log('\n=== Parsing Results ===');

const result = PuppetfileParser.parseContent(content);

console.log(`Found ${result.modules.length} modules:`);
result.modules.forEach((module, index) => {
    console.log(`${index + 1}. ${module.name}`);
    console.log(`   Source: ${module.source}`);
    if (module.version) {
        console.log(`   Version: ${module.version}`);
    }
    if (module.gitUrl) {
        console.log(`   Git URL: ${module.gitUrl}`);
    }
    if (module.gitTag) {
        console.log(`   Git Tag: ${module.gitTag}`);
    }
    if (module.gitRef) {
        console.log(`   Git Ref: ${module.gitRef}`);
    }
    console.log(`   Line: ${module.line}`);
    console.log('');
});

if (result.errors.length > 0) {
    console.log('=== Parsing Errors ===');
    result.errors.forEach(error => console.log(`- ${error}`));
}
