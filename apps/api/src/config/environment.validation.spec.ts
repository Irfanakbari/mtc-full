import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('accepts local development with SSO explicitly disabled', () => {
    expect(validateEnvironment({ DATABASE_URL: 'postgresql://localhost/mtc', VUTEQ_SSO_ENABLED: 'false' })).toBeDefined();
  });

  it('requires SSO configuration when SSO is enabled', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/mtc' })).toThrow('VUTEQ_SSO_BASE_URL is required');
  });

  it('requires a documentation key when Swagger is enabled in production', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/mtc', VUTEQ_SSO_ENABLED: 'false', NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toThrow('SWAGGER_API_KEY is required');
  });
});
