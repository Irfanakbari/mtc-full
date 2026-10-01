type Environment = Record<string, string | undefined>;

function required(env: Environment, keys: string[], errors: string[]): void {
  for (const key of keys) if (!env[key]?.trim()) errors.push(`${key} is required`);
}

export function validateEnvironment(env: Environment): Environment {
  const errors: string[] = [];
  required(env, ['DATABASE_URL'], errors);
  const port = Number(env.PORT ?? 31000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be a valid TCP port');
  const ssoEnabled = env.VUTEQ_SSO_ENABLED !== 'false';
  if (ssoEnabled) required(env, ['VUTEQ_SSO_BASE_URL', 'VUTEQ_SSO_SECRET'], errors);
  if (env.NODE_ENV === 'production' && env.SWAGGER_ENABLED === 'true') {
    required(env, ['SWAGGER_API_KEY'], errors);
  }
  if (errors.length) throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  return env;
}
