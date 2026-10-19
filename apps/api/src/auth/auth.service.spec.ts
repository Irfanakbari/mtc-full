import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    appUser: { findUnique: jest.Mock };
    appRole: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      appUser: { findUnique: jest.fn() },
      appRole: { findUnique: jest.fn() },
    };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('returns null when user is not found', async () => {
    prisma.appUser.findUnique.mockResolvedValue(null);
    const result = await service.profile('unknown-id');
    expect(result).toBeNull();
  });

  it('returns PENDING status for user without a role and without RO_ADMINISTRATOR', async () => {
    prisma.appUser.findUnique.mockResolvedValue({
      Id: 'user-1',
      SsoObjectId: 'sso-1',
      Name: 'Pending User',
      Email: 'pending@vuteq.co.id',
      IsActive: true,
      RoleId: null,
      Role: null,
    });

    const result = await service.profile('sso-1', []);
    expect(result).toEqual({
      Id: 'user-1',
      SsoObjectId: 'sso-1',
      Name: 'Pending User',
      Email: 'pending@vuteq.co.id',
      IsActive: true,
      RoleName: null,
      Permission: [],
      AccessStatus: 'PENDING',
    });
  });

  it('assigns READONLY role and ACTIVE status for RO_ADMINISTRATOR without a local role', async () => {
    prisma.appUser.findUnique.mockResolvedValue({
      Id: 'user-2',
      SsoObjectId: 'sso-ro',
      Name: 'RO User',
      Email: 'ro@vuteq.co.id',
      IsActive: true,
      RoleId: null,
      Role: null,
    });
    prisma.appRole.findUnique.mockResolvedValue({
      Id: 'role-ro',
      Name: 'READONLY',
      Permissions: [
        { Action: 'MTC.ITEM.READ' },
        { Action: 'MTC.STOCK.READ' },
      ],
    });

    const result = await service.profile('sso-ro', ['RO_ADMINISTRATOR']);
    expect(result).toEqual({
      Id: 'user-2',
      SsoObjectId: 'sso-ro',
      Name: 'RO User',
      Email: 'ro@vuteq.co.id',
      IsActive: true,
      RoleName: 'READONLY',
      Permission: expect.arrayContaining(['MTC.ITEM.READ', 'MTC.STOCK.READ']),
      AccessStatus: 'ACTIVE',
    });
  });
});
