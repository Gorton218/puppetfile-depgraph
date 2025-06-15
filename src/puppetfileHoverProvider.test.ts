import { PuppetfileHoverProvider } from './puppetfileHoverProvider';
import { PuppetForgeService } from './puppetForgeService';

// Mock PuppetForgeService
jest.mock('./puppetForgeService');

describe('PuppetfileHoverProvider', () => {
  let provider: PuppetfileHoverProvider;

  beforeEach(() => {
    provider = new PuppetfileHoverProvider();
    jest.clearAllMocks();
  });

  test('should create hover provider instance', () => {
    expect(provider).toBeDefined();
    expect(typeof provider.provideHover).toBe('function');
  });

  test('isPuppetfile should detect Puppetfile by filename', () => {
    const mockDocument = {
      fileName: '/path/to/Puppetfile',
      languageId: 'plaintext'
    };
    
    const isPuppetfile = (provider as any).isPuppetfile;
    expect(isPuppetfile.call(provider, mockDocument)).toBe(true);
  });

  test('isPuppetfile should detect Puppetfile by language', () => {
    const mockDocument = {
      fileName: '/path/to/somefile',
      languageId: 'puppetfile'
    };
    
    const isPuppetfile = (provider as any).isPuppetfile;
    expect(isPuppetfile.call(provider, mockDocument)).toBe(true);
  });

  test('isPuppetfile should reject non-Puppetfile files', () => {
    const mockDocument = {
      fileName: '/path/to/somefile.txt',
      languageId: 'plaintext'
    };
    
    const isPuppetfile = (provider as any).isPuppetfile;
    expect(isPuppetfile.call(provider, mockDocument)).toBe(false);
  });

  test('parseModuleFromPosition should parse modules correctly', () => {
    const parseModuleFromPosition = (provider as any).parseModuleFromPosition;
    const testLine = "mod 'puppetlabs/stdlib', '8.5.0'";
    
    const mockDocument = {
      lineAt: jest.fn(() => ({ text: testLine })),
      getText: jest.fn(() => testLine)
    };
    const mockPosition = { line: 0, character: 10 };
    
    const result = parseModuleFromPosition.call(provider, mockDocument, mockPosition);
    
    expect(result).toBeDefined();
    expect(result.name).toBe('puppetlabs/stdlib');
    expect(result.version).toBe('8.5.0');
    expect(result.line).toBe(1);
  });

  test('should return null for non-Puppetfile documents', async () => {
    const mockDocument = {
      fileName: 'test.txt',
      languageId: 'plaintext'
    };
    const mockPosition = { line: 0, character: 5 };
    
    const result = await provider.provideHover(mockDocument as any, mockPosition as any, {} as any);
    
    expect(result).toBeNull();
  });

  test('should return null when no word range at cursor position', async () => {
    const mockDocument = {
      fileName: 'Puppetfile',
      languageId: 'puppetfile',
      getWordRangeAtPosition: jest.fn(() => undefined)
    };
    const mockPosition = { line: 0, character: 5 };
    
    const result = await provider.provideHover(mockDocument as any, mockPosition as any, {} as any);
    
    expect(result).toBeNull();
  });
});