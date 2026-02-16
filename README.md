# WyshKit

**Hyperlocal product marketplace with optional personalization** — think Swiggy for products.

## Core model

- **One cart = one partner.** You shop from a single store per session.
- **Pay first, then personalization.** Place and pay for the order; when an item needs personalization (e.g. engraving), you provide input after payment.
- **One order, one partner, one delivery.** Single checkout and fulfilment per order. For orders with personalization, the full order is dispatched when all items (including design input) are ready.
- **Cashback:** Fixed 2% on delivery (credited to wallet); rules UI not yet available.

## Stack

- **Next.js 15**, **React 19**
- **Supabase**: Postgres, Auth, Realtime
- Server actions + Supabase RPCs; no separate API server

## Run locally

```bash
npm install
npm run dev
```

Required environment variables: Supabase URL and key, Razorpay (or payment) keys, and any other vars your app expects. See your env example or deployment docs.

## Production and dummy data

See **[docs/DUMMY_DATA_CLEANUP.md](docs/DUMMY_DATA_CLEANUP.md)** for production prep, env flags, and removing seed/dummy data.
