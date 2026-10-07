-- Back up InventoryItem before deployment: the three removed metadata columns are not recoverable after this migration.
-- Keep item IDs, Model, locations, balances, and all ledger/history relations unchanged.
ALTER TABLE "InventoryItem" ADD COLUMN "Specification" VARCHAR(1000);
ALTER TABLE "InventoryItem" DROP COLUMN "ItemCode", DROP COLUMN "Brand", DROP COLUMN "SerialNumber";
