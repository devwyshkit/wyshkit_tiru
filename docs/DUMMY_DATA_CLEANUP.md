# Dummy Data Cleanup Guide

**WYSHKIT 2026**: Before production, remove seed/dummy data. Run these only after backing up your database.

## What to Remove

### 1. Seed Partners (00000000-* UUID pattern)
- `00000000-0000-0000-0000-000000000011` — The Personalization Studio
- `00000000-0000-0000-0000-000000000012` — Custom Threads
- `00000000-0000-0000-0000-000000000013` — TechWraps
- `00000000-0000-4000-a000-000000000090` — Wyshkit Alpha Vendor (status=inactive)

### 2. Seed Items
Items with partner_id in the seed partner list above.

### 3. Duplicate Partners
Two "Rahul Sharma" / "Sharma Electronics & Wyshkit Store" partners exist. Consolidate or remove one.

## SQL Cleanup (Run in Supabase SQL Editor)

```sql
-- BACKUP FIRST! Then run in order:

-- 1. Delete items belonging to seed partners
DELETE FROM items
WHERE partner_id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-4000-a000-000000000090'
);

-- 2. Delete seed partners (after removing FK dependencies)
DELETE FROM partner_users WHERE partner_id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-4000-a000-000000000090'
);
DELETE FROM partners
WHERE id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-4000-a000-000000000090'
);

-- 3. Duplicate partners: review manually
-- SELECT id, name, display_name, created_at FROM partners WHERE name = 'Rahul Sharma';
-- Merge orders/items to one partner, then delete the duplicate.
```

## Test Coupon
- `WYSH2026` is hardcoded in `place_secure_order` RPC. Remove or move to `coupons` table before production.

## Environment Flags
- `NEXT_PUBLIC_BYPASS_PAYMENT=true` — Must be unset or false in production.

## Security (Supabase Dashboard)
- **Leaked password protection**: Enable in Auth → Settings so Supabase rejects compromised passwords (HaveIBeenPwned).

## Supabase audit (reference)
- **spatial_ref_sys**: RLS cannot be enabled (extension-owned table). Acceptable; restrict anon access if needed.
- **postgis / vector**: Extensions in `public` schema; optional later move to `extensions` schema.
- **Leaked password protection**: Enable in Auth → Settings (see Security above).
- **Unused indexes**: Advisor may report unused indexes; leave until query patterns are confirmed, then remove in a performance pass.
