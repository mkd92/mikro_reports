import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
  LayoutDashboard, Users, ShoppingBag, UserCheck, Loader2,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  AlertCircle, BarChart2, Search, AlertTriangle, Ghost, BadgeDollarSign, Clock, Truck, FileText, Download, X, MapPin
} from 'lucide-react';
import './Dashboard.css';
import MapPage from './MapPage';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const fmt = (val: any) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val) || 0);

const today = new Date();
const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr      = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const thisYearStart = `${today.getFullYear()}-01-01`;

function presetRange(p: string): { from: string; to: string } {
  const now = new Date();
  if (p === 'this_month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: todayStr };
  if (p === 'last_month') return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
    to:   new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
  };
  if (p === 'last_90') return { from: new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10), to: todayStr };
  if (p === 'this_year') return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to: todayStr };
  return { from: thisMonthStart, to: todayStr };
}

const PRESETS = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_90',    label: 'Last 90d' },
  { id: 'this_year',  label: 'This Year' },
];

const TREND_PRESETS = [
  { id: 'last_7d',   label: 'Last 7d',   gran: 'daily'   },
  { id: 'last_30d',  label: 'Last 30d',  gran: 'daily'   },
  { id: 'last_3m',   label: 'Last 3M',   gran: 'weekly'  },
  { id: 'last_6m',   label: 'Last 6M',   gran: 'monthly' },
  { id: 'this_year', label: 'This Year', gran: 'monthly' },
];

function DateFilter({ from, to, onFromChange, onToChange, onPreset, onApply, loading }: any) {
  return (
    <div className="date-filter">
      <div className="preset-buttons">
        {PRESETS.map(({ id, label }) => (
          <button key={id} className="preset-btn" onClick={() => onPreset(id)}>{label}</button>
        ))}
      </div>
      <div className="date-inputs">
        <input type="date" className="date-input" value={from} onChange={e => onFromChange(e.target.value)} />
        <span className="sep">→</span>
        <input type="date" className="date-input" value={to} onChange={e => onToChange(e.target.value)} />
        <button className="apply-btn" onClick={onApply} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

const CHART_COLORS = { total: '#f59e0b', mogappair: '#3b82f6', medavakkam: '#10b981', danger: '#ef4444' };

const fmtShort = (v: number) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
      padding: '0.65rem 0.95rem', boxShadow: '0 12px 32px rgba(0,0,0,0.35)', minWidth: 160,
    }}>
      <p style={{ color: '#64748b', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.name}</span>
          <span style={{ color: '#f1f5f9', fontSize: 11, fontWeight: 700, marginLeft: 'auto', paddingLeft: 12 }}>
            {typeof p.value === 'number' && p.value > 999 ? fmtShort(p.value) : p.dataKey === 'avg_minutes' ? fmtMins(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const fmtMins = (mins: number | null): string => {
  if (mins == null) return '—';
  const m = Math.round(Number(mins));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

const DeliveryTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: 'none', borderRadius: 8, padding: '0.6rem 0.9rem', boxShadow: '0 8px 20px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {p.dataKey === 'avg_minutes' ? fmtMins(Number(p.value)) : p.value}
        </div>
      ))}
    </div>
  );
};

const PAGE_SIZE = 50;

export default function Dashboard() {
  const [activeTab, setActiveTab]     = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading]         = useState(true);

  const [data, setData]         = useState<any>({ summary: [], monthly: [], aging: [], items: [] });
  const [teamData, setTeamData]       = useState<any[]>([]);
  const [teamMixData, setTeamMixData] = useState<any[]>([]);
  const [teamFrom, setTeamFrom]       = useState(thisMonthStart);
  const [teamTo, setTeamTo]           = useState(todayStr);
  const [teamLoading, setTeamLoading] = useState(false);

  // Customer drill-down drawer (one-time or bought-again)
  const [otDrawer, setOtDrawer] = useState<{ open: boolean; type: 'one-time' | 'bought-again'; salesman: string; id: number | null }>(
    { open: false, type: 'one-time', salesman: '', id: null }
  );
  const [otData, setOtData]       = useState<any[]>([]);
  const [otLoading, setOtLoading] = useState(false);

  const openDrawer = async (type: 'one-time' | 'bought-again', salesmanId: number, salesmanName: string) => {
    setOtDrawer({ open: true, type, salesman: salesmanName, id: salesmanId });
    setOtLoading(true);
    try {
      const endpoint = type === 'one-time' ? 'one-time-customers' : 'bought-again-customers';
      const r = await axios.get(`${API_BASE}/team/${endpoint}`, {
        params: { from: teamFrom, to: teamTo, salesman_id: salesmanId },
      });
      setOtData(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); } finally { setOtLoading(false); }
  };

  const [custData, setCustData]   = useState<any[]>([]);
  const [custFrom, setCustFrom]   = useState(thisMonthStart);
  const [custTo, setCustTo]       = useState(todayStr);
  const [custLoading, setCustLoading] = useState(false);
  const [custSearch, setCustSearch]   = useState('');
  const [custPage, setCustPage]       = useState(0);
  const [custSort, setCustSort]       = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'total_sales', dir: 'desc' });
  const [custRpId, setCustRpId]       = useState('');
  const [rpList, setRpList]           = useState<any[]>([]);

  // risk state
  const [riskData, setRiskData]         = useState<any[]>([]);
  const [riskLoading, setRiskLoading]   = useState(false);
  const [riskLevel, setRiskLevel]       = useState('all');
  const [riskRpId, setRiskRpId]         = useState('');
  const [riskSearch, setRiskSearch]     = useState('');
  const [riskSort, setRiskSort]         = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'risk_score', dir: 'desc' });
  const [ghostOnly, setGhostOnly]       = useState(false);

  // trend state
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [trendFrom, setTrendFrom] = useState(thisYearStart);
  const [trendTo, setTrendTo]     = useState(todayStr);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendPeriod, setTrendPeriod]   = useState('this_year');
  const [excludeCorporate, setExcludeCorporate] = useState(false);

  // report state
  const [reportDate, setReportDate]     = useState(todayStr);
  const [reportData, setReportData]     = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfLoading, setPdfLoading]     = useState(false);

  const fetchReport = async (date: string) => {
    setReportLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/reports/daily`, { params: { date } });
      setReportData(r.data);
    } catch (e) { console.error(e); } finally { setReportLoading(false); }
  };

  const exportReportPDF = async (data: any) => {
    setPdfLoading(true);
    const wrapper = document.createElement('div');
    try {
    const SITE: Record<number, string> = { 1: 'Mogappair', 4: 'Medavakkam' };
    const SITE_IDS = [1, 4];

    const fmtN = (v: any) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);
    const fmtD = (m: any) => {
      if (m == null || m === '') return '—';
      const mins = Math.round(Number(m));
      return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };
    const pctNum = (part: any, total: any) =>
      Number(total) > 0 ? Math.round(Number(part) / Number(total) * 100) : 0;
    const timeBadge = (m: any, okThresh = 60) => {
      if (m == null || m === '') return `<span style="color:#94a3b8;font-size:8px">—</span>`;
      const val = Number(m);
      const c = val > okThresh * 1.5 ? '#dc2626' : val > okThresh ? '#b45309' : '#059669';
      const bg = val > okThresh * 1.5 ? '#fef2f2' : val > okThresh ? '#fffbeb' : '#f0fdf4';
      const border = val > okThresh * 1.5 ? '#fecaca' : val > okThresh ? '#fde68a' : '#bbf7d0';
      return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:7.5px;font-weight:700;color:${c};background:${bg};border:1px solid ${border}">${fmtD(m)}</span>`;
    };
    const sh = (label: string, color: string) =>
      `<div style="display:flex;align-items:center;gap:4px;margin-bottom:7px">
        <div style="width:3px;height:11px;border-radius:2px;background:${color};flex-shrink:0"></div>
        <span style="font-size:6.5px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.09em">${label}</span>
      </div>`;

    const salesSummary: any[]  = data.sales?.summary  || [];
    const salesGroups: any[]   = data.sales?.groups   || [];
    const salesmen: any[]      = data.sales?.salesmen || [];
    const siteTiming: any[]    = data.delivery?.site_timing || [];
    const agents: any[]        = data.delivery?.agents || [];
    const conversions: any[]   = data.conversions || [];

    const totalSales       = salesSummary.reduce((a, r) => a + Number(r.total_amount), 0);
    const totalInvoices    = salesSummary.reduce((a, r) => a + Number(r.invoice_count), 0);
    const totalDelivered   = siteTiming.reduce((a, r) => a + Number(r.delivered_count || 0), 0);
    const totalOrders      = siteTiming.reduce((a, r) => a + Number(r.total_orders || 0), 0);
    const totalConversions = conversions.reduce((a, r) => a + Number(r.conversions), 0);
    const dateLabel        = new Date(data.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const genTime          = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const delivRate        = totalOrders > 0 ? Math.round(totalDelivered / totalOrders * 100) : 0;

    const kpis = [
      { label: 'Revenue', val: fmtN(totalSales), sub: `${totalInvoices} inv`, color: '#60a5fa' },
      ...salesSummary.map((s: any) => ({
        label: SITE[s.site_id] || `Site ${s.site_id}`,
        val: fmtN(s.total_amount),
        sub: `${s.invoice_count} inv · ${pctNum(s.total_amount, totalSales)}%`,
        color: s.site_id === 1 ? '#38bdf8' : '#34d399',
      })),
      { label: 'Delivered', val: `${totalDelivered}/${totalOrders}`, sub: `${delivRate}% rate`, color: '#fbbf24' },
      { label: 'New Customers', val: String(totalConversions), sub: 'today', color: '#c084fc' },
    ];

    const singlePage = `
    <div style="display:flex;flex-direction:column;width:1122px;height:794px;padding:20px 28px 14px;background:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;font-size:10px;color:#1e293b;box-sizing:border-box;">

      <!-- HEADER -->
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:10px;padding:11px 18px;margin-bottom:10px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:30px;height:30px;border-radius:7px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:white;flex-shrink:0">M</div>
          <div>
            <div style="font-size:6.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.12em">Mikro B2B Supplies</div>
            <div style="font-size:14px;font-weight:900;color:white;line-height:1.15;margin-top:1px">Daily Operations Report</div>
          </div>
        </div>
        <div style="display:flex;gap:20px;align-items:center">
          ${kpis.map(k => `
          <div style="text-align:right">
            <div style="font-size:6px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">${k.label}</div>
            <div style="font-size:13px;font-weight:900;color:${k.color};line-height:1.2;margin-top:1px">${k.val}</div>
            <div style="font-size:6px;color:#475569;margin-top:1px">${k.sub}</div>
          </div>`).join('<div style="width:1px;background:rgba(255,255,255,0.1);height:24px;align-self:center"></div>')}
        </div>
        <div style="text-align:right;padding-left:16px;border-left:1px solid rgba(255,255,255,0.1)">
          <div style="font-size:9px;font-weight:700;color:white">${dateLabel}</div>
          <div style="font-size:6.5px;color:#64748b;margin-top:2px">Generated ${genTime}</div>
          <div style="font-size:6px;color:#475569;margin-top:3px;background:rgba(255,255,255,0.06);display:inline-block;padding:1px 8px;border-radius:3px">CONFIDENTIAL</div>
        </div>
      </div>

      <!-- 2-COLUMN BODY: Left=Sales+Salesman+Conversions | Right=Delivery+Agents -->
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:420px 1px 1fr;overflow:hidden;margin-bottom:6px">

        <!-- LEFT COLUMN: Sales Overview + Salesman Contribution + Conversions (compact) -->
        <div style="display:flex;flex-direction:column;padding-right:14px;overflow:hidden">

          <!-- SALES OVERVIEW -->
          <div style="flex-shrink:0">
            ${sh('Sales Overview', '#3b82f6')}
            ${salesSummary.map((s: any) => {
              const groups = salesGroups.filter((g: any) => Number(g.site_id) === Number(s.site_id));
              const sitePct = pctNum(s.total_amount, totalSales);
              const siteColor = Number(s.site_id) === 1 ? '#3b82f6' : '#10b981';
              const siteBarBg = Number(s.site_id) === 1 ? '#bfdbfe' : '#a7f3d0';
              return `
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <div style="display:flex;align-items:center;gap:5px">
                    <div style="width:7px;height:7px;border-radius:2px;background:${siteColor};flex-shrink:0"></div>
                    <span style="font-size:9px;font-weight:800;color:#0f172a">${SITE[s.site_id] || `Site ${s.site_id}`}</span>
                  </div>
                  <div style="display:flex;align-items:baseline;gap:5px">
                    <span style="font-size:12px;font-weight:900;color:${siteColor}">${fmtN(s.total_amount)}</span>
                    <span style="font-size:6.5px;color:#94a3b8;background:#f8fafc;padding:1px 5px;border-radius:4px">${sitePct}% · ${s.invoice_count}inv</span>
                  </div>
                </div>
                <div style="height:4px;background:#f1f5f9;border-radius:3px;overflow:hidden;margin-bottom:6px">
                  <div style="width:${sitePct}%;height:100%;background:${siteColor};border-radius:3px"></div>
                </div>
                ${groups.map((g: any) => {
                  const gPct = pctNum(g.total_amount, s.total_amount);
                  return `
                  <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;padding-left:12px">
                    <span style="font-size:7px;color:#475569;width:88px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.group_name}</span>
                    <div style="flex:1;height:3px;background:#f1f5f9;border-radius:2px;overflow:hidden">
                      <div style="width:${gPct}%;height:100%;background:${siteBarBg};border-radius:2px"></div>
                    </div>
                    <span style="font-size:6.5px;color:#94a3b8;width:20px;text-align:right;flex-shrink:0">${gPct}%</span>
                    <span style="font-size:7.5px;font-weight:700;color:#1e293b;width:56px;text-align:right;flex-shrink:0">${fmtN(g.total_amount)}</span>
                    <span style="font-size:6px;color:#94a3b8;width:26px;flex-shrink:0">${g.invoice_count}inv</span>
                  </div>`;
                }).join('')}
              </div>`;
            }).join('')}
          </div>

          <!-- DIVIDER -->
          <div style="height:1px;background:#f1f5f9;margin:4px 0 8px;flex-shrink:0"></div>

          <!-- SALESMAN CONTRIBUTION -->
          <div style="flex:1;min-height:0;overflow:hidden">
            ${sh('Salesman Contribution', '#8b5cf6')}
            ${SITE_IDS.map(siteId => {
              const rows = salesmen.filter((r: any) => Number(r.site_id) === siteId);
              if (!rows.length) return '';
              const siteTotal = rows.reduce((a: number, r: any) => a + Number(r.total_amount), 0);
              const maxAmt = rows.reduce((m: number, r: any) => Math.max(m, Number(r.total_amount)), 0);
              const siteColor = siteId === 1 ? '#3b82f6' : '#10b981';
              const siteBarBg = siteId === 1 ? '#bfdbfe' : '#a7f3d0';
              return `
              <div style="margin-bottom:9px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                  <div style="display:flex;align-items:center;gap:5px">
                    <div style="width:5px;height:5px;border-radius:50%;background:${siteColor};flex-shrink:0"></div>
                    <span style="font-size:7px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">${SITE[siteId]}</span>
                  </div>
                  <span style="font-size:7.5px;font-weight:700;color:${siteColor}">${fmtN(siteTotal)}</span>
                </div>
                ${rows.map((r: any) => {
                  const p = pctNum(r.total_amount, siteTotal);
                  const barW = maxAmt > 0 ? Math.round(Number(r.total_amount) / maxAmt * 100) : 0;
                  return `
                  <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
                    <span style="font-size:7.5px;color:#334155;font-weight:600;width:95px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.salesman_name?.trim()}</span>
                    <div style="flex:1;height:4px;background:#f1f5f9;border-radius:3px;overflow:hidden">
                      <div style="width:${barW}%;height:100%;background:${siteBarBg};border-radius:3px"></div>
                    </div>
                    <span style="font-size:6.5px;color:#94a3b8;width:22px;text-align:right;flex-shrink:0">${p}%</span>
                    <span style="font-size:8px;font-weight:700;color:#1e293b;width:56px;text-align:right;flex-shrink:0">${fmtN(r.total_amount)}</span>
                    <span style="font-size:6px;color:#94a3b8;width:22px;flex-shrink:0">${r.invoice_count}inv</span>
                  </div>`;
                }).join('')}
              </div>`;
            }).join('')}
          </div>

          <!-- DIVIDER -->
          <div style="height:1px;background:#f1f5f9;margin:4px 0 7px;flex-shrink:0"></div>

          <!-- NEW CUSTOMER CONVERSIONS (compact) -->
          <div style="flex-shrink:0">
            ${sh('New Customer Conversions', '#10b981')}
            ${conversions.length === 0
              ? `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f8fafc;border:1px solid #f1f5f9;border-radius:7px">
                   <div style="width:26px;height:26px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                     <span style="font-size:11px;font-weight:900;color:#94a3b8">0</span>
                   </div>
                   <div>
                     <div style="font-size:7.5px;font-weight:700;color:#64748b">No new customers today</div>
                     <div style="font-size:6px;color:#94a3b8;margin-top:1px">All invoices billed to existing accounts</div>
                   </div>
                 </div>`
              : `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
                   <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #6ee7b7;border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:6px;flex-shrink:0">
                     <span style="font-size:22px;font-weight:900;color:#065f46;line-height:1">${totalConversions}</span>
                     <div>
                       <div style="font-size:5.5px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.06em">Total</div>
                       <div style="font-size:6px;color:#059669">new customers</div>
                     </div>
                   </div>
                   ${conversions.map((c: any) => `
                   <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:5px 8px">
                     <div style="font-size:6.5px;font-weight:700;color:#059669;margin-bottom:2px">${c.salesman_name?.trim()}</div>
                     <div style="font-size:8px;font-weight:800;color:#065f46">${c.conversions} new</div>
                     <div style="font-size:5.5px;color:#6b7280;margin-top:2px">${(c.customers || []).map((cu: any) => cu.name).join(', ')}</div>
                   </div>`).join('')}
                 </div>`
            }
          </div>

        </div>

        <!-- COLUMN DIVIDER -->
        <div style="background:#e2e8f0"></div>

        <!-- RIGHT COLUMN: Delivery Pipeline (side-by-side cards) + Agent Performance Table -->
        <div style="display:flex;flex-direction:column;padding-left:14px;overflow:hidden">

          <!-- DELIVERY PIPELINE: 2 site cards side-by-side -->
          <div style="flex-shrink:0">
            ${sh('Delivery Pipeline', '#f59e0b')}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${siteTiming.map((s: any) => {
                const dp = s.total_orders > 0 ? Math.round(s.delivered_count / s.total_orders * 100) : 0;
                const dpColor = dp >= 90 ? '#10b981' : dp >= 70 ? '#f59e0b' : '#ef4444';
                const dpTextColor = dp >= 90 ? '#34d399' : dp >= 70 ? '#fbbf24' : '#f87171';
                return `
                <div style="border:1px solid #e2e8f0;border-radius:9px;overflow:hidden">
                  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:8px 12px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
                      <span style="font-size:9.5px;font-weight:800;color:white">${s.site_name}</span>
                      <span style="font-size:9px;font-weight:800;color:${dpTextColor}">${dp}%</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;height:4px;background:rgba(255,255,255,0.12);border-radius:3px;overflow:hidden">
                        <div style="width:${dp}%;height:100%;background:${dpColor};border-radius:3px"></div>
                      </div>
                      <span style="font-size:6.5px;color:#94a3b8;white-space:nowrap">${s.delivered_count}/${s.total_orders} orders</span>
                    </div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;background:white">
                    ${[
                      { label: 'Order→Packed', val: s.avg_order_to_packed, thresh: 45 },
                      { label: 'Packed→Shipped', val: s.avg_packed_to_shipped, thresh: 30 },
                      { label: 'Shipped→Delivered', val: s.avg_shipped_to_delivered, thresh: 60 },
                      { label: 'End-to-End', val: s.avg_total, thresh: 120 },
                    ].map((st, si) => `
                    <div style="padding:6px 10px;border-right:${si % 2 === 0 ? '1px solid #f1f5f9' : 'none'};border-bottom:${si < 2 ? '1px solid #f1f5f9' : 'none'}">
                      <div style="font-size:6px;color:#94a3b8;font-weight:600;margin-bottom:3px">${st.label}</div>
                      ${timeBadge(st.val, st.thresh)}
                    </div>`).join('')}
                  </div>
                </div>`;
              }).join('')}
              ${siteTiming.length === 0
                ? `<div style="grid-column:1/-1;padding:14px;text-align:center;color:#94a3b8;font-size:8px;border:1px solid #f1f5f9;border-radius:8px">No delivery data for this date</div>`
                : ''}
            </div>
          </div>

          <!-- DIVIDER -->
          <div style="height:1px;background:#f1f5f9;margin:10px 0 8px;flex-shrink:0"></div>

          <!-- AGENT PERFORMANCE TABLE: fills remaining height -->
          <div style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column">
            ${sh('Agent Performance', '#f59e0b')}
            <!-- Table header -->
            <div style="display:grid;grid-template-columns:1fr 100px 42px 110px 80px;gap:0;padding:4px 8px 5px;background:#f8fafc;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;border-bottom:none;flex-shrink:0">
              <span style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Agent</span>
              <span style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Branch</span>
              <span style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;text-align:right">Del.</span>
              <span style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;padding-left:6px">Load</span>
              <span style="font-size:6.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;text-align:right">Avg Time</span>
            </div>
            <!-- Table body -->
            <div style="border:1px solid #e2e8f0;border-radius:0 0 6px 6px;overflow:hidden;flex:1">
              ${(() => {
                const allAgents: any[] = [];
                SITE_IDS.forEach(siteId => {
                  agents.filter((a: any) => Number(a.site_id) === siteId).forEach((a: any) => allAgents.push({ ...a, _siteId: siteId }));
                });
                if (!allAgents.length) return `<div style="padding:14px;text-align:center;color:#94a3b8;font-size:8px">No agent data for this date</div>`;
                const maxDel = allAgents.reduce((m: number, a: any) => Math.max(m, Number(a.deliveries)), 0);
                return allAgents.map((a: any, i: number) => {
                  const sc = a._siteId === 1 ? '#3b82f6' : '#10b981';
                  const barW = maxDel > 0 ? Math.round(Number(a.deliveries) / maxDel * 100) : 0;
                  const isLast = i === allAgents.length - 1;
                  return `
                  <div style="display:grid;grid-template-columns:1fr 100px 42px 110px 80px;gap:0;padding:5px 8px;background:${i % 2 === 0 ? 'white' : '#fafafa'};border-bottom:${isLast ? 'none' : '1px solid #f1f5f9'};align-items:center">
                    <span style="font-size:8px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.agent_name?.trim()}</span>
                    <div style="display:flex;align-items:center;gap:4px">
                      <div style="width:5px;height:5px;border-radius:50%;background:${sc};flex-shrink:0"></div>
                      <span style="font-size:7px;color:#64748b">${SITE[a._siteId] || ''}</span>
                    </div>
                    <span style="font-size:9px;font-weight:700;color:#1e293b;text-align:right">${a.deliveries}</span>
                    <div style="padding:0 6px">
                      <div style="height:4px;background:#f1f5f9;border-radius:3px;overflow:hidden">
                        <div style="width:${barW}%;height:100%;background:${sc}55;border-radius:3px"></div>
                      </div>
                    </div>
                    <div style="text-align:right">${timeBadge(a.avg_shipped_to_delivered, 60)}</div>
                  </div>`;
                }).join('');
              })()}
            </div>
          </div>

        </div>
      </div>

      <!-- FOOTER -->
      <div style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;padding-top:5px;">
        <span style="font-size:6px;color:#cbd5e1">Mikro B2B Analytics · Internal Use Only</span>
        <span style="font-size:6px;color:#cbd5e1">${dateLabel} · Generated ${genTime}</span>
      </div>
    </div>`;

    // Render in a hidden off-screen container matching A4 landscape (297mm×210mm @ 96dpi ≈ 1122×794px)
    wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1122px;height:794px;overflow:hidden;z-index:-1;background:white;';
    wrapper.innerHTML = singlePage;
    document.body.appendChild(wrapper);

    // Let the browser lay out the DOM before capturing
    await new Promise(r => setTimeout(r, 300));

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: false,
      allowTaint: false,
      width: 1122,
      height: 794,
    });

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
    pdf.save(`${data.date}_mikro_report.pdf`);

    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setPdfLoading(false);
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  };

  // delivery state
  const [delivDate, setDelivDate]       = useState(todayStr);
  const [delivData, setDelivData]       = useState<any>({ snapshot: [], timing: {}, trend: [] });
  const [delivOrders, setDelivOrders]   = useState<any[]>([]);
  const [delivLoading, setDelivLoading] = useState(false);
  const [delivStatus, setDelivStatus]   = useState('');
  const [delivSort, setDelivSort]       = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'invoice_created_at', dir: 'desc' });
  const [delivSiteId, setDelivSiteId]   = useState('');
  const [delivExpanded, setDelivExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [summary, monthly, team, teamMix, customers, aging, items, rps, riskData_r, delivPipeline, delivOrd, trendResult] = await Promise.all([
          axios.get(`${API_BASE}/sales/summary`),
          axios.get(`${API_BASE}/sales/monthly`),
          axios.get(`${API_BASE}/team/performance`, { params: { from: teamFrom, to: teamTo } }),
          axios.get(`${API_BASE}/team/customer-mix`,{ params: { from: teamFrom, to: teamTo } }),
          axios.get(`${API_BASE}/customers/top`,    { params: { from: custFrom, to: custTo } }),
          axios.get(`${API_BASE}/customers/ar-aging`),
          axios.get(`${API_BASE}/items/top`),
          axios.get(`${API_BASE}/team/list`),
          axios.get(`${API_BASE}/risk/customers`),
          axios.get(`${API_BASE}/delivery/pipeline`, { params: { date: todayStr } }),
          axios.get(`${API_BASE}/delivery/orders`,   { params: { from: todayStr, to: todayStr } }),
          axios.get(`${API_BASE}/sales/trend`,       { params: { granularity: 'monthly', from: thisYearStart, to: todayStr } }),
        ]);
        const safeArr = (d: any): any[] => Array.isArray(d) ? d : [];
        setData({
          summary: safeArr(summary.data),
          monthly: safeArr(monthly.data).reverse(),
          aging:   safeArr(aging.data),
          items:   safeArr(items.data),
        });
        setTeamData(safeArr(team.data));
        setTeamMixData(safeArr(teamMix.data));
        setCustData(safeArr(customers.data));
        setRpList(safeArr(rps.data));
        setRiskData(safeArr(riskData_r.data));
        setDelivData(delivPipeline.data && typeof delivPipeline.data === 'object' ? delivPipeline.data : { snapshot: [], timing: {}, trend: [] });
        setDelivOrders(safeArr(delivOrd.data));
        setTrendData(safeArr(trendResult.data));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const safeArr = (d: any): any[] => Array.isArray(d) ? d : [];

  const fetchTeam = async (from: string, to: string) => {
    setTeamLoading(true);
    try {
      const [perf, mix] = await Promise.all([
        axios.get(`${API_BASE}/team/performance`,    { params: { from, to } }),
        axios.get(`${API_BASE}/team/customer-mix`,   { params: { from, to } }),
      ]);
      setTeamData(safeArr(perf.data));
      setTeamMixData(safeArr(mix.data));
    } catch (e) { console.error(e); } finally { setTeamLoading(false); }
  };

  const fetchCustomers = async (from: string, to: string, rpId?: string) => {
    setCustLoading(true);
    try {
      const params: any = { from, to };
      if (rpId) params.rp_id = rpId;
      const r = await axios.get(`${API_BASE}/customers/top`, { params });
      setCustData(safeArr(r.data)); setCustPage(0);
    } catch (e) { console.error(e); } finally { setCustLoading(false); }
  };

  const fetchRisk = async (rpId?: string) => {
    setRiskLoading(true);
    try {
      const params: any = {};
      if (rpId) params.rp_id = rpId;
      const r = await axios.get(`${API_BASE}/risk/customers`, { params });
      setRiskData(safeArr(r.data));
    } catch (e) { console.error(e); } finally { setRiskLoading(false); }
  };

  const fetchDelivery = async (date: string) => {
    setDelivLoading(true);
    try {
      const [pipeline, orders] = await Promise.all([
        axios.get(`${API_BASE}/delivery/pipeline`, { params: { date } }),
        axios.get(`${API_BASE}/delivery/orders`,   { params: { from: date, to: date } }),
      ]);
      setDelivData(pipeline.data && typeof pipeline.data === 'object' ? pipeline.data : { snapshot: [], timing: {}, trend: [] });
      setDelivOrders(safeArr(orders.data));
    } catch (e) { console.error(e); } finally { setDelivLoading(false); }
  };

  const fetchTrend = async (gran: string, from: string, to: string, exCorp?: boolean) => {
    setTrendLoading(true);
    try {
      const excl = exCorp !== undefined ? exCorp : excludeCorporate;
      const r = await axios.get(`${API_BASE}/sales/trend`, {
        params: { granularity: gran, from, to, ...(excl ? { exclude_corporate: 'true' } : {}) },
      });
      setTrendData(safeArr(r.data));
    } catch (e) { console.error(e); } finally { setTrendLoading(false); }
  };

  const applyTrendPreset = (id: string) => {
    const now = new Date();
    const to = todayStr;
    const d2s = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let from = trendFrom;
    let gran = trendGranularity as string;
    if (id === 'last_7d')   { from = d2s(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));  gran = 'daily';   }
    if (id === 'last_30d')  { from = d2s(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)); gran = 'daily';   }
    if (id === 'last_3m')   { from = d2s(new Date(now.getFullYear(), now.getMonth() - 3, 1)); gran = 'weekly';  }
    if (id === 'last_6m')   { from = d2s(new Date(now.getFullYear(), now.getMonth() - 6, 1)); gran = 'monthly'; }
    if (id === 'this_year') { from = `${now.getFullYear()}-01-01`; gran = 'monthly'; }
    setTrendFrom(from);
    setTrendTo(to);
    setTrendGranularity(gran as 'daily' | 'weekly' | 'monthly');
    setTrendPeriod(id);
    fetchTrend(gran, from, to, excludeCorporate);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="loading-screen">
      <Loader2 size={36} color="#3b82f6" className="spin" />
      <p>Loading Mikro Analytics…</p>
    </div>
  );

  // ── Sidebar nav items ─────────────────────────────────────────────────────
  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { key: 'home',      icon: <LayoutDashboard size={17} />, label: 'Dashboard',  desc: 'Sales summary & trends' },
      ],
    },
    {
      label: 'Sales',
      items: [
        { key: 'team',      icon: <UserCheck size={17} />,       label: 'Salesmen',   desc: 'Team performance & conversions' },
        { key: 'customers', icon: <Users size={17} />,           label: 'Customers',  desc: 'Top customers & AR aging' },
        { key: 'inventory', icon: <ShoppingBag size={17} />,     label: 'Inventory',  desc: 'Item-level sales' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { key: 'delivery',  icon: <Truck size={17} />,           label: 'Delivery',   desc: 'Pipeline & fulfilment' },
        { key: 'risk',      icon: <AlertTriangle size={17} />,   label: 'Risk',       desc: 'Overdue & ghost accounts' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { key: 'reports',   icon: <FileText size={17} />,        label: 'Reports',    desc: 'Daily operations report' },
        { key: 'map',       icon: <MapPin size={17} />,          label: 'Map',        desc: 'Customer locations' },
      ],
    },
  ];
  const NAV = NAV_GROUPS.flatMap(g => g.items);
  const PAGE_META: Record<string, { desc: string; icon: React.ReactNode }> = Object.fromEntries(
    NAV.map(n => [n.key, { desc: n.desc, icon: n.icon }])
  );

  // ── Home ──────────────────────────────────────────────────────────────────
  const renderHome = () => {
    const summary    = Array.isArray(data.summary) ? data.summary : [];
    const aging      = Array.isArray(data.aging)   ? data.aging   : [];
    const monthly    = Array.isArray(data.monthly) ? data.monthly : [];
    const todayRow   = summary.find((s: any) => s.label === 'Today');
    const ystdRow    = summary.find((s: any) => s.label === 'Yesterday');
    const totalAR    = aging.reduce((a: number, c: any) => a + Number(c.outstanding), 0);
    const arCount    = aging.reduce((a: number, c: any) => a + Number(c.invoice_count), 0);
    const mogAvg     = monthly.reduce((a: number, c: any) => a + Number(c.mogappair), 0) / (monthly.length || 1);
    const medAvg     = monthly.reduce((a: number, c: any) => a + Number(c.medavakkam), 0) / (monthly.length || 1);
    const totalToday = Number(todayRow?.sales  || 0);
    const totalYstd  = Number(ystdRow?.sales   || 0);
    const vsYstdPct  = totalYstd > 0 ? ((totalToday - totalYstd) / totalYstd * 100) : 0;
    const isUp       = totalToday >= totalYstd;

    // Trend formatters
    const trendXFmt = (s: string) => {
      const d = new Date(s);
      return trendGranularity === 'monthly'
        ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    // AR aging bar colours by severity
    const agingColor = (bucket: string) => {
      if (bucket?.includes('90+') || bucket?.includes('60')) return '#ef4444';
      if (bucket?.includes('30'))  return '#f59e0b';
      return '#10b981';
    };

    // Monthly bar data for site comparison
    const recentMonths = monthly.slice(-6);

    return (
      <div className="dash-home">

        {/* ── KPI Row ── */}
        <div className="dash-kpi-row">
          {[
            {
              accent: '#3b82f6', bg: '#eff6ff',
              label: "Today's Revenue",
              value: fmt(totalToday),
              meta: `${todayRow?.invoice_count || 0} invoices`,
              badge: vsYstdPct !== 0
                ? { text: `${isUp ? '+' : ''}${vsYstdPct.toFixed(1)}% vs yesterday`, up: isUp }
                : null,
            },
            {
              accent: '#10b981', bg: '#ecfdf5',
              label: "Yesterday",
              value: fmt(totalYstd),
              meta: `${ystdRow?.invoice_count || 0} invoices`,
              badge: null,
            },
            {
              accent: '#ef4444', bg: '#fef2f2',
              label: 'Total Outstanding',
              value: fmt(totalAR),
              meta: `${arCount} unpaid invoices`,
              badge: { text: 'Needs follow-up', up: false },
            },
            {
              accent: '#8b5cf6', bg: '#f5f3ff',
              label: 'Site Monthly Avg',
              value: fmt((mogAvg + medAvg) / 2),
              meta: `Mog ${fmtShort(mogAvg)} · Med ${fmtShort(medAvg)}`,
              badge: null,
            },
          ].map((k, i) => (
            <div key={i} className="dash-kpi-card" style={{ '--kpi-accent': k.accent, '--kpi-bg': k.bg } as React.CSSProperties}>
              <div className="dash-kpi-accent-bar" />
              <div className="dash-kpi-body">
                <div className="dash-kpi-label">{k.label}</div>
                <div className="dash-kpi-value">{k.value}</div>
                <div className="dash-kpi-footer">
                  <span className="dash-kpi-meta">{k.meta}</span>
                  {k.badge && (
                    <span className={`dash-kpi-badge ${k.badge.up ? 'up' : 'down'}`}>
                      {k.badge.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {k.badge.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Sales Trend ── */}
        <div className="dash-chart-card" style={{ marginBottom: '1rem' }}>
          {/* Card header */}
          <div className="dash-chart-header">
            <div className="dash-chart-header-left">
              <div className="dash-chart-title">Sales Trend</div>
              <div className="dash-chart-sub">{trendData.length} data points · {trendFrom} → {trendTo}</div>
              {/* Inline legend */}
              <div className="dash-chart-legend">
                {[
                  { color: CHART_COLORS.total,      label: 'Total',       dashed: true  },
                  { color: CHART_COLORS.mogappair,   label: 'Mogappair',   dashed: false },
                  { color: CHART_COLORS.medavakkam,  label: 'Medavakkam',  dashed: false },
                ].map(l => (
                  <div key={l.label} className="dash-legend-item">
                    <svg width="18" height="10">
                      <line x1="0" y1="5" x2="18" y2="5"
                        stroke={l.color} strokeWidth="2.5"
                        strokeDasharray={l.dashed ? '5 3' : '0'} />
                    </svg>
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dash-chart-controls">
              {/* Corporate filter toggle */}
              <button
                onClick={() => {
                  const next = !excludeCorporate;
                  setExcludeCorporate(next);
                  fetchTrend(trendGranularity, trendFrom, trendTo, next);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.28rem 0.7rem', borderRadius: 20,
                  fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                  border: excludeCorporate ? '1.5px solid #f59e0b' : '1.5px solid var(--border)',
                  background: excludeCorporate ? '#fffbeb' : 'var(--surface)',
                  color: excludeCorporate ? '#b45309' : 'var(--text-2)',
                  boxShadow: excludeCorporate ? '0 0 0 3px rgba(245,158,11,0.15)' : 'none',
                  whiteSpace: 'nowrap',
                }}>
                <span style={{ fontSize: '0.65rem' }}>{excludeCorporate ? '✕' : '🏢'}</span>
                {excludeCorporate ? 'Corporate hidden' : 'Hide Corporate'}
              </button>
              <div className="gran-pills">
                {(['daily', 'weekly', 'monthly'] as const).map(g => (
                  <button key={g} className={`gran-pill${trendGranularity === g ? ' active' : ''}`}
                    onClick={() => { setTrendGranularity(g); setTrendPeriod('custom'); fetchTrend(g, trendFrom, trendTo); }}>
                    {g[0].toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
              <div className="preset-buttons">
                {TREND_PRESETS.map(p => (
                  <button key={p.id} className={`preset-btn${trendPeriod === p.id ? ' active' : ''}`}
                    onClick={() => applyTrendPreset(p.id)}>{p.label}</button>
                ))}
              </div>
              <div className="date-inputs">
                <input type="date" className="date-input" value={trendFrom}
                  onChange={e => { setTrendFrom(e.target.value); setTrendPeriod('custom'); }} />
                <span className="sep">→</span>
                <input type="date" className="date-input" value={trendTo}
                  onChange={e => { setTrendTo(e.target.value); setTrendPeriod('custom'); }} />
                <button className="apply-btn"
                  onClick={() => fetchTrend(trendGranularity, trendFrom, trendTo)}
                  disabled={trendLoading}>
                  {trendLoading ? <><Loader2 size={12} className="spin" /> Loading</> : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          {/* Area chart */}
          <div className="dash-chart-body" style={{ opacity: trendLoading ? 0.5 : 1, transition: 'opacity 0.25s' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={80} debounce={50}>
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={CHART_COLORS.total}      stopOpacity={0.25} />
                    <stop offset="95%"  stopColor={CHART_COLORS.total}      stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradMog" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={CHART_COLORS.mogappair}  stopOpacity={0.22} />
                    <stop offset="95%"  stopColor={CHART_COLORS.mogappair}  stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradMed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={CHART_COLORS.medavakkam} stopOpacity={0.22} />
                    <stop offset="95%"  stopColor={CHART_COLORS.medavakkam} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={trendXFmt}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={6} />
                <YAxis tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={54} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total_sales"  name="Total"      stroke={CHART_COLORS.total}      strokeWidth={2.5} strokeDasharray="6 3" fill="url(#gradTotal)" dot={false} activeDot={{ r: 5, fill: CHART_COLORS.total }}      />
                <Area type="monotone" dataKey="mogappair"    name="Mogappair"  stroke={CHART_COLORS.mogappair}  strokeWidth={2}   fill="url(#gradMog)"   dot={false} activeDot={{ r: 4, fill: CHART_COLORS.mogappair }}  />
                <Area type="monotone" dataKey="medavakkam"   name="Medavakkam" stroke={CHART_COLORS.medavakkam} strokeWidth={2}   fill="url(#gradMed)"   dot={false} activeDot={{ r: 4, fill: CHART_COLORS.medavakkam }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bottom row: AR Aging + Site Monthly ── */}
        <div className="dash-bottom-grid">

          {/* AR Aging */}
          <div className="dash-chart-card">
            <div className="dash-chart-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="dash-chart-header-left">
                <div className="dash-chart-title">Accounts Receivable Aging</div>
                <div className="dash-chart-sub">Outstanding balance by age bucket</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>{fmtShort(totalAR)}</div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{arCount} unpaid invoices</div>
              </div>
            </div>
            <div className="dash-chart-body" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={80} debounce={50}>
                <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="age_bucket" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
                  <Bar dataKey="outstanding" name="Outstanding" radius={[6, 6, 0, 0]}>
                    {aging.map((entry: any, index: number) => (
                      <Cell key={index} fill={agingColor(entry.age_bucket)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Site Comparison */}
          <div className="dash-chart-card">
            <div className="dash-chart-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="dash-chart-header-left">
                <div className="dash-chart-title">Monthly Site Performance</div>
                <div className="dash-chart-sub">Mogappair vs Medavakkam — last 6 months</div>
              </div>
              <div className="dash-chart-legend">
                {[
                  { color: CHART_COLORS.mogappair,  label: 'Mogappair'  },
                  { color: CHART_COLORS.medavakkam, label: 'Medavakkam' },
                ].map(l => (
                  <div key={l.label} className="dash-legend-item">
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dash-chart-body" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%" minHeight={80} debounce={50}>
                <BarChart data={recentMonths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month"
                    tickFormatter={s => new Date(s).toLocaleDateString('en-IN', { month: 'short' })}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="mogappair"  name="Mogappair"  fill={CHART_COLORS.mogappair}  radius={[4, 4, 0, 0]} />
                  <Bar dataKey="medavakkam" name="Medavakkam" fill={CHART_COLORS.medavakkam} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    );
  };

  // ── Team ──────────────────────────────────────────────────────────────────
  const renderTeam = () => {
    const AVATAR_COLORS = [
      ['#3b82f6','#8b5cf6'], ['#10b981','#3b82f6'], ['#f59e0b','#ef4444'],
      ['#8b5cf6','#ec4899'], ['#14b8a6','#6366f1'], ['#f97316','#eab308'],
    ];

    return (
      <>
        {/* ── Performance table ── */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="section-header">
            <div>
              <div className="section-title">Salesman Performance</div>
              <div className="section-sub">{teamData.length} salesmen · {teamFrom} → {teamTo}</div>
            </div>
            <DateFilter
              from={teamFrom} to={teamTo}
              onFromChange={setTeamFrom} onToChange={setTeamTo}
              onPreset={(p: string) => { const r = presetRange(p); setTeamFrom(r.from); setTeamTo(r.to); fetchTeam(r.from, r.to); }}
              onApply={() => fetchTeam(teamFrom, teamTo)}
              loading={teamLoading}
            />
          </div>
          <div className="table-wrap" style={{ opacity: teamLoading ? 0.5 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th>Salesman</th>
                  <th className="r">Revenue</th>
                  <th className="r">Customers</th>
                  <th className="r">Invoices</th>
                  <th className="r">Avg Ticket</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((m: any) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name.trim()}</td>
                    <td className="r" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(m.revenue)}</td>
                    <td className="r">{m.distinct_customers}</td>
                    <td className="r">{m.invoice_count}</td>
                    <td className="r">{fmt(Number(m.revenue) / Number(m.invoice_count))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Customer Intelligence ── */}
        {teamMixData.length > 0 && (
          <div className="card" style={{ opacity: teamLoading ? 0.5 : 1 }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="section-title" style={{ marginBottom: '0.2rem' }}>Customer Intelligence</div>
              <div className="section-sub">{teamFrom} → {teamTo} · Conversions, returning &amp; one-time customers per salesman</div>
            </div>

            <div className="team-mix-grid">
              {teamMixData.map((sm: any, idx: number) => {
                const [c1, c2] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const total      = Number(sm.conversions) || 1;
                const againPct   = Math.round(Number(sm.bought_again) / total * 100);
                const onePct     = 100 - againPct;

                return (
                  <div key={sm.salesman_id} className="team-mix-card">
                    {/* Header */}
                    <div className="tm-header">
                      <div className="tm-avatar" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                        {sm.salesman_name.trim()[0]}
                      </div>
                      <div>
                        <div className="tm-name">{sm.salesman_name.trim()}</div>
                        <div className="tm-sub">{sm.conversions} new customers converted this period</div>
                      </div>
                    </div>

                    {/* Split bar — bought again vs stayed one-time, within conversions */}
                    <div className="tm-bar-wrap">
                      <div className="tm-bar">
                        {againPct > 0 && <div className="tm-bar-new" style={{ width: `${againPct}%` }} />}
                        {onePct   > 0 && <div className="tm-bar-ret" style={{ width: `${onePct}%` }} />}
                      </div>
                      <div className="tm-bar-labels">
                        <span style={{ color: '#10b981' }}>{againPct}% bought again</span>
                        <span style={{ color: '#3b82f6' }}>{onePct}% one-time so far</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="tm-stats">
                      <div className="tm-stat">
                        <div className="tm-stat-num" style={{ color: '#f59e0b' }}>{sm.conversions}</div>
                        <div className="tm-stat-label">Conversions</div>
                        <div className="tm-stat-pct" style={{ background: '#fffbeb', color: '#b45309' }}>Total</div>
                      </div>
                      <div className="tm-stat-divider" />
                      <div className="tm-stat tm-stat-clickable"
                        onClick={() => openDrawer('bought-again', sm.salesman_id, sm.salesman_name)}
                        title="Click to see list">
                        <div className="tm-stat-num" style={{ color: '#10b981' }}>{sm.bought_again}</div>
                        <div className="tm-stat-label">Bought Again</div>
                        <div className="tm-stat-pct" style={{ background: '#ecfdf5', color: '#10b981' }}>{againPct}%</div>
                        <div className="tm-stat-hint">View list →</div>
                      </div>
                      <div className="tm-stat-divider" />
                      <div className="tm-stat tm-stat-clickable"
                        onClick={() => openDrawer('one-time', sm.salesman_id, sm.salesman_name)}
                        title="Click to see list">
                        <div className="tm-stat-num" style={{ color: '#94a3b8' }}>{sm.one_time}</div>
                        <div className="tm-stat-label">One-time so far</div>
                        <div className="tm-stat-pct" style={{ background: '#f1f5f9', color: '#64748b' }}>{onePct}%</div>
                        <div className="tm-stat-hint">View list →</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="tm-legend">
              <span className="tm-legend-dot" style={{ background: '#f59e0b' }} />
              <span>Conversions — customers whose very first invoice (with their salesman) falls in this period</span>
              <span className="tm-legend-sep">·</span>
              <span className="tm-legend-dot" style={{ background: '#10b981' }} />
              <span>Bought again — of those converted, how many have since placed more than 1 order</span>
              <span className="tm-legend-sep">·</span>
              <span className="tm-legend-dot" style={{ background: '#e2e8f0', border: '1px solid #cbd5e1' }} />
              <span>One-time so far — converted but only 1 invoice ever yet</span>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Customers ─────────────────────────────────────────────────────────────
  const renderCustomers = () => {
    const toggleSort = (key: string) =>
      setCustSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

    const sortIcon = (key: string) =>
      custSort.key !== key
        ? <span className="sort-icon">↕</span>
        : <span className="sort-icon active">{custSort.dir === 'desc' ? '↓' : '↑'}</span>;

    const filtered = custData.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()));

    const sorted = [...filtered].sort((a, b) => {
      const dir = custSort.dir === 'desc' ? -1 : 1;
      if (custSort.key === 'name') return dir * a.name.localeCompare(b.name);
      if (custSort.key === 'last_order_date') return dir * (new Date(a.last_order_date).getTime() - new Date(b.last_order_date).getTime());
      return dir * (Number(a[custSort.key]) - Number(b[custSort.key]));
    });

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const page = Math.min(custPage, Math.max(0, totalPages - 1));
    const rows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPending = sorted.reduce((a, c) => a + Number(c.pending), 0);

    const inactiveBadge = (d: number) => d <= 14 ? 'badge-green' : d <= 30 ? 'badge-yellow' : 'badge-red';
    const overdueClass  = (d: number) => d === 0 ? '' : d <= 30 ? 'overdue-amber' : 'overdue-red';

    return (
      <div className="full-section">
        <div className="full-section-inner">
          <div className="cust-toolbar">
            <div>
              <div className="section-title">All Customers</div>
              <div className="section-sub">
                {filtered.length} customers
                {totalPending > 0 && <> · <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(totalPending)} outstanding</span></>}
              </div>
            </div>
            <div className="toolbar-right">
              <select className="rp-select" value={custRpId}
                onChange={e => { setCustRpId(e.target.value); fetchCustomers(custFrom, custTo, e.target.value); }}>
                <option value="">All Salesmen</option>
                {rpList.map((rp: any) => (
                  <option key={rp.id} value={rp.id}>{rp.name.trim()}</option>
                ))}
              </select>
              <DateFilter
                from={custFrom} to={custTo}
                onFromChange={setCustFrom} onToChange={setCustTo}
                onPreset={(p: string) => { const r = presetRange(p); setCustFrom(r.from); setCustTo(r.to); fetchCustomers(r.from, r.to, custRpId); }}
                onApply={() => fetchCustomers(custFrom, custTo, custRpId)}
                loading={custLoading}
              />
            </div>
          </div>

          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input type="text" className="search-input" placeholder="Search customer…"
              value={custSearch} onChange={e => { setCustSearch(e.target.value); setCustPage(0); }} />
          </div>
        </div>

        <div className="table-wrap" style={{ opacity: custLoading ? 0.5 : 1 }}>
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('name')}>Customer {sortIcon('name')}</th>
                <th className="sortable r" onClick={() => toggleSort('total_sales')}>Sales {sortIcon('total_sales')}</th>
                <th className="sortable r" onClick={() => toggleSort('avg_order_value')}>Avg Order {sortIcon('avg_order_value')}</th>
                <th className="sortable r" onClick={() => toggleSort('orders_per_month')}>Orders/Mo {sortIcon('orders_per_month')}</th>
                <th className="sortable r" onClick={() => toggleSort('invoice_count')}>Invoices {sortIcon('invoice_count')}</th>
                <th className="sortable" onClick={() => toggleSort('last_order_date')}>Last Order {sortIcon('last_order_date')}</th>
                <th className="sortable" onClick={() => toggleSort('days_inactive')}>Inactive {sortIcon('days_inactive')}</th>
                <th className="sortable r" onClick={() => toggleSort('pending')}>Outstanding {sortIcon('pending')}</th>
                <th className="sortable r" onClick={() => toggleSort('oldest_unpaid_days')}>Oldest Unpaid {sortIcon('oldest_unpaid_days')}</th>
                <th className="sortable r" onClick={() => toggleSort('unpaid_count')}>Unpaid Bills {sortIcon('unpaid_count')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.name}>
                    {c.name.trim()}
                  </td>
                  <td className="r" style={{ color: 'var(--primary)', fontWeight: 600 }}>{fmt(c.total_sales)}</td>
                  <td className="r">{fmt(c.avg_order_value)}</td>
                  <td className="r">{Number(c.orders_per_month).toFixed(1)}</td>
                  <td className="r">{c.invoice_count}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {new Date(c.last_order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td><span className={`badge ${inactiveBadge(Number(c.days_inactive))}`}>{c.days_inactive}d</span></td>
                  <td className="r" style={{ fontWeight: Number(c.pending) > 0 ? 600 : 400, color: Number(c.pending) > 0 ? 'var(--danger)' : 'var(--text-light)' }}>
                    {Number(c.pending) > 0 ? fmt(c.pending) : '—'}
                  </td>
                  <td className={`r ${overdueClass(Number(c.oldest_unpaid_days))}`}>
                    {Number(c.oldest_unpaid_days) > 0 ? `${c.oldest_unpaid_days}d` : '—'}
                  </td>
                  <td className="r" style={{ color: Number(c.unpaid_count) > 0 ? 'var(--danger)' : 'var(--text-light)' }}>
                    {Number(c.unpaid_count) > 0 ? c.unpaid_count : '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="full-section-inner" style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
            <div className="pagination">
              <button className="page-btn" onClick={() => setCustPage(0)} disabled={page === 0}>«</button>
              <button className="page-btn" onClick={() => setCustPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
              <span className="page-info">Page {page + 1} of {totalPages} · {filtered.length} customers</span>
              <button className="page-btn" onClick={() => setCustPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
              <button className="page-btn" onClick={() => setCustPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Inventory ─────────────────────────────────────────────────────────────
  const renderInventory = () => (
    <div className="card">
      <div className="section-header">
        <div>
          <div className="section-title">Top Moving Items</div>
          <div className="section-sub">Last 90 days · {Array.isArray(data.items) ? data.items.length : 0} items</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Item Name</th>
              <th className="r">Units Sold</th>
              <th className="r">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data.items) ? data.items : []).map((item: any) => (
              <tr key={item.id}>
                <td><span className="badge badge-blue">{item.code}</span></td>
                <td style={{ fontWeight: 500 }}>{item.name}</td>
                <td className="r">{Number(item.units_sold).toLocaleString('en-IN')}</td>
                <td className="r" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(item.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Risk ──────────────────────────────────────────────────────────────────
  const renderRisk = () => {
    const LEVELS = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'WATCH'] as const;
    const LEVEL_LABELS: Record<string, string> = { all: 'All Risk', CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', WATCH: 'Watch' };

    const toggleRiskSort = (key: string) =>
      setRiskSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

    const rSortIcon = (key: string) =>
      riskSort.key !== key
        ? <span className="sort-icon">↕</span>
        : <span className="sort-icon active">{riskSort.dir === 'desc' ? '↓' : '↑'}</span>;

    const RISK_LEVEL_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, WATCH: 1 };

    const isGhost = (c: any) => Number(c.days_inactive) > 45 && Number(c.pending) > 0;

    const filtered = riskData.filter(c => {
      if (riskLevel !== 'all' && c.risk_level !== riskLevel) return false;
      if (ghostOnly && !isGhost(c)) return false;
      if (riskSearch && !c.name.toLowerCase().includes(riskSearch.toLowerCase())) return false;
      return true;
    });

    const sortedRisk = [...filtered].sort((a, b) => {
      const dir = riskSort.dir === 'desc' ? -1 : 1;
      if (riskSort.key === 'name') return dir * a.name.localeCompare(b.name);
      if (riskSort.key === 'responsible_party')
        return dir * (a.responsible_party ?? '').localeCompare(b.responsible_party ?? '');
      if (riskSort.key === 'risk_level')
        return dir * ((RISK_LEVEL_ORDER[a.risk_level] ?? 0) - (RISK_LEVEL_ORDER[b.risk_level] ?? 0));
      return dir * (Number(a[riskSort.key]) - Number(b[riskSort.key]));
    });

    const critical      = riskData.filter(c => c.risk_level === 'CRITICAL').length;
    const high          = riskData.filter(c => c.risk_level === 'HIGH').length;
    const ghostCustomers = riskData.filter(c => Number(c.days_inactive) > 45 && Number(c.pending) > 0);
    const ghost         = ghostCustomers.length;
    const ghostValue    = ghostCustomers.reduce((a, c) => a + Number(c.pending), 0);
    const totalExp      = riskData.reduce((a, c) => a + Number(c.pending), 0);
    const avgOverdue = riskData.filter(c => Number(c.oldest_unpaid_days) > 0)
      .reduce((a, c, _, arr) => a + Number(c.oldest_unpaid_days) / arr.length, 0);

    const flags = (c: any) => {
      const f: { cls: string; label: string; icon: React.ReactNode }[] = [];
      if (Number(c.days_inactive) > 45 && Number(c.pending) > 0)
        f.push({ cls: 'flag-ghost',    label: 'Ghost',          icon: <Ghost size={9} /> });
      if (Number(c.oldest_unpaid_days) > 90)
        f.push({ cls: 'flag-overdue',  label: '90d+ Overdue',   icon: <Clock size={9} /> });
      else if (Number(c.oldest_unpaid_days) > 60)
        f.push({ cls: 'flag-overdue',  label: '60d+ Overdue',   icon: <Clock size={9} /> });
      if (Number(c.pending) > 100000)
        f.push({ cls: 'flag-exposure', label: 'High Exposure',  icon: <BadgeDollarSign size={9} /> });
      if (Number(c.unpaid_count) >= 5)
        f.push({ cls: 'flag-repeat',   label: `${c.unpaid_count} Unpaid`, icon: <AlertCircle size={9} /> });
      if (Number(c.days_inactive) > 30 && Number(c.pending) === 0)
        f.push({ cls: 'flag-inactive', label: 'Inactive',       icon: <Clock size={9} /> });
      return f;
    };

    return (
      <>
        {/* KPI summary */}
        <div className="risk-summary">
          <div className="risk-kpi">
            <div className="risk-kpi-label">Critical Customers</div>
            <div className="risk-kpi-value" style={{ color: '#dc2626' }}>{critical}</div>
            <div className="risk-kpi-sub">{high} high · {riskData.length} total at risk</div>
          </div>
          <div className="risk-kpi">
            <div className="risk-kpi-label">Total Exposure</div>
            <div className="risk-kpi-value" style={{ color: '#9f1239' }}>{fmt(totalExp)}</div>
            <div className="risk-kpi-sub">Outstanding across all risk customers</div>
          </div>
          <div className="risk-kpi">
            <div className="risk-kpi-label">Ghost Customers</div>
            <div className="risk-kpi-value" style={{ color: '#7c3aed' }}>{ghost}</div>
            <div className="risk-kpi-sub">Inactive 45d+ with unpaid bills</div>
          </div>
          <div className="risk-kpi">
            <div className="risk-kpi-label">Ghost Pending Value</div>
            <div className="risk-kpi-value" style={{ color: '#7c3aed' }}>{fmt(ghostValue)}</div>
            <div className="risk-kpi-sub">Total bills outstanding across {ghost} ghost accounts</div>
          </div>
          <div className="risk-kpi">
            <div className="risk-kpi-label">Avg Overdue Age</div>
            <div className="risk-kpi-value" style={{ color: '#b45309' }}>{Math.round(avgOverdue)}d</div>
            <div className="risk-kpi-sub">Across customers with outstanding</div>
          </div>
        </div>

        {/* Table card */}
        <div className="full-section">
          <div className="full-section-inner">
            <div className="cust-toolbar">
              <div>
                <div className="section-title">Risk Register</div>
                <div className="section-sub">{sortedRisk.length} customers shown</div>
              </div>
              <div className="toolbar-right">
                <select className="rp-select" value={riskRpId}
                  onChange={e => { setRiskRpId(e.target.value); fetchRisk(e.target.value); }}>
                  <option value="">All Salesmen</option>
                  {rpList.map((rp: any) => (
                    <option key={rp.id} value={rp.id}>{rp.name.trim()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Level pills + ghost filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.85rem 0', flexWrap: 'wrap' }}>
              <div className="risk-filter-pills">
                {LEVELS.map(l => (
                  <button key={l}
                    className={`risk-pill ${riskLevel === l ? (l === 'all' ? 'active-all' : `active-${l}`) : ''}`}
                    onClick={() => setRiskLevel(l)}>
                    {LEVEL_LABELS[l]}
                    <span style={{ marginLeft: '0.35rem', opacity: 0.7, fontSize: '0.65rem' }}>
                      {l === 'all' ? riskData.length : riskData.filter(c => c.risk_level === l).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Ghost toggle */}
              <button
                onClick={() => setGhostOnly(g => !g)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s',
                  border: ghostOnly ? '1.5px solid #7c3aed' : '1.5px solid var(--border)',
                  background: ghostOnly ? '#ede9fe' : 'var(--surface)',
                  color: ghostOnly ? '#7c3aed' : 'var(--text-2)',
                  boxShadow: ghostOnly ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
                }}>
                <Ghost size={13} />
                Ghost Only
                <span style={{
                  background: ghostOnly ? '#7c3aed' : '#e2e8f0',
                  color: ghostOnly ? '#fff' : '#64748b',
                  borderRadius: 10, fontSize: '0.62rem', fontWeight: 700,
                  padding: '1px 6px', minWidth: 18, textAlign: 'center',
                }}>
                  {ghost}
                </span>
              </button>

              <div className="search-wrap" style={{ margin: 0 }}>
                <Search size={13} className="search-icon" />
                <input type="text" className="search-input" placeholder="Search customer…"
                  value={riskSearch} onChange={e => setRiskSearch(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="table-wrap" style={{ opacity: riskLoading ? 0.5 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleRiskSort('risk_level')}>Risk {rSortIcon('risk_level')}</th>
                  <th className="sortable" onClick={() => toggleRiskSort('name')}>Customer {rSortIcon('name')}</th>
                  <th className="sortable" onClick={() => toggleRiskSort('responsible_party')}>Salesman {rSortIcon('responsible_party')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('pending')}>Outstanding {rSortIcon('pending')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('oldest_unpaid_days')}>Oldest Unpaid {rSortIcon('oldest_unpaid_days')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('unpaid_count')}>Unpaid Bills {rSortIcon('unpaid_count')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('days_inactive')}>Days Inactive {rSortIcon('days_inactive')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('sales_6m')}>Sales (6M) {rSortIcon('sales_6m')}</th>
                  <th className="sortable r" onClick={() => toggleRiskSort('risk_score')}>Score {rSortIcon('risk_score')}</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {sortedRisk.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`risk-badge risk-${c.risk_level}`}>
                        {c.risk_level}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.name}>
                      {c.name.trim()}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {c.responsible_party ? c.responsible_party.trim() : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td className="r" style={{ fontWeight: 700, color: Number(c.pending) > 0 ? '#dc2626' : 'var(--text-light)' }}>
                      {Number(c.pending) > 0 ? fmt(c.pending) : '—'}
                    </td>
                    <td className="r">
                      {Number(c.oldest_unpaid_days) > 0
                        ? <span className={Number(c.oldest_unpaid_days) > 90 ? 'overdue-red' : Number(c.oldest_unpaid_days) > 60 ? 'overdue-amber' : ''}>
                            {c.oldest_unpaid_days}d
                            {c.oldest_unpaid_date && <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: 4, fontSize: '0.72rem' }}>
                              ({new Date(c.oldest_unpaid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                            </span>}
                          </span>
                        : '—'}
                    </td>
                    <td className="r">{Number(c.unpaid_count) > 0 ? c.unpaid_count : '—'}</td>
                    <td className="r">
                      <span className={`badge ${Number(c.days_inactive) > 45 ? 'badge-red' : Number(c.days_inactive) > 30 ? 'badge-yellow' : 'badge-green'}`}>
                        {c.days_inactive}d
                      </span>
                    </td>
                    <td className="r" style={{ color: Number(c.sales_6m) === 0 ? 'var(--text-light)' : 'var(--text-muted)' }}>
                      {Number(c.sales_6m) > 0 ? fmt(c.sales_6m) : <span style={{ fontSize: '0.72rem' }}>No orders</span>}
                    </td>
                    <td className="r" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>
                      {c.risk_score}
                    </td>
                    <td>
                      <div className="risk-flags">
                        {flags(c).map((f, i) => (
                          <span key={i} className={`risk-flag ${f.cls}`}>
                            {f.icon}{f.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedRisk.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                    No customers match this filter
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // ── Delivery ──────────────────────────────────────────────────────────────
  const renderDelivery = () => {
    const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
      not_delivered:       { label: 'Not Delivered', color: '#f59e0b', bg: '#fffbeb' },
      packed:              { label: 'Packed',         color: '#3b82f6', bg: '#eff6ff' },
      shipped:             { label: 'Shipped',        color: '#6366f1', bg: '#eef2ff' },
      fully_delivered:     { label: 'Delivered',      color: '#10b981', bg: '#ecfdf5' },
      partially_delivered: { label: 'Partial',        color: '#14b8a6', bg: '#f0fdfa' },
    };
    const STATUS_ORDER = ['not_delivered', 'packed', 'shipped', 'fully_delivered', 'partially_delivered'];

    const fmtTime = (ts: string | null) =>
      ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

    const snapshotMap: Record<string, number> = {};
    (delivData.snapshot || []).forEach((r: any) => { snapshotMap[r.delivery_status] = Number(r.count); });
    const totalOrders = Object.values(snapshotMap).reduce((a, b) => a + b, 0);

    const toggleDelivSort = (key: string) =>
      setDelivSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
    const dSortIcon = (key: string) =>
      delivSort.key !== key
        ? <span className="sort-icon">↕</span>
        : <span className="sort-icon active">{delivSort.dir === 'desc' ? '↓' : '↑'}</span>;

    const toggleExpand = (id: string) =>
      setDelivExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const diffMins = (a: string | null, b: string | null): number | null =>
      a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : null;

    const fmtDateTime = (ts: string | null) =>
      ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

    const filteredOrders = delivOrders.filter(o => {
      if (delivStatus && o.delivery_status !== delivStatus) return false;
      if (delivSiteId && String(o.site_id) !== delivSiteId) return false;
      return true;
    });

    const sortedOrders = [...filteredOrders].sort((a, b) => {
      const dir = delivSort.dir === 'desc' ? -1 : 1;
      const tsSort = (at: string | null, bt: string | null) => {
        if (!at && !bt) return 0;
        if (!at) return 1;   // nulls always last regardless of direction
        if (!bt) return -1;
        return dir * (new Date(at).getTime() - new Date(bt).getTime());
      };
      switch (delivSort.key) {
        case 'voucher_number': return dir * a.voucher_number.localeCompare(b.voucher_number);
        case 'customer':       return dir * a.customer.localeCompare(b.customer);
        case 'site_id':        return dir * (Number(a.site_id) - Number(b.site_id));
        case 'delivery_status': return dir * (a.delivery_status || '').localeCompare(b.delivery_status || '');
        case 'invoice_created_at': return tsSort(a.invoice_created_at, b.invoice_created_at);
        case 'packed_at':    return tsSort(a.packed_at,    b.packed_at);
        case 'shipped_at':   return tsSort(a.shipped_at,   b.shipped_at);
        case 'delivered_at': return tsSort(a.delivered_at, b.delivered_at);
        case 'total_amount': return dir * (Number(a.total_amount) - Number(b.total_amount));
        case 'delivery_person': return dir * (a.delivery_person || '').localeCompare(b.delivery_person || '');
        case 'total_minutes': {
          const am = a.delivered_at ? new Date(a.delivered_at).getTime() - new Date(a.invoice_created_at).getTime() : null;
          const bm = b.delivered_at ? new Date(b.delivered_at).getTime() - new Date(b.invoice_created_at).getTime() : null;
          if (am == null && bm == null) return 0;
          if (am == null) return 1;
          if (bm == null) return -1;
          return dir * (am - bm);
        }
        default: return 0;
      }
    });

    const timing = delivData.timing || {};
    const trendData = delivData.trend ? [...delivData.trend] : [];

    return (
      <>
        {/* Date picker */}
        <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date</span>
          <input type="date" className="date-input" value={delivDate}
            onChange={e => { setDelivDate(e.target.value); fetchDelivery(e.target.value); }} />
          {delivLoading && <Loader2 size={14} className="spin" color="var(--primary)" />}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginLeft: 'auto' }}>
            {totalOrders} orders tracked
          </span>
        </div>

        {/* Pipeline status cards */}
        <div className="pipeline-grid">
          {STATUS_ORDER.map(status => {
            const cfg = STATUS_CFG[status];
            const count = snapshotMap[status] || 0;
            const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
            return (
              <div key={status}
                className={`card pipeline-card${delivStatus === status ? ' pipeline-card-active' : ''}`}
                style={{ borderTop: `3px solid ${cfg.color}` }}
                onClick={() => setDelivStatus(delivStatus === status ? '' : status)}>
                <div className="pipeline-label" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="pipeline-count">{count}</div>
                <div className="pipeline-pct">{pct}% of today</div>
              </div>
            );
          })}
          <div className="card pipeline-card" style={{ borderTop: '3px solid #f59e0b', cursor: 'default' }}>
            <div className="pipeline-label" style={{ color: '#f59e0b' }}>Avg Deliver Time</div>
            <div className="pipeline-count">{fmtMins(timing.avg_minutes ?? null)}</div>
            <div className="pipeline-pct">
              {timing.delivered_count ? `${timing.delivered_count} delivered` : 'No deliveries yet'}
              {timing.min_minutes != null && timing.max_minutes != null &&
                <> · {fmtMins(Number(timing.min_minutes))}–{fmtMins(Number(timing.max_minutes))}</>}
            </div>
          </div>
        </div>

        {/* 7-day trend chart */}
        {trendData.length > 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="chart-card-title">7-Day Delivery Trend</div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%" minHeight={80} debounce={50}>
                <ComposedChart data={trendData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="" vertical={false} />
                  <XAxis dataKey="date"
                    tickFormatter={s => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}m`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<DeliveryTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar yAxisId="left" dataKey="delivered" name="Delivered" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="pending" name="Not Delivered" fill="#fbbf24" radius={[4,4,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_minutes" name="Avg Time (min)"
                    stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Orders table */}
        <div className="full-section">
          <div className="full-section-inner">
            <div className="cust-toolbar">
              <div>
                <div className="section-title">Orders — {delivDate}</div>
                <div className="section-sub">
                  {sortedOrders.length} orders shown
                  {delivStatus && <> · <span style={{ color: STATUS_CFG[delivStatus]?.color }}>{STATUS_CFG[delivStatus]?.label}</span></>}
                </div>
              </div>
              <div className="toolbar-right">
                <select className="rp-select" value={delivSiteId} onChange={e => setDelivSiteId(e.target.value)}>
                  <option value="">All Sites</option>
                  <option value="1">Mogappair</option>
                  <option value="4">Medavakkam</option>
                </select>
                <div className="risk-filter-pills">
                  {['', ...STATUS_ORDER].map(s => {
                    const label = s === '' ? 'All' : (STATUS_CFG[s]?.label || s);
                    const cnt   = s === '' ? filteredOrders.length : (delivOrders.filter(o => o.delivery_status === s && (!delivSiteId || String(o.site_id) === delivSiteId)).length);
                    return (
                      <button key={s}
                        className={`risk-pill ${delivStatus === s ? 'active-all' : ''}`}
                        onClick={() => setDelivStatus(s)}>
                        {label}
                        <span style={{ marginLeft: '0.3rem', opacity: 0.6, fontSize: '0.65rem' }}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="table-wrap" style={{ opacity: delivLoading ? 0.5 : 1 }}>
            <table>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleDelivSort('customer')}>Customer {dSortIcon('customer')}</th>
                  <th className="sortable r" onClick={() => toggleDelivSort('invoice_created_at')}>→ Packed {dSortIcon('invoice_created_at')}</th>
                  <th className="sortable r" onClick={() => toggleDelivSort('packed_at')}>→ Shipped {dSortIcon('packed_at')}</th>
                  <th className="sortable r" onClick={() => toggleDelivSort('shipped_at')}>→ Delivered {dSortIcon('shipped_at')}</th>
                  <th className="sortable r" onClick={() => toggleDelivSort('total_minutes')}>Total {dSortIcon('total_minutes')}</th>
                  <th className="sortable" onClick={() => toggleDelivSort('delivery_person')}>Delivered By {dSortIcon('delivery_person')}</th>
                  <th className="sortable" onClick={() => toggleDelivSort('delivery_status')}>Status {dSortIcon('delivery_status')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((o: any) => {
                  const d1 = diffMins(o.invoice_created_at, o.packed_at);
                  const d2 = diffMins(o.packed_at, o.shipped_at);
                  const d3 = diffMins(o.shipped_at, o.delivered_at);
                  const total = diffMins(o.invoice_created_at, o.delivered_at);
                  const cfg = STATUS_CFG[o.delivery_status];
                  const expanded = delivExpanded.has(String(o.id));
                  const durStyle = (m: number | null) => ({
                    color: m == null ? 'var(--text-light)' : m > 60 ? '#b45309' : 'var(--success)',
                    fontWeight: m != null ? 600 : 400,
                  });
                  return (
                    <React.Fragment key={o.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(String(o.id))}>
                        <td style={{ fontWeight: 500, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.customer}>
                          {o.customer.trim()}
                          <span className={`badge ${o.site_id === 1 ? 'badge-blue' : 'badge-green'}`}
                            style={{ fontSize: '0.6rem', marginLeft: '0.4rem', verticalAlign: 'middle' }}>
                            {o.site_id === 1 ? 'Mog' : 'Med'}
                          </span>
                        </td>
                        <td className="r" style={{ fontSize: '0.78rem', ...durStyle(d1) }}>{fmtMins(d1)}</td>
                        <td className="r" style={{ fontSize: '0.78rem', ...durStyle(d2) }}>{fmtMins(d2)}</td>
                        <td className="r" style={{ fontSize: '0.78rem', ...durStyle(d3) }}>{fmtMins(d3)}</td>
                        <td className="r" style={{ fontSize: '0.78rem', ...durStyle(total) }}>{fmtMins(total)}</td>
                        <td style={{ fontSize: '0.78rem', color: o.delivery_person ? 'var(--text)' : 'var(--text-light)', whiteSpace: 'nowrap' }}>
                          {o.delivery_person ? o.delivery_person.trim() : '—'}
                        </td>
                        <td>
                          {cfg && <span style={{
                            display: 'inline-flex', padding: '0.18rem 0.5rem', borderRadius: 999,
                            fontSize: '0.65rem', fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                          }}>{cfg.label}</span>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={7} style={{ padding: '0.5rem 1rem 0.6rem 2rem' }}>
                            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span><span style={{ opacity: 0.6 }}>Invoice</span> <strong style={{ color: 'var(--primary)' }}>{o.voucher_number}</strong></span>
                              <span><span style={{ opacity: 0.6 }}>Amount</span> <strong style={{ color: 'var(--text)' }}>{fmt(o.total_amount)}</strong></span>
                              <span><span style={{ opacity: 0.6 }}>Created</span> <strong style={{ color: 'var(--text)' }}>{fmtDateTime(o.invoice_created_at)}</strong></span>
                              <span><span style={{ opacity: 0.6 }}>Packed</span> <strong style={{ color: o.packed_at ? 'var(--primary)' : 'var(--text-light)' }}>{fmtDateTime(o.packed_at)}</strong></span>
                              <span><span style={{ opacity: 0.6 }}>Shipped</span> <strong style={{ color: o.shipped_at ? '#6366f1' : 'var(--text-light)' }}>{fmtDateTime(o.shipped_at)}</strong></span>
                              <span><span style={{ opacity: 0.6 }}>Delivered</span> <strong style={{ color: o.delivered_at ? 'var(--success)' : 'var(--text-light)' }}>{fmtDateTime(o.delivered_at)}</strong></span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {sortedOrders.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {delivLoading ? 'Loading…' : `No orders for ${delivDate}`}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // ── Reports ───────────────────────────────────────────────────────────────
  const renderReports = () => {
    const SITE_NAME: Record<number, string> = { 1: 'Mogappair', 4: 'Medavakkam' };
    const SITES = [1, 4];

    const salesSummary: any[]  = reportData?.sales?.summary  || [];
    const salesGroups: any[]   = reportData?.sales?.groups   || [];
    const salesmen: any[]      = reportData?.sales?.salesmen || [];
    const siteTiming: any[]    = reportData?.delivery?.site_timing || [];
    const agents: any[]        = reportData?.delivery?.agents || [];
    const conversions: any[]   = reportData?.conversions || [];

    const totalSales       = salesSummary.reduce((a: number, r: any) => a + Number(r.total_amount), 0);
    const totalInvoices    = salesSummary.reduce((a: number, r: any) => a + Number(r.invoice_count), 0);
    const totalDelivered   = siteTiming.reduce((a: number, r: any) => a + Number(r.delivered_count || 0), 0);
    const totalOrders      = siteTiming.reduce((a: number, r: any) => a + Number(r.total_orders || 0), 0);
    const totalConversions = conversions.reduce((a: number, r: any) => a + Number(r.conversions), 0);

    const pctShare = (part: any, total: any) =>
      Number(total) > 0 ? Math.round(Number(part) / Number(total) * 100) : 0;

    const timeColor = (mins: any) => {
      if (mins == null || mins === '') return '#94a3b8';
      return Number(mins) > 90 ? '#dc2626' : Number(mins) > 60 ? '#b45309' : '#059669';
    };

    const TimeChip = ({ mins }: { mins: any }) => {
      const c = timeColor(mins);
      return mins == null || mins === ''
        ? <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</span>
        : <span style={{ background: c + '14', color: c, padding: '2px 8px', borderRadius: 5, fontSize: '0.75rem', fontWeight: 700 }}>{fmtMins(mins)}</span>;
    };

    const reportDateLabel = reportData
      ? new Date(reportData.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const delivRate = totalOrders > 0 ? Math.round(totalDelivered / totalOrders * 100) : 0;

    // Shared card header style
    const cardHeader = (accent: string, icon: React.ReactNode, title: string, badge?: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.1rem', borderBottom: '1px solid #f1f5f9', background: `linear-gradient(135deg,${accent}0a 0%,transparent 100%)` }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: accent + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', flex: 1 }}>{title}</span>
        {badge}
      </div>
    );

    return (
      <>
        {/* ── Controls bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '0.85rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
            <FileText size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>Daily Operations Report</div>
            <div style={{ fontSize: '0.72rem', color: reportData ? '#3b82f6' : '#94a3b8', marginTop: 1, fontWeight: reportData ? 600 : 400 }}>
              {reportData ? reportDateLabel : 'Select a date and generate the report'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input type="date" className="date-input" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            <button className="apply-btn" onClick={() => fetchReport(reportDate)} disabled={reportLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {reportLoading ? <><Loader2 size={12} className="spin" />Generating…</> : 'Generate'}
            </button>
            {reportData && (
              <button onClick={() => exportReportPDF(reportData)} disabled={pdfLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, padding: '0.48rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading ? 0.65 : 1 }}>
                {pdfLoading ? <><Loader2 size={13} className="spin" /> Exporting…</> : <><Download size={13} /> Export PDF</>}
              </button>
            )}
          </div>
        </div>

        {/* ── Empty state ── */}
        {!reportData && !reportLoading && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <FileText size={24} color="#94a3b8" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#475569', marginBottom: '0.35rem' }}>No report generated</div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Pick a date above and click Generate to load the daily operations report</div>
          </div>
        )}

        {/* ── Report content ── */}
        {reportData && (
          <div id="report-print-area">

            {/* Print-only header */}
            <div className="report-print-header">
              <div className="report-print-title">Mikro Daily Operations Report</div>
              <div className="report-print-date">{reportDateLabel}</div>
            </div>

            {/* ── KPI Strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
              {[
                { label: 'Total Revenue', value: fmt(totalSales), sub: `${totalInvoices} invoices total`, accent: '#3b82f6' },
                ...salesSummary.map((s: any) => ({
                  label: SITE_NAME[s.site_id] ?? `Site ${s.site_id}`,
                  value: fmt(s.total_amount),
                  sub: `${s.invoice_count} inv · ${pctShare(s.total_amount, totalSales)}% share`,
                  accent: s.site_id === 1 ? '#3b82f6' : '#10b981',
                })),
                { label: 'Delivery Rate', value: `${delivRate}%`, sub: `${totalDelivered} of ${totalOrders} delivered`, accent: '#f59e0b' },
                { label: 'New Customers', value: `${totalConversions}`, sub: `${conversions.length} salesman${conversions.length !== 1 ? 's' : ''}`, accent: '#8b5cf6' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderTop: `3px solid ${k.accent}`, borderRadius: 12, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>{k.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', lineHeight: 1, marginBottom: '0.3rem' }}>{k.value}</div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Row 1: Sales by Group + Salesman Performance ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

              {/* Sales by Group */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                {cardHeader('#3b82f6', <BadgeDollarSign size={14} />, 'Sales by Group',
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3b82f6' }}>{fmt(totalSales)}</span>
                )}
                {salesSummary.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No sales data for this date</div>
                  : salesSummary.map((site: any) => {
                    const groups = salesGroups.filter((g: any) => Number(g.site_id) === Number(site.site_id));
                    const sitePct = pctShare(site.total_amount, totalSales);
                    return (
                      <div key={site.site_id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', flex: 1 }}>
                            {SITE_NAME[site.site_id] ?? `Site ${site.site_id}`}
                          </span>
                          <div style={{ width: 60, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${sitePct}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', minWidth: 60, textAlign: 'right' }}>{fmt(site.total_amount)}</span>
                        </div>
                        {groups.map((g: any, gi: number) => {
                          const gPct = pctShare(g.total_amount, site.total_amount);
                          return (
                            <div key={gi} style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 1.1rem', borderBottom: gi < groups.length - 1 ? '1px solid #f8fafc' : 'none', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.77rem', color: '#475569', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.group_name}</span>
                              <div style={{ width: 48, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${gPct}%`, height: '100%', background: '#bfdbfe', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: '0.67rem', color: '#94a3b8', flexShrink: 0, width: 28, textAlign: 'right' }}>{gPct}%</span>
                              <span style={{ fontSize: '0.77rem', fontWeight: 600, color: '#1e293b', flexShrink: 0, width: 72, textAlign: 'right' }}>{fmt(g.total_amount)}</span>
                              <span style={{ fontSize: '0.66rem', color: '#94a3b8', flexShrink: 0 }}>{g.invoice_count}inv</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                }
              </div>

              {/* Salesman Performance */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                {cardHeader('#8b5cf6', <UserCheck size={14} />, 'Salesman Performance')}
                {salesmen.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No salesman data for this date</div>
                  : SITES.map(siteId => {
                    const rows = salesmen.filter((r: any) => Number(r.site_id) === siteId);
                    if (!rows.length) return null;
                    const siteTotal = rows.reduce((a: number, r: any) => a + Number(r.total_amount), 0);
                    return (
                      <div key={siteId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1.1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>{SITE_NAME[siteId]}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8b5cf6' }}>{fmt(siteTotal)}</span>
                        </div>
                        {rows.map((r: any, ri: number) => {
                          const pct = pctShare(r.total_amount, siteTotal);
                          return (
                            <div key={ri} style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 1.1rem', borderBottom: ri < rows.length - 1 ? '1px solid #f8fafc' : 'none', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.77rem', fontWeight: 600, color: '#1e293b', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.salesman_name?.trim()}</span>
                              <div style={{ width: 48, height: 4, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: '#ddd6fe', borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: '0.67rem', color: '#94a3b8', flexShrink: 0, width: 28, textAlign: 'right' }}>{pct}%</span>
                              <span style={{ fontSize: '0.77rem', fontWeight: 700, color: '#8b5cf6', flexShrink: 0, width: 72, textAlign: 'right' }}>{fmt(r.total_amount)}</span>
                              <span style={{ fontSize: '0.66rem', color: '#94a3b8', flexShrink: 0 }}>{r.invoice_count}inv</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* ── Row 2: New Customers + Delivery Operations ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

              {/* New Customer Conversions */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                {cardHeader('#10b981', <Users size={14} />, 'New Customer Conversions',
                  totalConversions > 0
                    ? <span style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#059669', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{totalConversions} today</span>
                    : undefined
                )}
                {conversions.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No new customers acquired today</div>
                  : <div style={{ padding: '0.4rem 0' }}>
                    {conversions.map((c: any, ci: number) => (
                      <div key={ci} style={{ padding: '0.6rem 1.1rem', borderBottom: ci < conversions.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{c.salesman_name?.trim()}</span>
                          <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#059669', borderRadius: 20, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{c.conversions} new</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {(c.customers || []).map((cu: any, cui: number) => (
                            <span key={cui} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 7px', fontSize: '0.73rem', color: '#334155', fontWeight: 500 }}>
                              {cu.name}
                              {cu.invoice && <span style={{ color: '#94a3b8', fontSize: '0.65rem', marginLeft: 3 }}>{cu.invoice}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>

              {/* Delivery Operations */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                {cardHeader('#f59e0b', <Truck size={14} />, 'Delivery Operations',
                  totalOrders > 0
                    ? <span style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{delivRate}% rate</span>
                    : undefined
                )}
                {siteTiming.length === 0 && agents.length === 0
                  ? <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.83rem' }}>No delivery data for this date</div>
                  : <div style={{ padding: '0.75rem 1.1rem' }}>
                    {/* Site pipeline */}
                    {siteTiming.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>Site Pipeline</div>
                        {siteTiming.map((s: any, si: number) => {
                          const dp = s.total_orders > 0 ? Math.round(s.delivered_count / s.total_orders * 100) : 0;
                          return (
                            <div key={si} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '0.7rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.85rem', background: '#1e293b' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>{s.site_name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{s.delivered_count}/{s.total_orders}</span>
                                  <div style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ width: `${dp}%`, height: '100%', background: '#10b981', borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: dp === 100 ? '#34d399' : '#fbbf24' }}>{dp}%</span>
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
                                {[
                                  { label: 'Order→Packed', val: s.avg_order_to_packed, t: 45 },
                                  { label: 'Packed→Shipped', val: s.avg_packed_to_shipped, t: 30 },
                                  { label: 'Shipped→Delivered', val: s.avg_shipped_to_delivered, t: 60 },
                                  { label: 'End-to-End', val: s.avg_total, t: 120 },
                                ].map((st, i) => (
                                  <div key={i} style={{ padding: '0.45rem 0.6rem', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, marginBottom: 3 }}>{st.label}</div>
                                    <TimeChip mins={st.val} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {/* Agent performance */}
                    {agents.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem', marginTop: siteTiming.length > 0 ? '0.25rem' : 0 }}>Agent Performance</div>
                        {SITES.map(siteId => {
                          const rows = agents.filter((a: any) => Number(a.site_id) === siteId);
                          if (!rows.length) return null;
                          return (
                            <div key={siteId} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
                              <div style={{ padding: '0.4rem 0.75rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>{SITE_NAME[siteId]}</span>
                              </div>
                              {rows.map((a: any, ai: number) => (
                                <div key={ai} style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.75rem', borderBottom: ai < rows.length - 1 ? '1px solid #f8fafc' : 'none', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.77rem', color: '#1e293b', fontWeight: 600, flex: 1 }}>{a.agent_name?.trim()}</span>
                                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{a.deliveries} del.</span>
                                  <TimeChip mins={a.avg_shipped_to_delivered} />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                }
              </div>
            </div>

          </div>
        )}
      </>
    );
  };

  // ── Page titles ───────────────────────────────────────────────────────────
  const PAGE_TITLE: Record<string, string> = {
    home: 'Dashboard', team: 'Salesmen', customers: 'Customers', inventory: 'Inventory', risk: 'Risk Register', delivery: 'Delivery Pipeline', reports: 'Daily Report', map: 'Customer Map',  };

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? '' : ' collapsed'}`}>

        {/* Brand */}
        <div className="sidebar-brand-area">
          <div className="sidebar-logo-wrap">
            <div className="sidebar-logo">
              <span>M</span>
            </div>
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">Mikro</div>
            <div className="sidebar-brand-sub">Analytics</div>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">{group.label}</div>
              {group.items.map(({ key, icon, label }) => (
                <button
                  key={key}
                  className={`nav-item${activeTab === key ? ' active' : ''}`}
                  onClick={() => setActiveTab(key)}
                  title={!sidebarOpen ? label : undefined}
                >
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{label}</span>
                  {activeTab === key && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer-area">
          <div className="sidebar-status-dot" />
          <span className="sidebar-status-text">All systems live</span>
        </div>

      </aside>

      {/* ── Main ── */}
      <main className="main-content">

        {/* Top bar */}
        <header className="dashboard-header">
          <div className="header-left">
            <div className="header-page-icon">{PAGE_META[activeTab]?.icon}</div>
            <div>
              <h1 className="header-title">{PAGE_TITLE[activeTab]}</h1>
              <p className="header-desc">{PAGE_META[activeTab]?.desc}</p>
            </div>
          </div>
          <div className="header-right">
            <div className="header-date-pill">
              <span className="header-date-day">{today.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <span className="header-date-full">{today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="header-live-badge">
              <span className="live-dot" />
              Live
            </div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === 'home'      && renderHome()}
          {activeTab === 'team'      && renderTeam()}
          {activeTab === 'customers' && renderCustomers()}
          {activeTab === 'inventory' && renderInventory()}
          {activeTab === 'risk'      && renderRisk()}
          {activeTab === 'delivery'  && renderDelivery()}
          {activeTab === 'reports'   && renderReports()}
          {activeTab === 'map'       && <MapPage />}
        </div>
      </main>

      {/* ── One-time customers drawer ── */}
      {otDrawer.open && (
        <div className="ot-overlay" onClick={() => setOtDrawer(d => ({ ...d, open: false }))}>
          <div className="ot-drawer" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="ot-drawer-header">
              <div>
                <div className="ot-drawer-title">
                  {otDrawer.type === 'bought-again' ? 'Bought Again Customers' : 'One-time Customers'}
                </div>
                <div className="ot-drawer-sub">
                  {otDrawer.salesman.trim()} · {teamFrom} → {teamTo}
                </div>
              </div>
              <button className="ot-close" onClick={() => setOtDrawer(d => ({ ...d, open: false }))}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="ot-drawer-body">
              {otLoading ? (
                <div className="ot-loading"><Loader2 size={22} className="spin" color="var(--primary)" /><span>Loading…</span></div>
              ) : otData.length === 0 ? (
                <div className="ot-empty">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{otDrawer.type === 'bought-again' ? '📭' : '🎉'}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {otDrawer.type === 'bought-again' ? 'No repeat buyers yet' : 'All converted customers came back!'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    {otDrawer.type === 'bought-again' ? 'None of the conversions have placed a second order yet.' : 'No one-time customers in this period.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="ot-count-bar">
                    <span className="ot-count">{otData.length}</span>
                    <span className="ot-count-label">
                      {otDrawer.type === 'bought-again'
                        ? 'customers converted this period who came back and ordered again'
                        : 'customers converted once with no repeat orders yet'}
                    </span>
                  </div>
                  <div className="ot-list">
                    {otData.map((c: any, i: number) => (
                      <div key={c.customer_id} className="ot-item">
                        <div className="ot-item-num">{i + 1}</div>
                        <div className="ot-item-body">
                          <div className="ot-item-name">{c.customer_name.trim()}</div>
                          <div className="ot-item-meta">
                            <span className="ot-item-inv">{c.first_invoice}</span>
                            <span className="ot-item-dot">·</span>
                            <span>{new Date(c.first_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {otDrawer.type === 'bought-again' && <>
                              <span className="ot-item-dot">·</span>
                              <span style={{ color: '#10b981', fontWeight: 600 }}>{c.invoice_count} orders total</span>
                            </>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="ot-item-amount">{fmt(otDrawer.type === 'bought-again' ? c.total_spent : c.first_amount)}</div>
                          {otDrawer.type === 'bought-again' && (
                            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                              lifetime spend
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
