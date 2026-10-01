-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('OPENING_BALANCE', 'STOCK_IN', 'STOCK_OUT', 'SCRAP', 'STOCK_OPNAME_DIFF', 'REVERSAL');

-- CreateEnum
CREATE TYPE "OpnameScope" AS ENUM ('SELECTED_ITEMS', 'ALL_ACTIVE_ITEMS');

-- CreateEnum
CREATE TYPE "OpnameStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "Id" TEXT NOT NULL,
    "ItemCode" VARCHAR(80) NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Brand" VARCHAR(120),
    "Model" VARCHAR(120),
    "SerialNumber" VARCHAR(160),
    "Unit" VARCHAR(30) NOT NULL DEFAULT 'PCS',
    "AddressLocation" VARCHAR(120) NOT NULL,
    "CurrentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "MinimumStock" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "DiscontinuedAt" TIMESTAMP(3),
    "DiscontinueReason" VARCHAR(500),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" VARCHAR(160),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "InventoryLedger" (
    "Id" TEXT NOT NULL,
    "ItemId" TEXT NOT NULL,
    "TransactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "TransactionType" "InventoryTransactionType" NOT NULL,
    "ReferenceDoc" VARCHAR(160) NOT NULL,
    "BalanceBefore" DECIMAL(18,2) NOT NULL,
    "QtyIn" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "QtyOut" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "BalanceAfter" DECIMAL(18,2) NOT NULL,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "Notes" VARCHAR(1000),
    "IdempotencyKey" VARCHAR(80),
    "ReversalOfId" TEXT,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "BusinessCommand" (
    "Id" TEXT NOT NULL,
    "Operation" VARCHAR(100) NOT NULL,
    "CommandKey" VARCHAR(80) NOT NULL,
    "RequestHash" VARCHAR(64) NOT NULL,
    "Actor" VARCHAR(160) NOT NULL,
    "Result" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CompletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessCommand_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpname" (
    "Id" TEXT NOT NULL,
    "RecordNumber" VARCHAR(40) NOT NULL,
    "Scope" "OpnameScope" NOT NULL,
    "Status" "OpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "Notes" VARCHAR(1000),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "StartedAt" TIMESTAMP(3),
    "StartedBy" VARCHAR(160),
    "CompletedAt" TIMESTAMP(3),
    "CompletedBy" VARCHAR(160),
    "ApprovalNotes" VARCHAR(1000),

    CONSTRAINT "StockOpname_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpnameSelection" (
    "Id" SERIAL NOT NULL,
    "OpnameId" TEXT NOT NULL,
    "ItemId" TEXT NOT NULL,

    CONSTRAINT "StockOpnameSelection_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpnameDetail" (
    "Id" SERIAL NOT NULL,
    "OpnameId" TEXT NOT NULL,
    "ItemId" TEXT NOT NULL,
    "SystemQty" DECIMAL(18,2) NOT NULL,
    "ActualQty" DECIMAL(18,2),
    "DifferenceQty" DECIMAL(18,2),
    "CountedAt" TIMESTAMP(3),
    "CountedBy" VARCHAR(160),
    "Notes" VARCHAR(1000),

    CONSTRAINT "StockOpnameDetail_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "StockOpnameAttachment" (
    "Id" SERIAL NOT NULL,
    "OpnameId" TEXT NOT NULL,
    "StoredName" VARCHAR(255) NOT NULL,
    "OriginalName" VARCHAR(255) NOT NULL,
    "RelativePath" VARCHAR(500) NOT NULL,
    "MimeType" VARCHAR(120) NOT NULL,
    "Size" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,

    CONSTRAINT "StockOpnameAttachment_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "RecordNumberCounter" (
    "Id" TEXT NOT NULL,
    "Prefix" VARCHAR(20) NOT NULL,
    "BusinessDate" DATE NOT NULL,
    "LastSequence" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordNumberCounter_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "Id" TEXT NOT NULL,
    "SsoObjectId" VARCHAR(160) NOT NULL,
    "Email" VARCHAR(255) NOT NULL,
    "Name" VARCHAR(255) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "RoleId" TEXT,
    "LastLogin" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" VARCHAR(160),

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AppRole" (
    "Id" TEXT NOT NULL,
    "Name" VARCHAR(100) NOT NULL,
    "Description" VARCHAR(500),
    "IsSystem" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "UpdatedBy" VARCHAR(160),

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AppPermission" (
    "Id" TEXT NOT NULL,
    "Action" VARCHAR(120) NOT NULL,
    "Description" VARCHAR(500),

    CONSTRAINT "AppPermission_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "Id" TEXT NOT NULL,
    "Name" VARCHAR(120) NOT NULL,
    "Prefix" VARCHAR(20) NOT NULL,
    "SecretHash" VARCHAR(255) NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "ExpiresAt" TIMESTAMP(3),
    "LastUsedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(160) NOT NULL,
    "RevokedAt" TIMESTAMP(3),
    "RevokedBy" VARCHAR(160),
    "Permissions" TEXT[],

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProcessLog" (
    "Id" TEXT NOT NULL,
    "FunctionId" VARCHAR(100) NOT NULL,
    "FunctionName" VARCHAR(200) NOT NULL,
    "Status" "ProcessStatus" NOT NULL DEFAULT 'RUNNING',
    "Actor" VARCHAR(160),
    "RequestId" VARCHAR(128),
    "StartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CompletedAt" TIMESTAMP(3),
    "Summary" VARCHAR(1000),

    CONSTRAINT "ProcessLog_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ProcessLogDetail" (
    "Id" BIGSERIAL NOT NULL,
    "ProcessId" TEXT NOT NULL,
    "Level" VARCHAR(20) NOT NULL,
    "Message" VARCHAR(2000) NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessLogDetail_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ActionAuditEvent" (
    "Id" BIGSERIAL NOT NULL,
    "EntityType" VARCHAR(100) NOT NULL,
    "EntityId" VARCHAR(160) NOT NULL,
    "Action" VARCHAR(60) NOT NULL,
    "Actor" VARCHAR(160) NOT NULL,
    "RequestId" VARCHAR(128),
    "Before" JSONB,
    "After" JSONB,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionAuditEvent_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "_AppPermissionToAppRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AppPermissionToAppRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_ItemCode_key" ON "InventoryItem"("ItemCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_AddressLocation_key" ON "InventoryItem"("AddressLocation");

-- CreateIndex
CREATE INDEX "InventoryItem_Name_idx" ON "InventoryItem"("Name");

-- CreateIndex
CREATE INDEX "InventoryItem_IsActive_idx" ON "InventoryItem"("IsActive");

-- CreateIndex
CREATE INDEX "InventoryItem_AddressLocation_idx" ON "InventoryItem"("AddressLocation");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLedger_ReversalOfId_key" ON "InventoryLedger"("ReversalOfId");

-- CreateIndex
CREATE INDEX "InventoryLedger_ItemId_TransactionDate_idx" ON "InventoryLedger"("ItemId", "TransactionDate");

-- CreateIndex
CREATE INDEX "InventoryLedger_TransactionType_TransactionDate_idx" ON "InventoryLedger"("TransactionType", "TransactionDate");

-- CreateIndex
CREATE INDEX "InventoryLedger_ReferenceDoc_idx" ON "InventoryLedger"("ReferenceDoc");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLedger_ItemId_IdempotencyKey_key" ON "InventoryLedger"("ItemId", "IdempotencyKey");

-- CreateIndex
CREATE INDEX "BusinessCommand_CreatedAt_idx" ON "BusinessCommand"("CreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCommand_Operation_CommandKey_key" ON "BusinessCommand"("Operation", "CommandKey");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_RecordNumber_key" ON "StockOpname"("RecordNumber");

-- CreateIndex
CREATE INDEX "StockOpname_Status_CreatedAt_idx" ON "StockOpname"("Status", "CreatedAt");

-- CreateIndex
CREATE INDEX "StockOpnameSelection_ItemId_idx" ON "StockOpnameSelection"("ItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameSelection_OpnameId_ItemId_key" ON "StockOpnameSelection"("OpnameId", "ItemId");

-- CreateIndex
CREATE INDEX "StockOpnameDetail_ItemId_idx" ON "StockOpnameDetail"("ItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpnameDetail_OpnameId_ItemId_key" ON "StockOpnameDetail"("OpnameId", "ItemId");

-- CreateIndex
CREATE INDEX "StockOpnameAttachment_OpnameId_idx" ON "StockOpnameAttachment"("OpnameId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordNumberCounter_Prefix_BusinessDate_key" ON "RecordNumberCounter"("Prefix", "BusinessDate");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_SsoObjectId_key" ON "AppUser"("SsoObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_Email_key" ON "AppUser"("Email");

-- CreateIndex
CREATE INDEX "AppUser_RoleId_idx" ON "AppUser"("RoleId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_Name_key" ON "AppRole"("Name");

-- CreateIndex
CREATE UNIQUE INDEX "AppPermission_Action_key" ON "AppPermission"("Action");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_Prefix_key" ON "ApiKey"("Prefix");

-- CreateIndex
CREATE INDEX "ProcessLog_StartedAt_idx" ON "ProcessLog"("StartedAt");

-- CreateIndex
CREATE INDEX "ProcessLog_Status_idx" ON "ProcessLog"("Status");

-- CreateIndex
CREATE INDEX "ProcessLogDetail_ProcessId_CreatedAt_idx" ON "ProcessLogDetail"("ProcessId", "CreatedAt");

-- CreateIndex
CREATE INDEX "ActionAuditEvent_EntityType_EntityId_idx" ON "ActionAuditEvent"("EntityType", "EntityId");

-- CreateIndex
CREATE INDEX "ActionAuditEvent_CreatedAt_idx" ON "ActionAuditEvent"("CreatedAt");

-- CreateIndex
CREATE INDEX "_AppPermissionToAppRole_B_index" ON "_AppPermissionToAppRole"("B");

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "InventoryItem"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_ReversalOfId_fkey" FOREIGN KEY ("ReversalOfId") REFERENCES "InventoryLedger"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameSelection" ADD CONSTRAINT "StockOpnameSelection_OpnameId_fkey" FOREIGN KEY ("OpnameId") REFERENCES "StockOpname"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameSelection" ADD CONSTRAINT "StockOpnameSelection_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "InventoryItem"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_OpnameId_fkey" FOREIGN KEY ("OpnameId") REFERENCES "StockOpname"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "InventoryItem"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOpnameAttachment" ADD CONSTRAINT "StockOpnameAttachment_OpnameId_fkey" FOREIGN KEY ("OpnameId") REFERENCES "StockOpname"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "AppRole"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessLogDetail" ADD CONSTRAINT "ProcessLogDetail_ProcessId_fkey" FOREIGN KEY ("ProcessId") REFERENCES "ProcessLog"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppPermissionToAppRole" ADD CONSTRAINT "_AppPermissionToAppRole_A_fkey" FOREIGN KEY ("A") REFERENCES "AppPermission"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppPermissionToAppRole" ADD CONSTRAINT "_AppPermissionToAppRole_B_fkey" FOREIGN KEY ("B") REFERENCES "AppRole"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Inventory invariants are also enforced in PostgreSQL so application bugs cannot
-- create a negative balance or a ledger row with invalid arithmetic.
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_non_negative_balance" CHECK ("CurrentBalance" >= 0 AND "MinimumStock" >= 0);
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_non_negative_quantities" CHECK ("QtyIn" >= 0 AND "QtyOut" >= 0 AND "BalanceBefore" >= 0 AND "BalanceAfter" >= 0);
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_balance_equation" CHECK ("BalanceAfter" = "BalanceBefore" + "QtyIn" - "QtyOut");
ALTER TABLE "StockOpnameDetail" ADD CONSTRAINT "StockOpnameDetail_non_negative_quantities" CHECK ("SystemQty" >= 0 AND ("ActualQty" IS NULL OR "ActualQty" >= 0));

CREATE FUNCTION reject_inventory_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'InventoryLedger is immutable; post a reversal entry instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InventoryLedger_immutable_update"
BEFORE UPDATE OR DELETE ON "InventoryLedger"
FOR EACH ROW EXECUTE FUNCTION reject_inventory_ledger_mutation();

CREATE FUNCTION reject_action_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ActionAuditEvent is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActionAuditEvent_immutable_update"
BEFORE UPDATE OR DELETE ON "ActionAuditEvent"
FOR EACH ROW EXECUTE FUNCTION reject_action_audit_mutation();

-- Minimum IAM bootstrap data. The SUPER role is not assigned automatically;
-- the configured bootstrap email receives it only on first SSO provisioning.
WITH permissions(action) AS (VALUES
  ('MTC.DASHBOARD.READ'), ('MTC.ITEM.READ'), ('MTC.ITEM.CREATE'), ('MTC.ITEM.UPDATE'),
  ('MTC.ITEM.ARCHIVE'), ('MTC.ITEM.IMPORT'), ('MTC.ITEM.EXPORT'), ('MTC.STOCK.READ'),
  ('MTC.STOCK.IN'), ('MTC.STOCK.OUT'), ('MTC.STOCK.SCRAP'), ('MTC.OPNAME.READ'),
  ('MTC.OPNAME.CREATE'), ('MTC.OPNAME.UPDATE'), ('MTC.OPNAME.CANCEL'), ('MTC.OPNAME.APPROVE'),
  ('MTC.USER_MANAGEMENT'), ('MTC.ROLE_MANAGEMENT'), ('MTC.API_KEY_MANAGEMENT'), ('MTC.SYSTEM_LOG_READ')
)
INSERT INTO "AppPermission" ("Id", "Action")
SELECT (md5(action)::uuid)::text, action FROM permissions;

INSERT INTO "AppRole" ("Id", "Name", "Description", "IsSystem", "CreatedBy", "UpdatedAt")
VALUES ((md5('role:SUPER')::uuid)::text, 'SUPER', 'MTC system administrator', true, 'migration', CURRENT_TIMESTAMP);

INSERT INTO "_AppPermissionToAppRole" ("A", "B")
SELECT "Id", (md5('role:SUPER')::uuid)::text FROM "AppPermission";
