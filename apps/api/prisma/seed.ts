import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const SEED_ACTOR = 'system:seed';

const permissions = [
  { Action: 'MTC.DASHBOARD.READ', Description: 'View the MTC dashboard' },
  { Action: 'MTC.ITEM.READ', Description: 'View inventory items' },
  { Action: 'MTC.ITEM.CREATE', Description: 'Create inventory items' },
  { Action: 'MTC.ITEM.UPDATE', Description: 'Update inventory items' },
  { Action: 'MTC.ITEM.ARCHIVE', Description: 'Archive and reactivate inventory items' },
  { Action: 'MTC.ITEM.IMPORT', Description: 'Preview and commit inventory item imports' },
  { Action: 'MTC.ITEM.EXPORT', Description: 'Export inventory item data' },
  { Action: 'MTC.STOCK.READ', Description: 'View stock transactions and ledger entries' },
  { Action: 'MTC.STOCK.IN', Description: 'Post stock-in transactions' },
  { Action: 'MTC.STOCK.OUT', Description: 'Post stock-out transactions' },
  { Action: 'MTC.STOCK.SCRAP', Description: 'Post stock scrap transactions' },
  { Action: 'MTC.OPNAME.READ', Description: 'View stock opname sessions and documents' },
  { Action: 'MTC.OPNAME.CREATE', Description: 'Create and start stock opname sessions' },
  { Action: 'MTC.OPNAME.UPDATE', Description: 'Record and update stock opname counts' },
  { Action: 'MTC.OPNAME.CANCEL', Description: 'Cancel stock opname sessions' },
  { Action: 'MTC.OPNAME.APPROVE', Description: 'Approve stock opname variances' },
  { Action: 'MTC.USER_MANAGEMENT', Description: 'Manage application users' },
  { Action: 'MTC.ROLE_MANAGEMENT', Description: 'Manage roles and permissions' },
  { Action: 'MTC.API_KEY_MANAGEMENT', Description: 'Manage API keys' },
  { Action: 'MTC.SYSTEM_LOG_READ', Description: 'View process and audit logs' },
] as const;

const readonlyActions = permissions
  .map(({ Action }) => Action)
  .filter((action) => action.endsWith('.READ') || action === 'MTC.ITEM.EXPORT');

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to run the database seed');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const permission of permissions) {
        await tx.appPermission.upsert({
          where: { Action: permission.Action },
          create: permission,
          update: { Description: permission.Description },
        });
      }

      const allPermissions = await tx.appPermission.findMany({ select: { Id: true } });
      const readonlyPermissions = await tx.appPermission.findMany({
        where: { Action: { in: readonlyActions } },
        select: { Id: true },
      });

      const superRole = await tx.appRole.upsert({
        where: { Name: 'SUPER' },
        create: {
          Name: 'SUPER',
          Description: 'MTC system administrator with full access',
          IsSystem: true,
          CreatedBy: SEED_ACTOR,
          Permissions: { connect: allPermissions },
        },
        update: {
          Description: 'MTC system administrator with full access',
          IsSystem: true,
          UpdatedBy: SEED_ACTOR,
          Permissions: { set: allPermissions },
        },
      });

      const readonlyRole = await tx.appRole.upsert({
        where: { Name: 'READONLY' },
        create: {
          Name: 'READONLY',
          Description: 'Read-only access to MTC operational data',
          IsSystem: true,
          CreatedBy: SEED_ACTOR,
          Permissions: { connect: readonlyPermissions },
        },
        update: {
          Description: 'Read-only access to MTC operational data',
          IsSystem: true,
          UpdatedBy: SEED_ACTOR,
          Permissions: { set: readonlyPermissions },
        },
      });

      return {
        permissionCount: permissions.length,
        roles: [
          { name: superRole.Name, permissionCount: allPermissions.length },
          { name: readonlyRole.Name, permissionCount: readonlyPermissions.length },
        ],
      };
    });

    console.log(`Seeded ${result.permissionCount} permissions.`);
    for (const role of result.roles) {
      console.log(`Seeded role ${role.name} with ${role.permissionCount} permissions.`);
    }
  } finally { await prisma.$disconnect(); }
}

void main().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
