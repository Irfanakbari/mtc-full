export type ApiVersion = 'v1';
export function getApiUrl(version: ApiVersion = 'v1'): string { const base = process.env.API_URL ?? 'http://localhost:31000'; return `${base.replace(/\/$/, '')}/${version}`; }
