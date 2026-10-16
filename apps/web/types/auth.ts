/*By Irfan Akbari Vuteq Indonesia - 2026-09-15*/

export interface MTCUser {
  Id?: string;
  SsoObjectId?: string;
  UserId?: string;
  Name?: string;
  Email?: string | null;
  IsActive?: boolean;
  LastLogin?: string | null;
  RoleName?: string | null;
  Permission?: string[];
  AccessStatus?: 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'UNAVAILABLE';
  GlobalRoles?: string[];
}

