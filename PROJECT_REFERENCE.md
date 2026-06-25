# Mikro DB Dashboard — Project Reference

Complete reference for replicating or extending this project (e.g. Flutter mobile app).

---

## Overview

Analytics dashboard for **Mikro DB** — a food distribution business with two sites:
- **Site 1 — Mogappair** (branch code `1`)
- **Site 4 — Medavakkam** (branch code `4`)

All data lives in a **read-only Supabase PostgreSQL** instance (`organization_id = 2`). Currency is **INR**. Dates are `YYYY-MM-DD`.

---

## Database Connection

```
Host:     db.wbtpqswyxgdjohklhlks.supabase.co
Port:     5432
User:     mikro_read_only
Database: postgres
SSL:      require
```

**Important:** The direct host resolves to IPv6 on some cloud providers (e.g. Render free tier). Use Supabase's connection pooler instead:
- Go to Supabase Dashboard → Settings → Database → Connection Pooling
- Use the pooler host (e.g. `aws-0-ap-south-1.pooler.supabase.com`)
- Username format changes to: `mikro_read_only.wbtpqswyxgdjohklhlks`
- Port: `6543` (transaction mode) or `5432` (session mode)

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `vouchers` | Every sales invoice. Key columns: `id`, `voucher_number`, `transaction_date`, `total_amount`, `amount_due`, `payment_status`, `delivery_status`, `party_id`, `site_id`, `organization_id`, `is_cancelled`, `created_at` |
| `voucher_types` | Lookup table. `code = 'SINV'` means Sales Invoice |
| `parties` | Customers AND salesmen. `responsible_party_id` links customer → their salesman. `party_group_id` = customer category |
| `party_groups` | Customer categories (e.g. id=1: Retail, id=2: Corporate) |
| `items` | Products. Columns: `id`, `name`, `code` |
| `voucher_items` | Line items on invoices. Columns: `voucher_id`, `item_id`, `quantity`, `total_amount` |
| `delivery_challans` | Delivery documents. `related_invoice_voucher_id` links to vouchers |
| `document_status_history` | Delivery status timeline. `document_id` = delivery challan id, `new_status`, `changed_at`, `changed_by` (user id) |
| `users` | Staff. `full_name` used for delivery agent names |

### Delivery Status Values
`not_delivered` → `packed` → `shipped` / `in_transit` → `fully_delivered` / `partially_delivered`

### Business Rules Hard-Coded in Queries
- `organization_id = 2` (always)
- `site_id IN (1, 4)` (both branches)
- `voucher_type.code = 'SINV'` (sales invoices only)
- `is_cancelled = false` (exclude cancelled)
- Corporate customers: `party_group_id = 2`

---

## Backend API

Base URL: `https://mikro-reports.onrender.com/api` (production)  
Local: `http://localhost:3001/api`

All endpoints return JSON. Errors return `{ "error": "Database error" }` with HTTP 500.

---

### Sales

#### `GET /api/sales/summary`
Today vs Yesterday vs Same Day Last Week.

**Response:**
```json
[
  { "label": "Today", "transaction_date": "2026-06-25", "invoice_count": 42, "sales": 125000 },
  { "label": "Yesterday", ... },
  { "label": "Same day last week", ... }
]
```

---

#### `GET /api/sales/monthly`
Monthly sales per site for the last 6 months.

**Response:**
```json
[
  { "month": "2026-06-01", "mogappair": 850000, "medavakkam": 620000, "total_sales": 1470000 }
]
```

---

#### `GET /api/sales/trend`
Daily / weekly / monthly sales trend with optional corporate filter.

**Query params:**
| Param | Default | Notes |
|-------|---------|-------|
| `granularity` | `monthly` | `daily`, `weekly`, `monthly` |
| `from` | Jan 1 this year | YYYY-MM-DD |
| `to` | today | YYYY-MM-DD |
| `exclude_corporate` | `false` | `true` to exclude party_group_id=2 |

**Response:**
```json
[
  { "date": "2026-06-01", "mogappair": 850000, "medavakkam": 620000, "total_sales": 1470000 }
]
```

---

### Team (Salesmen)

#### `GET /api/team/list`
All salesmen (for filter dropdowns).

**Response:** `[{ "id": 5, "name": "Ravi Kumar" }]`

---

#### `GET /api/team/performance`
Salesman revenue leaderboard.

**Query params:** `from`, `to` (default: this month)

**Response:**
```json
[
  { "id": 5, "name": "Ravi Kumar", "distinct_customers": 38, "invoice_count": 120, "revenue": 450000 }
]
```

---

#### `GET /api/team/customer-mix`
New customer conversions per salesman — how many bought again vs stayed one-time.

**Query params:** `from`, `to`

**Response:**
```json
[
  { "salesman_id": 5, "salesman_name": "Ravi Kumar", "conversions": 12, "bought_again": 8, "one_time": 4 }
]
```

---

#### `GET /api/team/one-time-customers`
Drill-down: customers who ordered exactly once, optionally for one salesman.

**Query params:** `from`, `to`, `salesman_id` (optional)

**Response:**
```json
[
  { "customer_id": 101, "customer_name": "ABC Store", "first_date": "2026-06-10",
    "first_invoice": "SINV-001", "first_amount": 2500, "total_spent": 2500 }
]
```

---

#### `GET /api/team/bought-again-customers`
Drill-down: repeat customers, optionally for one salesman.

**Query params:** `from`, `to`, `salesman_id` (optional)

**Response:**
```json
[
  { "customer_id": 101, "customer_name": "ABC Store", "first_date": "2026-05-01",
    "first_invoice": "SINV-001", "first_amount": 2500, "invoice_count": 6,
    "total_spent": 18000, "last_order_date": "2026-06-20" }
]
```

---

### Customers

#### `GET /api/customers/top`
All customers with sales metrics and AR (accounts receivable) data.

**Query params:** `from`, `to`, `rp_id` (salesman filter, optional)

**Response:**
```json
[
  { "id": 101, "name": "ABC Store", "responsible_party": "Ravi Kumar",
    "invoice_count": 12, "total_sales": 45000, "avg_order_value": 3750,
    "last_order_date": "2026-06-20", "days_inactive": 5, "orders_per_month": 4.0,
    "pending": 12000, "unpaid_count": 2, "oldest_unpaid_days": 18 }
]
```

---

#### `GET /api/customers/ar-aging`
Accounts receivable bucketed by age.

**Response:**
```json
[
  { "age_bucket": "0-30", "invoice_count": 45, "outstanding": 125000 },
  { "age_bucket": "31-60", "invoice_count": 12, "outstanding": 48000 },
  { "age_bucket": "61-90", "invoice_count": 5, "outstanding": 22000 },
  { "age_bucket": "90+", "invoice_count": 3, "outstanding": 18000 }
]
```

---

### Inventory

#### `GET /api/items/top`
Top 20 items by revenue in last 90 days.

**Response:**
```json
[
  { "id": 1, "name": "Basmati Rice 5kg", "code": "RICE-BAS-5",
    "units_sold": 450, "revenue": 180000 }
]
```

---

### Risk

#### `GET /api/risk/customers`
Customers flagged by risk scoring (overdue payments + inactivity).

**Query params:** `rp_id` (salesman filter, optional)

**Risk levels:**
- `CRITICAL` — oldest unpaid > 90 days
- `HIGH` — oldest unpaid > 60 days OR (pending > ₹75k AND unpaid > 30 days)
- `MEDIUM` — oldest unpaid > 30 days OR pending > ₹15k OR inactive > 30 days
- `WATCH` — everything else with pending balance or inactive > 14 days

**Risk score formula:**
```
(oldest_unpaid_days × 3) + (pending_amount / 1000) + (unpaid_count × 8)
+ (if inactive>30 AND pending>0: days_inactive × 2)
```

**Response:**
```json
[
  { "id": 101, "name": "ABC Store", "responsible_party": "Ravi Kumar",
    "last_order_date": "2026-05-10", "days_inactive": 45,
    "invoices_6m": 8, "sales_6m": 32000,
    "pending": 25000, "unpaid_count": 3, "oldest_unpaid_days": 65,
    "oldest_unpaid_date": "2026-04-20",
    "risk_level": "HIGH", "risk_score": 390 }
]
```

---

### Delivery

#### `GET /api/delivery/pipeline`
Delivery status snapshot + timing stats + 7-day trend for a given date.

**Query params:** `date` (default: today)

**Response:**
```json
{
  "snapshot": [
    { "delivery_status": "not_delivered", "count": 5 },
    { "delivery_status": "packed", "count": 12 },
    { "delivery_status": "fully_delivered", "count": 38 }
  ],
  "timing": {
    "delivered_count": 38,
    "avg_minutes": 87.5,
    "min_minutes": 42.0,
    "max_minutes": 180.0
  },
  "trend": [
    { "date": "2026-06-19", "total_orders": 55, "delivered": 48, "pending": 7, "avg_minutes": 92.3 }
  ]
}
```

---

#### `GET /api/delivery/orders`
Per-order delivery timeline with timestamps for each stage.

**Query params:** `from`, `to`, `status` (delivery_status filter, optional)

**Response:**
```json
[
  { "id": 2001, "voucher_number": "SINV-2001", "transaction_date": "2026-06-25",
    "delivery_status": "fully_delivered", "site_id": 1, "customer": "ABC Store",
    "total_amount": 3500, "invoice_created_at": "2026-06-25T08:00:00Z",
    "packed_at": "2026-06-25T09:15:00Z", "shipped_at": "2026-06-25T09:45:00Z",
    "delivered_at": "2026-06-25T11:00:00Z", "delivery_person": "Muthu" }
]
```

---

### Reports

#### `GET /api/reports/daily`
Full daily report: sales by site + group + salesman, delivery timing, new customer conversions.

**Query params:** `date` (default: today)

**Response:**
```json
{
  "date": "2026-06-25",
  "sales": {
    "summary": [{ "site_id": 1, "site_name": "Mogappair", "invoice_count": 42, "total_amount": 125000 }],
    "groups": [{ "site_id": 1, "group_name": "Retail", "invoice_count": 30, "total_amount": 85000 }],
    "salesmen": [{ "site_id": 1, "salesman_name": "Ravi Kumar", "invoice_count": 20, "total_amount": 60000 }]
  },
  "delivery": {
    "site_timing": [{
      "site_id": 1, "site_name": "Mogappair", "total_orders": 42, "delivered_count": 38,
      "avg_order_to_packed": 45.2, "avg_packed_to_shipped": 18.5,
      "avg_shipped_to_delivered": 55.8, "avg_total": 119.5
    }],
    "agents": [{ "site_id": 1, "agent_name": "Muthu", "deliveries": 15, "avg_shipped_to_delivered": 48.2 }]
  },
  "conversions": [{
    "salesman_id": 5, "salesman_name": "Ravi Kumar", "conversions": 3,
    "customers": [{ "name": "XYZ Store", "invoice": "SINV-2001" }]
  }]
}
```

---

### Follow-up

#### `GET /api/followup/customers`
Repeat customers (last 30 days) with their peak ordering day and time.

**Query params:** `min_orders` (default: 2)

**Response:**
```json
[
  { "customer_id": 101, "customer_name": "ABC Store", "group_name": "Retail",
    "salesman_id": 5, "salesman_name": "Ravi Kumar", "site_name": "Mogappair",
    "order_count": 8, "total_amount_r": 32000, "avg_order_value_r": 4000,
    "last_order_date": "2026-06-22", "first_order_date": "2026-05-25",
    "peak_dow": 2, "peak_hour": 10 }
]
```
`peak_dow`: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat  
`peak_hour`: 24h format (10 = 10 AM)

---

### Map

#### `GET /api/map/customers`
Customer locations for map display. Only customers in `party_group_id IN (1, 2)`.

**Response:**
```json
{
  "latlng": [{
    "id": 101, "name": "ABC Store", "lat": 13.0827, "lng": 80.2707,
    "group_name": "Retail", "salesman": "Ravi Kumar",
    "last_order": "2026-06-20", "order_count": 12,
    "orders_last_30d": 3, "weeks_active_30d": 2
  }],
  "gmap": [{ "id": 102, "name": "XYZ Store", "geo_location": "https://maps.google.com/...", ... }],
  "missing": [{ "id": 103, "name": "No Location Store", ... }]
}
```

---

## UI Screens (Web Dashboard Reference)

| Tab | What it shows |
|-----|--------------|
| **Dashboard (Home)** | Today/Yesterday revenue cards, Sales Trend chart (with granularity + date range controls), AR Aging bar chart, Monthly site comparison |
| **Salesmen (Team)** | Salesman leaderboard table, Customer mix (conversions/bought-again/one-time) drilldown |
| **Customers** | Full customer list with AR data, searchable + filterable by salesman |
| **Inventory** | Top 20 items by revenue (last 90 days) |
| **Delivery** | Pipeline status donut, timing KPIs, 7-day trend, per-order timeline table |
| **Risk** | Risk-scored customers (CRITICAL/HIGH/MEDIUM/WATCH) |
| **Reports** | Daily report: site breakdown, salesman contribution, delivery timing, new conversions |
| **Follow-up** | Repeat customers with peak order day/time for scheduling calls |
| **Map** | Leaflet map of customer locations, colour-coded by group |

---

## Design System (Dark Theme)

| Token | Value | Used for |
|-------|-------|---------|
| Background | `#0f172a` | Page background |
| Container | `#1e293b` | Cards, panels |
| Border | `#334155` | Dividers |
| Text primary | `#f1f5f9` | Headings |
| Text secondary | `#94a3b8` | Labels, metadata |
| Amber | `#f59e0b` | Totals, highlights |
| Blue | `#3b82f6` | Mogappair, primary actions |
| Green | `#10b981` | Medavakkam, success |
| Red | `#ef4444` | Risk / danger |
| Teal | `#14b8a6` | Partial delivery |

---

## Flutter Mobile App — Suggested Approach

1. **HTTP client:** `dio` or `http` package → point to `https://mikro-reports.onrender.com/api`
2. **State management:** `riverpod` or `provider`
3. **Charts:** `fl_chart` (similar to Recharts)
4. **Maps:** `flutter_map` + `latlong2` (similar to React-Leaflet)
5. **Auth:** None currently — the API is open. Consider adding a simple token header if needed.
6. **Start with these screens** (highest value):
   - Home: sales summary cards + trend chart
   - Risk: customer risk list (most actionable on mobile)
   - Follow-up: repeat customer list with peak times
   - Delivery: pipeline status (useful for ops team on the go)

---

## Deployment

| Environment | Details |
|------------|---------|
| Local backend | `npm run dev` → `http://localhost:3001` |
| Local frontend | `npm run dev` (from `frontend/`) → `http://localhost:5173` |
| Production | Render.com free tier → `https://mikro-reports.onrender.com` |
| Source | `https://github.com/mkd92/mikro_reports` |
| Build cmd | `npm install && npm install --prefix frontend && npm run build --prefix frontend` |
| Start cmd | `NODE_ENV=production npm run start:prod` |

**Known Render issue:** Free tier has no IPv6 outbound. Supabase direct host resolves IPv6. Fix: use Supabase connection pooler host instead of `db.*.supabase.co`.
