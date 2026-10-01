export interface CurrentUserIdentity {
  username: string;
  name: string;
  email: string;
  roleName?: string;
  permissions: string[];
  globalRoles?: string[];
  authType: 'SSO' | 'API_KEY';
}
