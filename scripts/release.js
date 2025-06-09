#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function execCommand(command, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const output = execSync(command, { stdio: 'inherit', cwd: process.cwd() });
        console.log(`✅ ${description} completed successfully`);
        return output;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        process.exit(1);
    }
}

function updateVersion(versionType) {
    console.log(`\n📦 Updating version (${versionType})...`);
    execCommand(`npm version ${versionType} --no-git-tag-version`, `Version bump to ${versionType}`);
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const newVersion = packageJson.version;
    console.log(`✅ Version updated to: ${newVersion}`);
    return newVersion;
}

function main() {
    const args = process.argv.slice(2);
    const versionType = args[0] || 'patch'; // patch, minor, major
    
    console.log('🚀 Starting release process...');
    
    // Validate we're in the right directory
    if (!fs.existsSync('package.json')) {
        console.error('❌ package.json not found. Please run this from the project root.');
        process.exit(1);
    }
    
    // Check if git is clean
    try {
        execSync('git diff-index --quiet HEAD --');
    } catch (error) {
        console.error('❌ Git working directory is not clean. Please commit or stash changes first.');
        process.exit(1);
    }
    
    // Update version
    const newVersion = updateVersion(versionType);
    
    // Run tests
    execCommand('npm test', 'Running tests');
    
    // Build and package
    execCommand('npm run compile', 'Compiling TypeScript');
    execCommand('npm run package', 'Creating VSIX package');
    
    // Commit version bump
    execCommand('git add package.json', 'Staging package.json');
    execCommand(`git commit -m "chore: bump version to ${newVersion}"`, 'Committing version bump');
    
    // Create and push tag
    execCommand(`git tag v${newVersion}`, 'Creating git tag');
    execCommand('git push origin main', 'Pushing to main branch');
    execCommand(`git push origin v${newVersion}`, 'Pushing tag');
    
    console.log(`\n🎉 Release ${newVersion} completed successfully!`);
    console.log(`📦 VSIX package: puppetfile-depgraph-${newVersion}.vsix`);
    console.log(`🏷️  Git tag: v${newVersion}`);
    console.log('\nThe GitHub Actions workflow will automatically create a GitHub Release.');
}

if (require.main === module) {
    main();
}

module.exports = { updateVersion, execCommand };