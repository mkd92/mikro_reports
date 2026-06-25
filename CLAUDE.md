# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs backend + frontend concurrently)
npm run dev

# Production
npm run build          # Build frontend only (outputs to frontend/dist)
npm run start:prod     # Production server (ts-node)

# Frontend only (from frontend/)
npm run dev            # Vite dev server at http://localhost:5173
npm run lint           # ESLint check
npm run preview        # Preview production build
```

- Backend runs at `http://localhost:3001`, frontend at `http://localhost:5173`
- No test suite exists — manual verification only
- No backend build step; `ts-node-dev` hot-reloads `server.ts` in dev

## Architecture

This is a **full-stack TypeScript monorepo** — backend at the root, frontend in `frontend/`. No workspace tooling; root `package.json` uses `concurrently` to start both.

### Backend (`server.ts`)

Single Express 5 file (~1,078 lines) connecting to a **read-only Supabase PostgreSQL** instance. All queries run with `SET default_transaction_read_only = on`. No ORM — raw parameterized SQL via the `pg` driver.

API prefix is `/api`. Endpoint groups:
- `/api/sales/` — summary, monthly, trend
- `/api/team/` — list, performance, customer-mix, one-time-customers, bought-again-customers
- `/api/customers/` — top, ar-aging
- `/api/items/` — top
- `/api/risk/` — customers (CRITICAL/HIGH/MEDIUM/WATCH scoring)
- `/api/delivery/` — pipeline, orders
- `/api/reports/` — daily
- `/api/followup/` — customers
- `/api/map/` — customers (lat/lng for Leaflet)
- `/api/dev/` — schema, geo-sample, party-groups, ungrouped-invoices

All queries hard-code `organization_id = 2` and `site_id IN (1, 4)` (Mogappair & Medavakkam). Date parameters are ISO strings (YYYY-MM-DD). Currency is INR.

Key tables: `vouchers`, `voucher_types` (SINV = Sales Invoice), `parties`, `party_groups`, `items`, `voucher_items`, `delivery_challans`, `document_status_history`, `users`.

### Frontend (`frontend/src/`)

React 19 + Vite SPA. No React Router — navigation is state-based (`activeTab`). No state management library — pure `useState`/`useEffect`. HTTP via Axios to `${VITE_API_BASE}/api/...` (defaults to `/api`, proxied by Vite to `localhost:3001` in dev).

Key files:
- `App.tsx` — root; renders Dashboard
- `Dashboard.tsx` — main component (~2,243 lines); contains all tab views and data-fetching
- `MapPage.tsx` — Leaflet/React-Leaflet geospatial map
- `Dashboard.css` — all styling (~41 KB, vanilla CSS, dark enterprise theme)

Tab views inside `Dashboard.tsx`: `home`, `team`, `customers`, `inventory`, `delivery`, `followup`, `map`.

Charts use **Recharts**; maps use **React-Leaflet + Leaflet**; icons use **Lucide React**.

### Theme

Dark theme: `#0f172a` background, `#1e293b` containers. Accent colors: amber (`#f59e0b`) for totals, blue (`#3b82f6`) for Mogappair, green (`#10b981`) for Medavakkam, red (`#ef4444`) for risk/danger.

### Production

Express serves `frontend/dist` as static files. Railway.app deployment: build runs `npm install && npm run build`, start runs `NODE_ENV=production npm run start:prod`.

## Adding Features

- **New API endpoint**: Add route handler to `server.ts` with a parameterized SQL query
- **New UI section**: Add state + `useEffect` fetch to `Dashboard.tsx`; add CSS classes to `Dashboard.css`
- **New page**: Create a component file (like `MapPage.tsx`) and add a tab case in `Dashboard.tsx`
