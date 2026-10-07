# MTC Inventory System

Full-stack inventory management for MTC, built as a pnpm monorepo.

## Applications

- `apps/api`: NestJS 11, Prisma 7, PostgreSQL API on port `31000`.
- `apps/web`: Next.js 16, React 19, Ant Design 6 web application on port `31001`.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`.
2. Configure a confidential Vuteq SSO client for the web callback, logout, backchannel logout, and API audience.
3. Run `pnpm install`, `pnpm prisma:generate`, and `docker compose up -d postgres redis`.
4. Apply migrations with `pnpm db:migrate`, seed permissions with `pnpm db:seed`, then start `pnpm dev:api` and `pnpm dev:web`.

The operator kiosk is available at `http://localhost:31001/display` without an SSO login. Its keyboard-first flow scans an exact part number, accepts quantity and operator name, then submits on Enter. For local development, `pnpm db:seed` generates an ignored server-side display key when one is not configured. Production must provide the same strong `MTC_DISPLAY_API_KEY` to the API seeder and web service. The key is never returned to the browser.

See `docs/OPERATIONS.md` for deployment and recovery procedures.


### Part Master migration (2026-10-07)

Part Master uses Name, Model, Specification, and AddressLocation. Unit, stock thresholds, balances, and audit fields remain operational fields. The display scanner now resolves the unique rack location directly; replace labels containing old item codes or serial numbers with location labels. Download the new XLSX template before importing.

Before deploying `20261007000000_part_master_fields`, confirm the target database and back up InventoryItem: this migration drops ItemCode, Brand, and SerialNumber. Model values, item IDs, locations, and ledger/counting relations are preserved; Specification starts empty. Deploy the API and web together with the migration (`pnpm db:migrate`) and regenerate Prisma (`pnpm prisma:generate`) during the build. Do not run a seed or reset to migrate existing inventory.

Set the web server's `VUTEQ_SSO_PUBLIC_ORIGIN` to the exact browser-facing origin (scheme, host, optional port; no `/mtc` path), e.g. `https://apps3.vuteq.co.id`. Both the display and authenticated BFF validate mutation origins against this value. Restart the web server after changing it. Verify create/update, counting submission, and display stock in/out on the deployed URL after migration.
