import * as sinon from 'sinon';
import { GitMetadataService } from '../gitMetadataService';
import axios from 'axios';

describe('GitMetadataService Test Suite', () => {
  let axiosGetStub: sinon.SinonStub;
  let consoleWarnStub: sinon.SinonStub;
  let consoleErrorStub: sinon.SinonStub;
  
  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, 'get');
    consoleWarnStub = sinon.stub(console, 'warn');
    consoleErrorStub = sinon.stub(console, 'error');
    GitMetadataService.clearCache();
  });
  
  afterEach(() => {
    sinon.restore();
  });

  test('convertToRawUrl should handle GitHub URLs', () => {
    // Access private method for testing
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const githubUrl = 'https://github.com/theforeman/puppet-foreman.git';
    const result = convertToRawUrl(githubUrl, '24.2-stable');
    
    expect(result).toBe('https://raw.githubusercontent.com/theforeman/puppet-foreman/24.2-stable/metadata.json');
  });

  test('convertToRawUrl should handle GitHub SSH URLs', () => {
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const githubSshUrl = 'git@github.com:theforeman/puppet-foreman.git';
    const result = convertToRawUrl(githubSshUrl, 'main');
    
    expect(result).toBe('https://raw.githubusercontent.com/theforeman/puppet-foreman/main/metadata.json');
  });

  test('convertToRawUrl should handle GitLab URLs', () => {
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const gitlabUrl = 'https://gitlab.com/user/project.git';
    const result = convertToRawUrl(gitlabUrl, 'develop');
    
    expect(result).toBe('https://gitlab.com/user/project/-/raw/develop/metadata.json');
  });

  test('convertToRawUrl should handle Bitbucket URLs', () => {
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const bitbucketUrl = 'https://bitbucket.org/user/project.git';
    const result = convertToRawUrl(bitbucketUrl, 'main');
    
    expect(result).toBe('https://bitbucket.org/user/project/raw/main/metadata.json');
  });

  test('convertToRawUrl should default to main branch', () => {
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const githubUrl = 'https://github.com/user/project.git';
    const result = convertToRawUrl(githubUrl);
    
    expect(result).toBe('https://raw.githubusercontent.com/user/project/main/metadata.json');
  });

  test('getGitModuleMetadata should fetch and parse metadata', async () => {
    const mockMetadata = {
      name: 'theforeman-foreman',
      version: '1.0.0',
      author: 'theforeman',
      summary: 'Puppet module for Foreman',
      license: 'GPL-3.0+',
      source: 'https://github.com/theforeman/puppet-foreman',
      dependencies: [
        { name: 'puppetlabs/stdlib', version_requirement: '>= 4.0.0' }
      ]
    };

    axiosGetStub.resolves({ data: mockMetadata });

    const result = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/theforeman/puppet-foreman.git',
      '24.2-stable'
    );

    expect(result).toEqual(mockMetadata);
    expect(axiosGetStub.calledOnce).toBe(true);
    expect(axiosGetStub.calledWith(
      'https://raw.githubusercontent.com/theforeman/puppet-foreman/24.2-stable/metadata.json',
      sinon.match.object
    )).toBe(true);
  });

  test('getGitModuleMetadata should handle fetch errors gracefully', async () => {
    axiosGetStub.rejects(new Error('Network error'));

    const result = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/user/project.git',
      'main'
    );

    expect(result).toBe(null);
    expect(axiosGetStub.calledOnce).toBe(true);
  });

  test('getGitModuleMetadata should cache results', async () => {
    const mockMetadata = {
      name: 'test-module',
      version: '1.0.0',
      author: 'test',
      summary: 'Test module',
      license: 'MIT',
      source: 'https://github.com/test/module'
    };

    axiosGetStub.resolves({ data: mockMetadata });

    // First call
    const result1 = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/test/module.git',
      'main'
    );

    // Second call - should use cache
    const result2 = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/test/module.git',
      'main'
    );

    expect(result1).toEqual(mockMetadata);
    expect(result2).toEqual(mockMetadata);
    expect(axiosGetStub.calledOnce).toBe(true);
  });

  test('getGitModuleMetadata should handle different refs separately in cache', async () => {
    const mockMetadata1 = { name: 'test-module', version: '1.0.0' };
    const mockMetadata2 = { name: 'test-module', version: '2.0.0' };

    axiosGetStub.onFirstCall().resolves({ data: mockMetadata1 });
    axiosGetStub.onSecondCall().resolves({ data: mockMetadata2 });

    const result1 = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/test/module.git',
      'v1.0.0'
    );

    const result2 = await GitMetadataService.getGitModuleMetadata(
      'https://github.com/test/module.git',
      'v2.0.0'
    );

    expect(result1?.version).toBe('1.0.0');
    expect(result2?.version).toBe('2.0.0');
    expect(axiosGetStub.calledTwice).toBe(true);
  });

  test('clearCache should empty the cache', async () => {
    const mockMetadata = { name: 'test-module', version: '1.0.0' };
    axiosGetStub.resolves({ data: mockMetadata });

    // Prime the cache
    await GitMetadataService.getGitModuleMetadata('https://github.com/test/module.git');
    expect(GitMetadataService.getCacheSize()).toBe(1);

    // Clear cache
    GitMetadataService.clearCache();
    expect(GitMetadataService.getCacheSize()).toBe(0);

    // Next call should hit the network again
    await GitMetadataService.getGitModuleMetadata('https://github.com/test/module.git');
    expect(axiosGetStub.calledTwice).toBe(true);
  });

  test('getModuleMetadataWithFallback should try alternative refs', async () => {
    // First call (main) fails
    axiosGetStub.onFirstCall().rejects(new Error('404 Not Found'));
    
    // Second call (master) succeeds
    const mockMetadata = { name: 'test-module', version: '1.0.0' };
    axiosGetStub.onSecondCall().resolves({ data: mockMetadata });

    const result = await GitMetadataService.getModuleMetadataWithFallback(
      'https://github.com/test/module.git'
    );

    expect(result).toEqual(mockMetadata);
    expect(axiosGetStub.calledTwice).toBe(true);
    // Note: Console.warn is stubbed to prevent error messages during test execution
  });

  test('convertToRawUrl should handle URLs without .git extension', () => {
    const convertToRawUrl = (GitMetadataService as any).convertToRawUrl;
    
    const githubUrl = 'https://github.com/user/project';
    const result = convertToRawUrl(githubUrl, 'main');
    
    expect(result).toBe('https://raw.githubusercontent.com/user/project/main/metadata.json');
  });
});