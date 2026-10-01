# MTC Architecture

## Trust boundary

The browser talks only to the Next.js application. The Next.js BFF stores Vuteq SSO tokens in Redis, exposes an HTTP-only session cookie, and forwards only versioned relative API paths. NestJS accepts a Vuteq bearer token from the BFF or a hashed MTC API key. Local roles add application-specific permissions after SSO identity verification.

## Inventory consistency

`InventoryLedger` is the stock source of truth. `InventoryItem.CurrentBalance` is a projection used for fast reads. A stock command runs in a PostgreSQL serializable transaction, acquires an advisory lock for the item, reconciles the cache against the ledger, claims its idempotency key, writes the immutable ledger row, and updates the cache.

The database migration enforces the balance equation and non-negative quantities and rejects update/delete operations on ledger rows. Corrections must be posted as new reversal transactions.

## Stock opname lifecycle

1. A user creates a `DRAFT` for selected items or all active items.
2. Start resolves the scope to concrete details, snapshots balances, rejects overlapping active sessions, and freezes stock mutation only for those items.
3. Counters save physical quantities individually or in a batch.
4. A different user with approval permission confirms the completed counts.
5. Approval creates one `STOCK_OPNAME_DIFF` ledger row per detail, including zero variance, updates the cache, and completes the session atomically.

PDF/JPEG/PNG evidence is stored in private mounted storage and can only be accessed through authenticated endpoints. Worksheets use XLSX; the final variance report is PDF.

## Modules

- `inventory-items`: item lifecycle, archive/reactivate, lookup, XLSX export.
- `imports`: CSV preview and idempotent commit with opening ledger entries.
- `stock-transactions`: IN, OUT, SCRAP, ledger history, reconciliation.
- `inventory-counting`: scope, snapshot, freeze, counting, approval, reports, attachments.
- `user-management`: users, roles, permissions, API keys.
- `system-log`: process and immutable action audit reads.
- `dashboard` and `health`: operational summaries and probes.
