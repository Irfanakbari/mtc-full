# UAT Checklist

- [ ] Vuteq SSO login provisions a local user without business permissions.
- [ ] Administrator assigns a role; menu visibility and API authorization match the role.
- [ ] Create an item with a two-decimal opening balance and verify its opening ledger entry.
- [ ] Duplicate item code and address are rejected.
- [ ] CSV preview reports row numbers without writing; commit imports each valid row once.
- [ ] Stock IN, OUT, and SCRAP update the balance and append one ledger row each.
- [ ] Insufficient stock and repeated idempotency requests do not duplicate stock changes.
- [ ] Archive is rejected for non-zero balance or active inventory counting.
- [ ] Selected-item opname freezes only selected items; all-active scope is fixed at start.
- [ ] Overlapping active opname, incomplete approval, and self-approval are rejected.
- [ ] Second-user approval writes variance and zero-difference ledger entries atomically.
- [ ] Worksheet, final PDF, and authenticated PDF/JPEG/PNG evidence work.
- [ ] Reconciliation reports every item as reconciled.
- [ ] System log, API key one-time secret, revoke, and audit views work.
- [ ] Restarting Compose preserves database records, Redis configuration, and documents.
