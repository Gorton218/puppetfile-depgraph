# API Integration Tests

This directory contains integration tests that make **real API calls** to external services like the Puppet Forge API. These tests are separate from the main test suite to ensure:

1. **Fast unit/integration tests** - Main tests use mocks and run quickly
2. **API contract verification** - These tests verify external APIs haven't changed
3. **Real-world validation** - Tests with actual API responses and error conditions
4. **Optional execution** - These tests require internet connectivity and are slower

## Running API Integration Tests

```bash
# Run only API integration tests
npm run test:api-integration

# Run with verbose output
npm run test:api-integration -- --verbose

# Run a specific test file
npm run test:api-integration -- puppetForgeApi.test.ts
```

## Important Notes

- ⚠️ **Requires Internet Connection**: These tests make real HTTP requests
- ⚠️ **Slower Execution**: Each test may take 5-30 seconds  
- ⚠️ **Rate Limiting**: Be mindful of API rate limits when running frequently
- ⚠️ **Network Dependent**: Tests may fail due to network issues or API downtime

## Test Structure

### puppetForgeApi.test.ts
Tests the real Puppet Forge API to verify:
- Module information retrieval
- Release data fetching
- Version comparison accuracy
- Error handling with real API errors
- Caching behavior
- Network timeout handling

## When to Run These Tests

### During Development
- **Before major releases** to verify API compatibility
- **When modifying PuppetForgeService** to ensure real API still works
- **When debugging API-related issues** to test against real responses

### In CI/CD
- **Nightly builds** to catch API changes early
- **Release branches** to verify production readiness
- **Manual triggers** for on-demand validation

### Not Recommended For
- **Pull request validation** (too slow)
- **Local development loops** (use mocked tests instead)
- **Frequent automated runs** (risk of rate limiting)

## Adding New API Tests

When adding new API integration tests:

1. **Use descriptive test names** that explain what API contract is being verified
2. **Set appropriate timeouts** (30+ seconds for network requests)
3. **Handle flaky network conditions** gracefully
4. **Test both success and error scenarios**
5. **Clean up resources** in afterAll/afterEach hooks
6. **Document API dependencies** and version requirements

## Mock vs. API Integration Tests

| Aspect | Mock Tests | API Integration Tests |
|--------|------------|---------------------|
| **Speed** | Fast (< 1s) | Slow (5-30s) |
| **Reliability** | High | Network dependent |
| **Purpose** | Logic verification | API contract verification |
| **Frequency** | Every run | Periodic |
| **Internet** | Not required | Required |
| **Development** | Primary feedback | Validation |

## Troubleshooting

### Common Issues

**Test timeouts:**
- Increase timeout values for slow networks
- Check internet connectivity
- Verify API endpoints are accessible

**Rate limiting:**
- Reduce test frequency
- Add delays between requests if needed
- Use different API keys if available

**API changes:**
- Update test expectations for new API versions
- Review API documentation for breaking changes
- Update mock data to match new API responses

### Getting Help

If API integration tests are failing:
1. Check if the API service is operational
2. Verify network connectivity
3. Review API documentation for changes
4. Compare with mock test behavior
5. Test individual API endpoints manually