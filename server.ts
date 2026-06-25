import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper for read-only queries
const query = async (text: string, params?: any[]) => {
  const client = await pool.connect();
  try {
    await client.query('SET default_transaction_read_only = on');
    return await client.query(text, params);
  } finally {
    client.release();
  }
};

// 1. Sales Summary (Today vs Yesterday vs Last Week)
app.get('/api/sales/summary', async (req, res) => {
  try {
    const sql = `
      WITH s AS (
        SELECT v.transaction_date,
               SUM(v.total_amount) AS sales,
               COUNT(*)            AS invoice_count
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
          AND v.site_id IN (1, 4)
          AND v.transaction_date IN (
              CURRENT_DATE,
              CURRENT_DATE - INTERVAL '1 day',
              CURRENT_DATE - INTERVAL '7 days'
          )
        GROUP BY v.transaction_date
      )
      SELECT CASE transaction_date
               WHEN CURRENT_DATE                       THEN 'Today'
               WHEN CURRENT_DATE - INTERVAL '1 day'    THEN 'Yesterday'
               WHEN CURRENT_DATE - INTERVAL '7 days'   THEN 'Same day last week'
             END AS label,
             transaction_date,
             invoice_count,
             sales
      FROM s
      ORDER BY transaction_date DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2. Monthly Sales per Site
app.get('/api/sales/monthly', async (req, res) => {
  try {
    const sql = `
      SELECT DATE_TRUNC('month', v.transaction_date)::date AS month,
             SUM(CASE WHEN v.site_id = 1 THEN v.total_amount ELSE 0 END) AS mogappair,
             SUM(CASE WHEN v.site_id = 4 THEN v.total_amount ELSE 0 END) AS medavakkam,
             SUM(v.total_amount)                                          AS total_sales
      FROM vouchers v
      JOIN voucher_types vt ON v.voucher_type_id = vt.id
      WHERE v.organization_id = 2
        AND v.is_cancelled = false
        AND v.site_id IN (1, 4)
        AND vt.code = 'SINV'
        AND v.transaction_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY 1
      ORDER BY month DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 2b. Sales Trend — daily / weekly / monthly
app.get('/api/sales/trend', async (req, res) => {
  try {
    const trunc = ({ daily: 'day', weekly: 'week', monthly: 'month' } as Record<string, string>)
      [(req.query.granularity as string) || 'monthly'] || 'month';
    const from            = (req.query.from             as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to              = (req.query.to               as string) || new Date().toISOString().slice(0, 10);
    const excludeCorporate = req.query.exclude_corporate === 'true';

    const sql = `
      SELECT DATE_TRUNC('${trunc}', v.transaction_date)::date AS date,
             SUM(CASE WHEN v.site_id = 1 THEN v.total_amount ELSE 0 END) AS mogappair,
             SUM(CASE WHEN v.site_id = 4 THEN v.total_amount ELSE 0 END) AS medavakkam,
             SUM(v.total_amount)                                          AS total_sales
      FROM vouchers v
      JOIN voucher_types vt ON v.voucher_type_id = vt.id
      JOIN parties p        ON p.id = v.party_id
      WHERE v.organization_id = 2
        AND v.is_cancelled = false
        AND v.site_id IN (1, 4)
        AND vt.code = 'SINV'
        AND v.transaction_date BETWEEN $1 AND $2
        ${excludeCorporate ? 'AND (p.party_group_id IS NULL OR p.party_group_id <> 2)' : ''}
      GROUP BY 1
      ORDER BY date ASC
    `;
    const result = await query(sql, [from, to]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3a. Responsible party list (for customer filter dropdown)
app.get('/api/team/list', async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT rp.id, rp.name
      FROM parties p
      JOIN parties rp ON rp.id = p.responsible_party_id
      WHERE p.organization_id = 2
      ORDER BY rp.name;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Salesman Performance (Responsible Parties)
app.get('/api/team/performance', async (req, res) => {
  try {
    const from = (req.query.from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to   = (req.query.to   as string) || new Date().toISOString().slice(0, 10);
    const sql = `
      SELECT rp.id    AS id,
             rp.name  AS name,
             COUNT(DISTINCT v.party_id) AS distinct_customers,
             COUNT(*)                   AS invoice_count,
             SUM(v.total_amount)        AS revenue
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id = v.party_id
      JOIN parties rp       ON rp.id = p.responsible_party_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date BETWEEN $1 AND $2
      GROUP BY rp.id, rp.name
      ORDER BY revenue DESC;
    `;
    const result = await query(sql, [from, to]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3b. Salesman customer mix (new vs returning vs one-time)
app.get('/api/team/customer-mix', async (req, res) => {
  try {
    const from = (req.query.from as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to   = (req.query.to   as string) || new Date().toISOString().slice(0, 10);
    const sql = `
      WITH salesman_first_invoice AS (
        -- The very first invoice date for each customer, attributed to their responsible salesman
        SELECT
          rp.id   AS salesman_id,
          rp.name AS salesman_name,
          p.id    AS customer_id,
          MIN(v.transaction_date) AS first_date
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        JOIN parties p        ON p.id  = v.party_id
        JOIN parties rp       ON rp.id = p.responsible_party_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
        GROUP BY rp.id, rp.name, p.id
      ),
      conversions AS (
        -- Customers whose first invoice ever falls within the selected period
        SELECT salesman_id, salesman_name, customer_id
        FROM salesman_first_invoice
        WHERE first_date BETWEEN $1 AND $2
      ),
      all_time_count AS (
        -- Total invoice count per customer across all time
        SELECT v.party_id, COUNT(*) AS invoice_count
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
        GROUP BY v.party_id
      )
      SELECT
        c.salesman_id,
        c.salesman_name,
        COUNT(*)::int                                              AS conversions,
        COUNT(*) FILTER (WHERE atc.invoice_count > 1)::int        AS bought_again,
        COUNT(*) FILTER (WHERE atc.invoice_count = 1)::int        AS one_time
      FROM conversions c
      JOIN all_time_count atc ON atc.party_id = c.customer_id
      GROUP BY c.salesman_id, c.salesman_name
      ORDER BY conversions DESC;
    `;
    const r = await query(sql, [from, to]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3c. One-time customers drill-down for a salesman
app.get('/api/team/one-time-customers', async (req, res) => {
  try {
    const from       = (req.query.from        as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to         = (req.query.to          as string) || new Date().toISOString().slice(0, 10);
    const salesmanId = req.query.salesman_id ? parseInt(req.query.salesman_id as string, 10) : null;

    const params: any[] = [from, to];
    const salesmanFilter = salesmanId ? `AND salesman_id = $${params.push(salesmanId)}` : '';

    const sql = `
      WITH salesman_first_invoice AS (
        SELECT rp.id AS salesman_id, p.id AS customer_id, MIN(v.transaction_date) AS first_date,
               MIN(v.id) AS first_voucher_id
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        JOIN parties p        ON p.id  = v.party_id
        JOIN parties rp       ON rp.id = p.responsible_party_id
        WHERE v.organization_id = 2 AND vt.code = 'SINV' AND v.is_cancelled = false
        GROUP BY rp.id, p.id
      ),
      conversions AS (
        SELECT salesman_id, customer_id, first_date, first_voucher_id
        FROM salesman_first_invoice
        WHERE first_date BETWEEN $1 AND $2
        ${salesmanFilter}
      ),
      all_time_count AS (
        SELECT v.party_id, COUNT(*) AS invoice_count, SUM(v.total_amount) AS total_spent
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.organization_id = 2 AND vt.code = 'SINV' AND v.is_cancelled = false
        GROUP BY v.party_id
      )
      SELECT
        p.id             AS customer_id,
        p.name           AS customer_name,
        c.first_date,
        v.voucher_number AS first_invoice,
        v.total_amount   AS first_amount,
        atc.total_spent
      FROM conversions c
      JOIN all_time_count atc ON atc.party_id = c.customer_id AND atc.invoice_count = 1
      JOIN parties p          ON p.id = c.customer_id
      JOIN vouchers v         ON v.id = c.first_voucher_id
      ORDER BY c.first_date DESC, p.name;
    `;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3d. Bought-again customers drill-down for a salesman
app.get('/api/team/bought-again-customers', async (req, res) => {
  try {
    const from       = (req.query.from        as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to         = (req.query.to          as string) || new Date().toISOString().slice(0, 10);
    const salesmanId = req.query.salesman_id ? parseInt(req.query.salesman_id as string, 10) : null;

    const params: any[] = [from, to];
    const salesmanFilter = salesmanId ? `AND salesman_id = $${params.push(salesmanId)}` : '';

    const sql = `
      WITH salesman_first_invoice AS (
        SELECT rp.id AS salesman_id, p.id AS customer_id, MIN(v.transaction_date) AS first_date,
               MIN(v.id) AS first_voucher_id
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        JOIN parties p        ON p.id  = v.party_id
        JOIN parties rp       ON rp.id = p.responsible_party_id
        WHERE v.organization_id = 2 AND vt.code = 'SINV' AND v.is_cancelled = false
        GROUP BY rp.id, p.id
      ),
      conversions AS (
        SELECT salesman_id, customer_id, first_date, first_voucher_id
        FROM salesman_first_invoice
        WHERE first_date BETWEEN $1 AND $2
        ${salesmanFilter}
      ),
      all_time_count AS (
        SELECT v.party_id, COUNT(*) AS invoice_count, SUM(v.total_amount) AS total_spent,
               MAX(v.transaction_date) AS last_order_date
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.organization_id = 2 AND vt.code = 'SINV' AND v.is_cancelled = false
        GROUP BY v.party_id
      )
      SELECT
        p.id               AS customer_id,
        p.name             AS customer_name,
        c.first_date,
        v.voucher_number   AS first_invoice,
        v.total_amount     AS first_amount,
        atc.invoice_count,
        atc.total_spent,
        atc.last_order_date
      FROM conversions c
      JOIN all_time_count atc ON atc.party_id = c.customer_id AND atc.invoice_count > 1
      JOIN parties p          ON p.id = c.customer_id
      JOIN vouchers v         ON v.id = c.first_voucher_id
      ORDER BY atc.invoice_count DESC, atc.total_spent DESC;
    `;
    const r = await query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. All Customers with sales manager metrics
app.get('/api/customers/top', async (req, res) => {
  try {
    const from  = (req.query.from  as string) || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to    = (req.query.to    as string) || new Date().toISOString().slice(0, 10);
    const rpId  = req.query.rp_id ? parseInt(req.query.rp_id as string, 10) : null;

    const params: any[] = [from, to];
    const rpFilter = rpId ? `AND p.responsible_party_id = $${params.push(rpId)}` : '';

    const sql = `
      SELECT
        p.id,
        p.name,
        rp.name                                                AS responsible_party,
        COUNT(v.id)                                            AS invoice_count,
        SUM(v.total_amount)                                    AS total_sales,
        ROUND(SUM(v.total_amount) / COUNT(v.id), 2)           AS avg_order_value,
        MAX(v.transaction_date)::date                          AS last_order_date,
        (CURRENT_DATE - MAX(v.transaction_date)::date)         AS days_inactive,
        ROUND(
          COUNT(v.id)::numeric /
          GREATEST(($2::date - $1::date)::numeric / 30.0, 1),
          2
        )                                                      AS orders_per_month,
        COALESCE(ar.pending, 0)                                AS pending,
        COALESCE(ar.unpaid_count, 0)                           AS unpaid_count,
        COALESCE(ar.oldest_unpaid_days, 0)                     AS oldest_unpaid_days
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id = v.party_id
      LEFT JOIN parties rp  ON rp.id = p.responsible_party_id
      LEFT JOIN (
        SELECT
          av.party_id,
          SUM(av.amount_due)                              AS pending,
          COUNT(*)                                        AS unpaid_count,
          MAX(CURRENT_DATE - av.transaction_date::date)   AS oldest_unpaid_days
        FROM vouchers av
        JOIN voucher_types avt ON avt.id = av.voucher_type_id
        WHERE av.organization_id = 2
          AND avt.code = 'SINV'
          AND av.is_cancelled = false
          AND av.amount_due > 0
        GROUP BY av.party_id
      ) ar ON ar.party_id = p.id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.site_id IN (1, 4)
        AND v.transaction_date BETWEEN $1 AND $2
        ${rpFilter}
      GROUP BY p.id, p.name, rp.name, ar.pending, ar.unpaid_count, ar.oldest_unpaid_days
      ORDER BY total_sales DESC;
    `;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 5. AR Aging
app.get('/api/customers/ar-aging', async (req, res) => {
  try {
    const sql = `
      SELECT
        CASE
          WHEN CURRENT_DATE - v.transaction_date <=  30 THEN '0-30'
          WHEN CURRENT_DATE - v.transaction_date <=  60 THEN '31-60'
          WHEN CURRENT_DATE - v.transaction_date <=  90 THEN '61-90'
          ELSE                                                '90+'
        END AS age_bucket,
        COUNT(*)               AS invoice_count,
        SUM(v.amount_due)      AS outstanding
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.payment_status IN ('Unpaid', 'Partially Paid')
        AND v.amount_due > 0
      GROUP BY 1
      ORDER BY MIN(CURRENT_DATE - v.transaction_date);
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 6. Top Items
app.get('/api/items/top', async (req, res) => {
  try {
    const sql = `
      SELECT i.id           AS id,
             i.name         AS name,
             i.code         AS code,
             SUM(vi.quantity)     AS units_sold,
             SUM(vi.total_amount) AS revenue
      FROM voucher_items vi
      JOIN vouchers v       ON v.id = vi.voucher_id
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN items i          ON i.id = vi.item_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY i.id, i.name, i.code
      ORDER BY revenue DESC
      LIMIT 20;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 7. Risk customers
app.get('/api/risk/customers', async (req, res) => {
  try {
    const rpId  = req.query.rp_id ? parseInt(req.query.rp_id as string, 10) : null;
    const params: any[] = [];
    const rpFilter = rpId ? `AND p.responsible_party_id = $${params.push(rpId)}` : '';

    const sql = `
      WITH customer_activity AS (
        SELECT
          p.id,
          p.name,
          rp.id   AS rp_id,
          rp.name AS responsible_party,
          MAX(v.transaction_date)::date                                                       AS last_order_date,
          (CURRENT_DATE - MAX(v.transaction_date)::date)                                     AS days_inactive,
          COUNT(v.id) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '6 months') AS invoices_6m,
          COALESCE(SUM(v.total_amount) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '6 months'), 0) AS sales_6m
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        JOIN parties p        ON p.id = v.party_id
        LEFT JOIN parties rp  ON rp.id = p.responsible_party_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
          ${rpFilter}
        GROUP BY p.id, p.name, rp.id, rp.name
      ),
      ar AS (
        SELECT
          v.party_id,
          SUM(v.amount_due)                              AS pending,
          COUNT(*)                                       AS unpaid_count,
          MAX(CURRENT_DATE - v.transaction_date::date)   AS oldest_unpaid_days,
          MIN(v.transaction_date::date)                  AS oldest_unpaid_date
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
          AND v.amount_due > 0
        GROUP BY v.party_id
      ),
      scored AS (
        SELECT
          ca.*,
          COALESCE(ar.pending, 0)           AS pending,
          COALESCE(ar.unpaid_count, 0)      AS unpaid_count,
          COALESCE(ar.oldest_unpaid_days, 0) AS oldest_unpaid_days,
          ar.oldest_unpaid_date,
          CASE
            WHEN COALESCE(ar.oldest_unpaid_days, 0) > 90 THEN 'CRITICAL'
            WHEN COALESCE(ar.oldest_unpaid_days, 0) > 60
              OR (COALESCE(ar.pending, 0) > 75000 AND COALESCE(ar.oldest_unpaid_days, 0) > 30) THEN 'HIGH'
            WHEN COALESCE(ar.oldest_unpaid_days, 0) > 30
              OR COALESCE(ar.pending, 0) > 15000
              OR ca.days_inactive > 30 THEN 'MEDIUM'
            ELSE 'WATCH'
          END AS risk_level,
          ROUND(
            (COALESCE(ar.oldest_unpaid_days, 0) * 3)::numeric
            + (COALESCE(ar.pending, 0) / 1000)
            + (COALESCE(ar.unpaid_count, 0) * 8)
            + (CASE WHEN ca.days_inactive > 30 AND COALESCE(ar.pending, 0) > 0
                    THEN ca.days_inactive * 2 ELSE 0 END)
          ) AS risk_score
        FROM customer_activity ca
        LEFT JOIN ar ON ar.party_id = ca.id
        WHERE COALESCE(ar.pending, 0) > 0 OR ca.days_inactive > 14
      )
      SELECT * FROM scored ORDER BY risk_score DESC;
    `;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 8. Delivery Pipeline Stats
app.get('/api/delivery/pipeline', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const snapshotSql = `
      SELECT delivery_status, COUNT(*)::int AS count
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
        AND v.delivery_status IS NOT NULL
        AND v.delivery_status NOT IN ('not_applicable')
      GROUP BY delivery_status
    `;

    const timingSql = `
      SELECT
        COUNT(*)::int AS delivered_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (dmin.first_delivered - v.created_at)) / 60), 1) AS avg_minutes,
        ROUND(MIN(EXTRACT(EPOCH FROM (dmin.first_delivered - v.created_at)) / 60), 1) AS min_minutes,
        ROUND(MAX(EXTRACT(EPOCH FROM (dmin.first_delivered - v.created_at)) / 60), 1) AS max_minutes
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN delivery_challans dc ON dc.related_invoice_voucher_id = v.id
      JOIN (
        SELECT document_id, MIN(changed_at) AS first_delivered
        FROM document_status_history
        WHERE new_status IN ('delivered', 'partially_delivered')
        GROUP BY document_id
      ) dmin ON dmin.document_id = dc.id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
    `;

    const trendSql = `
      SELECT
        v.transaction_date::date AS date,
        COUNT(*)::int AS total_orders,
        SUM(CASE WHEN v.delivery_status IN ('fully_delivered','partially_delivered') THEN 1 ELSE 0 END)::int AS delivered,
        SUM(CASE WHEN v.delivery_status = 'not_delivered' THEN 1 ELSE 0 END)::int AS pending,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (dmin.first_delivered - v.created_at)) / 60)
          FILTER (WHERE dmin.first_delivered IS NOT NULL),
          1
        ) AS avg_minutes
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      LEFT JOIN delivery_challans dc ON dc.related_invoice_voucher_id = v.id
      LEFT JOIN (
        SELECT document_id, MIN(changed_at) AS first_delivered
        FROM document_status_history
        WHERE new_status IN ('delivered', 'partially_delivered')
        GROUP BY document_id
      ) dmin ON dmin.document_id = dc.id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date >= CURRENT_DATE - 7
        AND v.site_id IN (1, 4)
        AND v.delivery_status IS NOT NULL
        AND v.delivery_status NOT IN ('not_applicable')
      GROUP BY v.transaction_date
      ORDER BY v.transaction_date ASC
    `;

    const [snapshot, timing, trend] = await Promise.all([
      query(snapshotSql, [date]),
      query(timingSql, [date]),
      query(trendSql),
    ]);

    res.json({
      snapshot: snapshot.rows,
      timing: timing.rows[0] || { delivered_count: 0, avg_minutes: null, min_minutes: null, max_minutes: null },
      trend: trend.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 9. Delivery Orders (per-order timeline)
app.get('/api/delivery/orders', async (req, res) => {
  try {
    const from   = (req.query.from   as string) || new Date().toISOString().slice(0, 10);
    const to     = (req.query.to     as string) || new Date().toISOString().slice(0, 10);
    const status = req.query.status as string || null;

    const params: any[] = [from, to];
    const statusFilter = status ? `AND v.delivery_status = $${params.push(status)}` : '';

    const sql = `
      SELECT
        v.id,
        v.voucher_number,
        v.transaction_date::date,
        v.delivery_status,
        v.site_id,
        p.name         AS customer,
        v.total_amount,
        v.created_at   AS invoice_created_at,
        (SELECT MIN(dsh.changed_at) FROM document_status_history dsh
           JOIN delivery_challans dc ON dc.id = dsh.document_id
           WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status = 'packed') AS packed_at,
        (SELECT MIN(dsh.changed_at) FROM document_status_history dsh
           JOIN delivery_challans dc ON dc.id = dsh.document_id
           WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status IN ('shipped','in_transit')) AS shipped_at,
        (SELECT MIN(dsh.changed_at) FROM document_status_history dsh
           JOIN delivery_challans dc ON dc.id = dsh.document_id
           WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status IN ('delivered','partially_delivered')) AS delivered_at,
        (SELECT u.full_name FROM document_status_history dsh
           JOIN delivery_challans dc ON dc.id = dsh.document_id
           JOIN users u ON u.id = dsh.changed_by
           WHERE dc.related_invoice_voucher_id = v.id
             AND dsh.new_status IN ('delivered','partially_delivered')
           ORDER BY dsh.changed_at LIMIT 1) AS delivery_person
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id = v.party_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date BETWEEN $1 AND $2
        AND v.site_id IN (1, 4)
        AND v.delivery_status IS NOT NULL
        AND v.delivery_status NOT IN ('not_applicable')
        ${statusFilter}
      ORDER BY v.created_at DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 10. Daily Report
app.get('/api/reports/daily', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    // Sales by site — summary totals
    const salesSiteSql = `
      SELECT
        v.site_id,
        CASE v.site_id WHEN 1 THEN 'Mogappair' WHEN 4 THEN 'Medavakkam' END AS site_name,
        COUNT(*)::int       AS invoice_count,
        SUM(v.total_amount) AS total_amount
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id  = v.party_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
      GROUP BY v.site_id
      ORDER BY v.site_id
    `;

    // Sales by site × party group
    const salesGroupSql = `
      SELECT
        v.site_id,
        COALESCE(pg.name, 'Other') AS group_name,
        COUNT(*)::int       AS invoice_count,
        SUM(v.total_amount) AS total_amount
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id  = v.party_id
      LEFT JOIN party_groups pg ON pg.id = p.party_group_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
      GROUP BY v.site_id, pg.name
      ORDER BY v.site_id, total_amount DESC
    `;

    // Salesman contribution per site
    const salesmenSql = `
      SELECT
        v.site_id,
        rp.name AS salesman_name,
        COUNT(*)::int       AS invoice_count,
        SUM(v.total_amount) AS total_amount
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p        ON p.id  = v.party_id
      JOIN parties rp       ON rp.id = p.responsible_party_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
      GROUP BY v.site_id, rp.name
      ORDER BY v.site_id, total_amount DESC
    `;

    // Site-level delivery timing (order→packed, packed→shipped, shipped→delivered, total)
    const siteTimingSql = `
      SELECT
        v.site_id,
        CASE v.site_id WHEN 1 THEN 'Mogappair' WHEN 4 THEN 'Medavakkam' END AS site_name,
        COUNT(*)::int AS total_orders,
        SUM(CASE WHEN v.delivery_status IN ('fully_delivered','partially_delivered') THEN 1 ELSE 0 END)::int AS delivered_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (p_ts.ts - v.created_at))/60)
              FILTER (WHERE p_ts.ts IS NOT NULL), 1) AS avg_order_to_packed,
        ROUND(AVG(EXTRACT(EPOCH FROM (s_ts.ts - p_ts.ts))/60)
              FILTER (WHERE s_ts.ts IS NOT NULL AND p_ts.ts IS NOT NULL), 1) AS avg_packed_to_shipped,
        ROUND(AVG(EXTRACT(EPOCH FROM (d_ts.ts - s_ts.ts))/60)
              FILTER (WHERE d_ts.ts IS NOT NULL AND s_ts.ts IS NOT NULL), 1) AS avg_shipped_to_delivered,
        ROUND(AVG(EXTRACT(EPOCH FROM (d_ts.ts - v.created_at))/60)
              FILTER (WHERE d_ts.ts IS NOT NULL), 1) AS avg_total
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      LEFT JOIN LATERAL (
        SELECT MIN(dsh.changed_at) AS ts FROM document_status_history dsh
        JOIN delivery_challans dc ON dc.id = dsh.document_id
        WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status = 'packed'
      ) p_ts ON true
      LEFT JOIN LATERAL (
        SELECT MIN(dsh.changed_at) AS ts FROM document_status_history dsh
        JOIN delivery_challans dc ON dc.id = dsh.document_id
        WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status IN ('shipped','in_transit')
      ) s_ts ON true
      LEFT JOIN LATERAL (
        SELECT MIN(dsh.changed_at) AS ts FROM document_status_history dsh
        JOIN delivery_challans dc ON dc.id = dsh.document_id
        WHERE dc.related_invoice_voucher_id = v.id AND dsh.new_status IN ('delivered','partially_delivered')
      ) d_ts ON true
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
        AND v.delivery_status IS NOT NULL
        AND v.delivery_status NOT IN ('not_applicable')
      GROUP BY v.site_id
      ORDER BY v.site_id
    `;

    // Agent-level delivery stats
    const agentSql = `
      SELECT
        v.site_id,
        u.full_name AS agent_name,
        COUNT(DISTINCT v.id)::int AS deliveries,
        ROUND(AVG(EXTRACT(EPOCH FROM (dsh.changed_at - s_ts.ts))/60)
              FILTER (WHERE s_ts.ts IS NOT NULL), 1) AS avg_shipped_to_delivered
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN delivery_challans dc   ON dc.related_invoice_voucher_id = v.id
      JOIN document_status_history dsh ON dsh.document_id = dc.id
        AND dsh.new_status IN ('delivered','partially_delivered')
      JOIN users u ON u.id = dsh.changed_by
      LEFT JOIN LATERAL (
        SELECT MIN(dsh2.changed_at) AS ts FROM document_status_history dsh2
        WHERE dsh2.document_id = dc.id AND dsh2.new_status IN ('shipped','in_transit')
      ) s_ts ON true
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
      GROUP BY v.site_id, u.full_name
      ORDER BY v.site_id, deliveries DESC
    `;

    // Daily conversions — customers whose very first invoice was on this date, grouped by salesman
    const conversionsSql = `
      WITH first_invoices AS (
        SELECT
          rp.id   AS salesman_id,
          rp.name AS salesman_name,
          p.id    AS customer_id,
          p.name  AS customer_name,
          MIN(v.transaction_date) AS first_date,
          (SELECT vv.voucher_number FROM vouchers vv
           JOIN voucher_types vvt ON vvt.id = vv.voucher_type_id
           WHERE vv.party_id = p.id AND vv.organization_id = 2 AND vvt.code = 'SINV' AND vv.is_cancelled = false
           ORDER BY vv.transaction_date ASC LIMIT 1) AS first_invoice
        FROM vouchers v
        JOIN voucher_types vt ON vt.id = v.voucher_type_id
        JOIN parties p        ON p.id  = v.party_id
        JOIN parties rp       ON rp.id = p.responsible_party_id
        WHERE v.organization_id = 2
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
        GROUP BY rp.id, rp.name, p.id, p.name
      )
      SELECT
        salesman_id,
        salesman_name,
        COUNT(*)::int                    AS conversions,
        json_agg(json_build_object('name', customer_name, 'invoice', first_invoice) ORDER BY customer_name) AS customers
      FROM first_invoices
      WHERE first_date = $1
      GROUP BY salesman_id, salesman_name
      ORDER BY conversions DESC
    `;

    const [salesSite, salesGroups, salesmen, siteTiming, agents, conversions] = await Promise.all([
      query(salesSiteSql, [date]),
      query(salesGroupSql, [date]),
      query(salesmenSql, [date]),
      query(siteTimingSql, [date]),
      query(agentSql, [date]),
      query(conversionsSql, [date]),
    ]);

    res.json({
      date,
      sales: { summary: salesSite.rows, groups: salesGroups.rows, salesmen: salesmen.rows },
      delivery: { site_timing: siteTiming.rows, agents: agents.rows },
      conversions: conversions.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 11. Follow-up List — repeat customers with peak ordering day/time
app.get('/api/followup/customers', async (req, res) => {
  try {
    const minOrders = parseInt(req.query.min_orders as string) || 2;
    const sql = `
      WITH orders_30d AS (
        SELECT
          p.id                                              AS customer_id,
          p.name                                            AS customer_name,
          pg.name                                           AS group_name,
          rp.id                                             AS salesman_id,
          rp.name                                           AS salesman_name,
          CASE v.organization_id WHEN 2 THEN 'Mogappair' WHEN 3 THEN 'Medavakkam' ELSE 'Other' END AS site_name,
          COUNT(v.id)::int                                  AS order_count,
          SUM(v.total_amount)                               AS total_amount,
          AVG(v.total_amount)                               AS avg_order_value,
          MAX(v.transaction_date)                           AS last_order_date,
          MIN(v.transaction_date)                           AS first_order_date,
          -- Most common day-of-week (0=Sun … 6=Sat)
          MODE() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM v.transaction_date))::int AS peak_dow,
          -- Most common hour — only business hours (6 AM–10 PM) to strip midnight batch imports
          MODE() WITHIN GROUP (
            ORDER BY CASE
              WHEN EXTRACT(HOUR FROM v.created_at) BETWEEN 6 AND 22
              THEN EXTRACT(HOUR FROM v.created_at)
            END
          )::int AS peak_hour
        FROM vouchers v
        JOIN voucher_types vt  ON vt.id = v.voucher_type_id
        JOIN parties p         ON p.id  = v.party_id
        LEFT JOIN party_groups pg ON pg.id = p.party_group_id
        JOIN parties rp        ON rp.id = p.responsible_party_id
        WHERE v.organization_id IN (2, 3)
          AND vt.code = 'SINV'
          AND v.is_cancelled = false
          AND v.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY p.id, p.name, pg.name, rp.id, rp.name, v.organization_id
        HAVING COUNT(v.id) >= $1
      )
      SELECT *,
        ROUND(total_amount)::bigint    AS total_amount_r,
        ROUND(avg_order_value)::bigint AS avg_order_value_r
      FROM orders_30d
      ORDER BY order_count DESC, total_amount DESC
    `;
    const result = await query(sql, [minOrders]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 11. Customer Map data
app.get('/api/map/customers', async (req, res) => {
  try {
    // lat/lng pattern: "12.3456,78.9012" or "12.3456, 78.9012"
    const latlngSql = `
      SELECT p.id, p.name, p.geo_location, p.party_group_id,
             pg.name AS group_name,
             rp.name AS salesman,
             TRIM(SPLIT_PART(p.geo_location, ',', 1))::float AS lat,
             TRIM(SPLIT_PART(p.geo_location, ',', 2))::float AS lng,
             MAX(v.transaction_date)::date AS last_order,
             COUNT(v.id)::int              AS order_count,
             COUNT(v.id) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS orders_last_30d,
             COUNT(DISTINCT DATE_TRUNC('week', v.transaction_date)) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS weeks_active_30d
      FROM parties p
      LEFT JOIN party_groups pg ON pg.id = p.party_group_id
      LEFT JOIN parties rp      ON rp.id = p.responsible_party_id
      LEFT JOIN vouchers v      ON v.party_id = p.id
        AND v.organization_id = 2 AND v.is_cancelled = false
      WHERE p.organization_id = 2
        AND p.party_group_id IN (1, 2)
        AND p.geo_location ~ '^-?[0-9]+\\.?[0-9]*\\s*,\\s*-?[0-9]+\\.?[0-9]*$'
      GROUP BY p.id, p.name, p.geo_location, p.party_group_id, pg.name, rp.name
    `;

    const gmapSql = `
      SELECT p.id, p.name, p.geo_location, pg.name AS group_name, rp.name AS salesman,
             MAX(v.transaction_date)::date AS last_order,
             COUNT(v.id) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS orders_last_30d,
             COUNT(DISTINCT DATE_TRUNC('week', v.transaction_date)) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS weeks_active_30d
      FROM parties p
      LEFT JOIN party_groups pg ON pg.id = p.party_group_id
      LEFT JOIN parties rp      ON rp.id = p.responsible_party_id
      LEFT JOIN vouchers v      ON v.party_id = p.id
        AND v.organization_id = 2 AND v.is_cancelled = false
      WHERE p.organization_id = 2
        AND p.party_group_id IN (1, 2)
        AND p.geo_location ILIKE '%maps%'
      GROUP BY p.id, p.name, p.geo_location, pg.name, rp.name
      ORDER BY p.name
    `;

    const missingSql = `
      SELECT p.id, p.name, pg.name AS group_name, rp.name AS salesman,
             MAX(v.transaction_date)::date AS last_order,
             COUNT(v.id) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS orders_last_30d,
             COUNT(DISTINCT DATE_TRUNC('week', v.transaction_date)) FILTER (WHERE v.transaction_date >= CURRENT_DATE - INTERVAL '30 days')::int AS weeks_active_30d
      FROM parties p
      LEFT JOIN party_groups pg ON pg.id = p.party_group_id
      LEFT JOIN parties rp      ON rp.id = p.responsible_party_id
      LEFT JOIN vouchers v      ON v.party_id = p.id
        AND v.organization_id = 2 AND v.is_cancelled = false
      WHERE p.organization_id = 2
        AND p.party_group_id IN (1, 2)
        AND (p.geo_location IS NULL OR p.geo_location = '')
      GROUP BY p.id, p.name, pg.name, rp.name
      ORDER BY p.name
    `;

    const [latlng, gmap, missing] = await Promise.all([
      query(latlngSql),
      query(gmapSql),
      query(missingSql),
    ]);

    res.json({ latlng: latlng.rows, gmap: gmap.rows, missing: missing.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: String(err) });
  }
});

// Temporary schema explorer — remove after investigation
app.get('/api/dev/schema', async (req, res) => {
  try {
    const table = (req.query.table as string) || '';
    if (table) {
      const cols = await query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table]);
      return res.json(cols.rows);
    }
    const tables = await query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`);
    res.json(tables.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: String(err) }); }
});

app.get('/api/dev/geo-sample', async (req, res) => {
  try {
    const r = await query(`
      SELECT id, name, geo_location FROM parties
      WHERE organization_id = 2 AND geo_location IS NOT NULL AND geo_location != ''
      LIMIT 20
    `);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/dev/party-groups', async (req, res) => {
  try {
    const r = await query(`SELECT id, name FROM party_groups WHERE organization_id = 2 ORDER BY name`);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/dev/ungrouped-invoices', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const r = await query(`
      SELECT v.voucher_number, p.name AS customer, p.party_group_id,
             CASE v.site_id WHEN 1 THEN 'Mogappair' WHEN 4 THEN 'Medavakkam' END AS site,
             v.total_amount
      FROM vouchers v
      JOIN voucher_types vt ON vt.id = v.voucher_type_id
      JOIN parties p ON p.id = v.party_id
      WHERE v.organization_id = 2
        AND vt.code = 'SINV'
        AND v.is_cancelled = false
        AND v.transaction_date = $1
        AND v.site_id IN (1, 4)
        AND p.party_group_id IS NULL
      ORDER BY v.site_id, v.voucher_number
    `, [date]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
