# Operations Runbook

## Local development

Requirements: Node.js 22, pnpm 10, PostgreSQL 16, Redis 7, and a registered confidential Vuteq SSO client.

1. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`.
2. Set the database, SSO secret, public origin, Redis password, allowed client ID, and optional bootstrap administrator email.
3. Run `pnpm install`, `pnpm prisma:generate`, `pnpm db:migrate`, and `pnpm db:seed`.
4. Start the API with `pnpm dev:api` and web with `pnpm dev:web`.
5. Verify `GET http://localhost:31000/v1/health/live`, `GET http://localhost:31001/mtc/api/health`, and open `http://localhost:31001/mtc/`.

The web application is mounted at `/mtc`. Configure the reverse proxy to forward `/mtc` and every `/mtc/*` request to the web service without stripping the prefix. `VUTEQ_SSO_PUBLIC_ORIGIN` must remain an origin only (for example, `https://apps3.vuteq.co.id`) and must not contain `/mtc`.

Register these exact Vuteq SSO URLs for production:

- Callback: `https://apps3.vuteq.co.id/mtc/auth/callback`
- Post logout: `https://apps3.vuteq.co.id/mtc/`
- Back-channel logout: `https://apps3.vuteq.co.id/mtc/api/auth/backchannel-logout`

For local development, register the same paths under `http://localhost:31001`.

## Operator display

`/mtc/display` is a public kiosk page for Stock In and Stock Out. It does not require an SSO session. Its BFF routes authenticate to the API with a server-only, least-privilege key.

1. Generate a strong value beginning with `mtc_` and containing at least 32 characters in total.
2. Set the same `MTC_DISPLAY_API_KEY` in the API/seeder and web server environments. Never expose it through a `NEXT_PUBLIC_` variable.
3. Run `pnpm db:seed`. The seeder creates or rotates `MTC Operator Display` with only `MTC.ITEM.READ`, `MTC.STOCK.IN`, and `MTC.STOCK.OUT`.
4. Restart the web service, open `/mtc/display`, and verify item search plus one controlled Stock In/Out transaction.

The BFF requires same-origin mutation requests, applies a per-process request limit, accepts only the two stock operations, validates all fields, and records the entered operator name in ledger notes. For production, expose only the web service and restrict `/mtc/display` to the warehouse network at the reverse proxy when possible.

For local development only, if `MTC_DISPLAY_API_KEY` is absent, `pnpm db:seed` generates a strong key in ignored file `apps/api/.env.display`. The development BFF reads that file server-side. Production always requires the explicit environment variable.

The bootstrap administrator email is applied only when that SSO identity is first provisioned. Clear the variable after initial role assignment.

## Production with Compose

Copy `.env.example` to `.env`, replace every placeholder, set the public HTTPS origin, and run:

```powershell
docker compose build
docker compose up -d
docker compose ps
```

The API container runs `prisma migrate deploy` before startup. PostgreSQL, Redis sessions, and stock-opname documents use separate named volumes. Put a TLS reverse proxy in front of the web service and expose only port 31001 to users. Port 31000 should remain on the private application network unless operational access is explicitly required.

## Backup and restore

Back up both PostgreSQL and the `mtc_documents` volume at the same recovery point. Redis is session-only and does not need business-data recovery.

```powershell
docker compose exec -T postgres pg_dump -U postgres -Fc mtc > mtc.dump
docker run --rm -v mtc-full_mtc_documents:/source -v ${PWD}:/backup alpine tar czf /backup/mtc-documents.tgz -C /source .
```

Restore into an empty database, restore the document volume, deploy migrations, then run the reconciliation endpoint using an administrator API key. Do not open write traffic until every item reports `reconciled: true`.

## Release quality gate

```powershell
pnpm prisma:validate
pnpm lint
pnpm test
pnpm build
docker compose config
```

For release smoke testing, confirm login, permission-hidden menus, item creation with opening balance, IN/OUT/SCRAP, CSV preview and commit, ledger export/filtering, complete stock opname approval by a second user, worksheet/PDF download, and attachment upload/download.

## Incident handling

- Ledger/cache mismatch: stock writes fail closed. Stop writes for the item, preserve logs, identify the invalid source, and post an approved correction; never edit the ledger.
- SSO unavailable: existing server sessions may continue until expiry, but authentication failures remain closed. Check SSO metadata reachability and client registration.
- Document storage unavailable: stop attachment writes and restore the volume. Inventory transactions are independent of attachment storage.
- Migration failure: keep the previous application image running, retain database backups, correct the forward migration, and redeploy. Never use `migrate reset` in production.
