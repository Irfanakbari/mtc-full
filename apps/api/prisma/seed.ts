import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnvironmentFile } from "dotenv";
import {
  InventoryTransactionType,
  PrismaClient,
} from "../src/generated/prisma/client";

const displayEnvironmentPath = join(process.cwd(), ".env.display");
loadEnvironmentFile({
  path: displayEnvironmentPath,
  override: false,
  quiet: true,
});

const SEED_ACTOR = "system:seed";

const permissions = [
  { Action: "MTC.DASHBOARD.READ", Description: "View the MTC dashboard" },
  { Action: "MTC.ITEM.READ", Description: "View inventory items" },
  { Action: "MTC.ITEM.CREATE", Description: "Create inventory items" },
  { Action: "MTC.ITEM.UPDATE", Description: "Update inventory items" },
  {
    Action: "MTC.ITEM.ARCHIVE",
    Description: "Archive and reactivate inventory items",
  },
  {
    Action: "MTC.ITEM.IMPORT",
    Description: "Preview and commit inventory item imports",
  },
  { Action: "MTC.ITEM.EXPORT", Description: "Export inventory item data" },
  {
    Action: "MTC.STOCK.READ",
    Description: "View stock transactions and ledger entries",
  },
  { Action: "MTC.STOCK.IN", Description: "Post stock-in transactions" },
  { Action: "MTC.STOCK.OUT", Description: "Post stock-out transactions" },
  { Action: "MTC.STOCK.SCRAP", Description: "Post stock scrap transactions" },
  {
    Action: "MTC.OPNAME.READ",
    Description: "View stock opname sessions and documents",
  },
  {
    Action: "MTC.OPNAME.CREATE",
    Description: "Create and start stock opname sessions",
  },
  {
    Action: "MTC.OPNAME.UPDATE",
    Description: "Record and update stock opname counts",
  },
  { Action: "MTC.OPNAME.CANCEL", Description: "Cancel stock opname sessions" },
  {
    Action: "MTC.OPNAME.APPROVE",
    Description: "Approve stock opname variances",
  },
  { Action: "MTC.USER_MANAGEMENT", Description: "Manage application users" },
  {
    Action: "MTC.ROLE_MANAGEMENT",
    Description: "Manage roles and permissions",
  },
  { Action: "MTC.API_KEY_MANAGEMENT", Description: "Manage API keys" },
  { Action: "MTC.SYSTEM_LOG_READ", Description: "View process and audit logs" },
] as const;

const readonlyActions = permissions
  .map(({ Action }) => Action)
  .filter((action) => action.endsWith(".READ") || action === "MTC.ITEM.EXPORT");

const dummyItems = [
  {
    seedKey: "MTC-DUMMY-001",
    name: "Air Filter Element",
    model: "AF-100",
    unit: "PCS",
    address: "DUMMY-A01-01",
    openingBalance: "48.00",
    minimumStock: "10.00",
  },
  {
    seedKey: "MTC-DUMMY-002",
    name: "Oil Filter Cartridge",
    model: "C-1104",
    unit: "PCS",
    address: "DUMMY-A01-02",
    openingBalance: "36.00",
    minimumStock: "8.00",
  },
  {
    seedKey: "MTC-DUMMY-003",
    name: "Spark Plug Iridium",
    model: "IFR6T11",
    unit: "PCS",
    address: "DUMMY-A01-03",
    openingBalance: "80.00",
    minimumStock: "20.00",
  },
  {
    seedKey: "MTC-DUMMY-004",
    name: "Brake Pad Front Set",
    model: "SN-135P",
    unit: "SET",
    address: "DUMMY-A02-01",
    openingBalance: "24.00",
    minimumStock: "6.00",
  },
  {
    seedKey: "MTC-DUMMY-005",
    name: "V-Belt",
    model: "7PK1935",
    unit: "PCS",
    address: "DUMMY-A02-02",
    openingBalance: "18.00",
    minimumStock: "5.00",
  },
  {
    seedKey: "MTC-DUMMY-006",
    name: "Headlamp Bulb",
    model: "H11-12V55W",
    unit: "PCS",
    address: "DUMMY-A02-03",
    openingBalance: "32.00",
    minimumStock: "8.00",
  },
  {
    seedKey: "MTC-DUMMY-007",
    name: "Wiper Blade 24 Inch",
    model: "AP24U",
    unit: "PCS",
    address: "DUMMY-B01-01",
    openingBalance: "20.00",
    minimumStock: "5.00",
  },
  {
    seedKey: "MTC-DUMMY-008",
    name: "Coolant Long Life",
    model: "LLC-1L",
    unit: "BTL",
    address: "DUMMY-B01-02",
    openingBalance: "40.00",
    minimumStock: "10.00",
  },
  {
    seedKey: "MTC-DUMMY-009",
    name: "Workshop Cleaning Cloth",
    model: "CLOTH-40",
    unit: "PCS",
    address: "DUMMY-B01-03",
    openingBalance: "120.00",
    minimumStock: "30.00",
  },
  {
    seedKey: "MTC-DUMMY-010",
    name: "Nitrile Safety Gloves",
    model: "EDGE-82-133",
    unit: "BOX",
    address: "DUMMY-B02-01",
    openingBalance: "15.00",
    minimumStock: "4.00",
  },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("DATABASE_URL is required to run the database seed");
  let displayApiKey = process.env.MTC_DISPLAY_API_KEY?.trim();
  let generatedDevelopmentKey = false;
  if (!displayApiKey && process.env.NODE_ENV !== "production") {
    displayApiKey = `mtc_${randomBytes(36).toString("base64url")}`;
    if (!existsSync(displayEnvironmentPath)) {
      writeFileSync(
        displayEnvironmentPath,
        `MTC_DISPLAY_API_KEY=${displayApiKey}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      generatedDevelopmentKey = true;
    }
  }
  if (displayApiKey && !/^mtc_[A-Za-z0-9_-]{28,96}$/.test(displayApiKey)) {
    throw new Error(
      "MTC_DISPLAY_API_KEY must start with mtc_ and contain 32-100 safe characters",
    );
  }
  const displayKeyHash = displayApiKey
    ? await bcrypt.hash(displayApiKey, 12)
    : null;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const permission of permissions) {
        await tx.appPermission.upsert({
          where: { Action: permission.Action },
          create: permission,
          update: { Description: permission.Description },
        });
      }

      const allPermissions = await tx.appPermission.findMany({
        select: { Id: true },
      });
      const readonlyPermissions = await tx.appPermission.findMany({
        where: { Action: { in: readonlyActions } },
        select: { Id: true },
      });

      const superRole = await tx.appRole.upsert({
        where: { Name: "SUPER" },
        create: {
          Name: "SUPER",
          Description: "MTC system administrator with full access",
          IsSystem: true,
          CreatedBy: SEED_ACTOR,
          Permissions: { connect: allPermissions },
        },
        update: {
          Description: "MTC system administrator with full access",
          IsSystem: true,
          UpdatedBy: SEED_ACTOR,
          Permissions: { set: allPermissions },
        },
      });

      const readonlyRole = await tx.appRole.upsert({
        where: { Name: "READONLY" },
        create: {
          Name: "READONLY",
          Description: "Read-only access to MTC operational data",
          IsSystem: true,
          CreatedBy: SEED_ACTOR,
          Permissions: { connect: readonlyPermissions },
        },
        update: {
          Description: "Read-only access to MTC operational data",
          IsSystem: true,
          UpdatedBy: SEED_ACTOR,
          Permissions: { set: readonlyPermissions },
        },
      });

      if (displayApiKey && displayKeyHash) {
        const prefix = displayApiKey.slice(0, 12);
        await tx.apiKey.updateMany({
          where: {
            Name: "MTC Operator Display",
            Prefix: { not: prefix },
            IsActive: true,
          },
          data: {
            IsActive: false,
            RevokedAt: new Date(),
            RevokedBy: SEED_ACTOR,
          },
        });
        await tx.apiKey.upsert({
          where: { Prefix: prefix },
          create: {
            Name: "MTC Operator Display",
            Prefix: prefix,
            SecretHash: displayKeyHash,
            Permissions: ["MTC.ITEM.READ", "MTC.STOCK.IN", "MTC.STOCK.OUT"],
            CreatedBy: SEED_ACTOR,
          },
          update: {
            Name: "MTC Operator Display",
            SecretHash: displayKeyHash,
            Permissions: ["MTC.ITEM.READ", "MTC.STOCK.IN", "MTC.STOCK.OUT"],
            IsActive: true,
            RevokedAt: null,
            RevokedBy: null,
          },
        });
      }

      let dummyItemCreatedCount = 0;
      for (const item of dummyItems) {
        const existingItem = await tx.inventoryItem.findUnique({
          where: { AddressLocation: item.address },
          select: { Id: true },
        });
        if (existingItem) continue;

        await tx.inventoryItem.create({
          data: {
            Name: item.name,
            Model: item.model,
            Unit: item.unit,
            AddressLocation: item.address,
            CurrentBalance: item.openingBalance,
            MinimumStock: item.minimumStock,
            CreatedBy: SEED_ACTOR,
            LedgerEntries: {
              create: {
                TransactionType: InventoryTransactionType.OPENING_BALANCE,
                ReferenceDoc: `SEED-OPENING-${item.seedKey}`,
                BalanceBefore: 0,
                QtyIn: item.openingBalance,
                QtyOut: 0,
                BalanceAfter: item.openingBalance,
                CreatedBy: SEED_ACTOR,
                Notes: "Dummy opening balance for development and UAT",
                IdempotencyKey: `seed:dummy:${item.seedKey}`,
              },
            },
          },
        });
        dummyItemCreatedCount += 1;
      }

      const seededDummyItems = await tx.inventoryItem.findMany({
        where: { AddressLocation: { in: dummyItems.map((item) => item.address) } },
        select: {
          AddressLocation: true,
          CurrentBalance: true,
          LedgerEntries: { select: { QtyIn: true, QtyOut: true } },
        },
      });
      if (seededDummyItems.length !== dummyItems.length) {
        throw new Error(
          `Expected ${dummyItems.length} dummy items, found ${seededDummyItems.length}`,
        );
      }
      for (const item of seededDummyItems) {
        const ledgerBalance = item.LedgerEntries.reduce(
          (balance, entry) =>
            balance + Number(entry.QtyIn) - Number(entry.QtyOut),
          0,
        );
        if (Math.abs(Number(item.CurrentBalance) - ledgerBalance) > 0.001) {
          throw new Error(
            `Ledger reconciliation failed for dummy item ${item.AddressLocation}`,
          );
        }
      }

      return {
        permissionCount: permissions.length,
        displayKeyProvisioned: Boolean(displayApiKey),
        dummyItemCount: seededDummyItems.length,
        dummyItemCreatedCount,
        roles: [
          { name: superRole.Name, permissionCount: allPermissions.length },
          {
            name: readonlyRole.Name,
            permissionCount: readonlyPermissions.length,
          },
        ],
      };
    });

    console.log(`Seeded ${result.permissionCount} permissions.`);
    for (const role of result.roles) {
      console.log(
        `Seeded role ${role.name} with ${role.permissionCount} permissions.`,
      );
    }
    console.log(
      result.displayKeyProvisioned
        ? "Provisioned the operator display API key."
        : "Skipped operator display API key provisioning (MTC_DISPLAY_API_KEY is not set).",
    );
    console.log(
      `Seeded ${result.dummyItemCreatedCount} new dummy items; ${result.dummyItemCount} dummy items are available and ledger-reconciled.`,
    );
    if (generatedDevelopmentKey)
      console.log(
        "Generated a development display key in apps/api/.env.display. The secret was not printed.",
      );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error("Database seed failed:", error);
  process.exitCode = 1;
});
