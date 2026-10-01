# MTC Monorepo

MTC is a pnpm workspace with a Next.js frontend in `apps/web` and a NestJS/Prisma API in `apps/api`.

- Inventory ledger is the stock source of truth. `InventoryItem.CurrentBalance` is only a cache.
- Every stock mutation must atomically write a ledger row and update the cache.
- Never mutate or delete existing ledger rows. Corrections use explicit reversal transactions.
- Use Vuteq SSO through the Next.js BFF. Access and refresh tokens must never reach browser JavaScript.
- Business API calls belong in typed Redux thunks and must use the shared authenticated API utility.
- Use server-side table filtering/pagination and current Ant Design 6 APIs.
- Keep all visible UI and accessibility copy in English.
- Do not edit generated Prisma files.
- Do not run destructive database commands or migrations against an unknown database.

Verification: `pnpm prisma:validate`, `pnpm lint`, `pnpm test`, and `pnpm build`.
