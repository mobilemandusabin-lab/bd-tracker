import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  RefreshCw, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
  DollarSign, Store, Users, AlertTriangle, BarChart3, Package,
  Truck, RotateCcw, CreditCard, AlertCircle, ExternalLink, X,
  MousePointerClick, ChevronRight, ChevronDown, GitCompareArrows,
  Clock, Award, AlertOctagon, Timer
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { API_URL } from '../config/api';

const RED_GRADIENT = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FECDD3', '#FBD38D', '#F6AD55', '#ED8936'];
const STATUS_COLORS = { Pending: '#fbbf24', Processing: '#3b82f6', Shipped: '#f59e0b', Delivered: '#10b981', Cancelled: '#ef4444', Returned: '#8b5cf6' };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Helpers ────────────────────────────────────────────────────
const formatRs = (amount) => `Rs. ${(amount || 0).toLocaleString()}`;
const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const monthLabel = (m) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;
const pctChange = (current, prev) => {
  if (!prev || prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
};
const formatHours = (hours) => {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

// ─── Tooltips ───────────────────────────────────────────────────
const RichTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-100 min-w-[160px]">
      <p className="font-extrabold text-sm text-slate-900 mb-2 pb-1.5 border-b border-slate-100">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || '#DC2626' }} />
            {p.name}
          </span>
          <span className="text-xs font-extrabold text-slate-900">
            {typeof p.value === 'number' ? (p.name?.toLowerCase().includes('revenue') || p.name?.toLowerCase().includes('amount') ? `Rs. ${p.value.toLocaleString()}` : p.value.toLocaleString()) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Reusable Components ────────────────────────────────────────
const SectionCard = ({ title, icon: Icon, children, className = '', onClick, hint, badge }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${className}`}
    onClick={onClick}>
    <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={15} className="text-red-600" />}
        <h3 className="text-[13px] font-extrabold text-slate-900">{title}</h3>
        {badge && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-600">{badge}</span>}
      </div>
      {onClick && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest hover:text-red-400">
          <MousePointerClick size={9} /> Drill down
        </span>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, subValue, tooltip, onClick, trend, trendLabel }) => (
  <div onClick={onClick}
    className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-red-100 group relative ${onClick ? 'cursor-pointer' : ''}`}>
    {/* Hover tooltip */}
    {tooltip && (
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-medium whitespace-nowrap shadow-xl">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45" />
        </div>
      </div>
    )}
    <div className="flex items-center justify-between mb-2">
      <div className="p-2 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 group-hover:from-red-100 group-hover:to-red-200/50 transition-all">
        <Icon size={15} className="text-red-600" />
      </div>
      {trend !== undefined && trend !== null && (
        <span className={`flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'text-emerald-700 bg-emerald-50' : trend < 0 ? 'text-red-700 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
          {trend > 0 ? <ArrowUpRight size={10} /> : trend < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-xl font-extrabold text-slate-900">{value}</p>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
    {subValue && <p className="text-[10px] text-slate-400 mt-1">{subValue}</p>}
    {trendLabel && <p className="text-[9px] text-slate-300 mt-1">{trendLabel}</p>}
    {onClick && <ChevronRight size={14} className="absolute bottom-3 right-3 text-slate-200 group-hover:text-red-400 transition-colors" />}
  </div>
);

const ComparisonBadge = ({ current, prev, format }) => {
  const change = pctChange(current, prev);
  const isUp = change > 0;
  const isDown = change < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${isUp ? 'text-emerald-700 bg-emerald-50' : isDown ? 'text-red-700 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
      {isUp ? <ArrowUpRight size={10} /> : isDown ? <ArrowDownRight size={10} /> : <Minus size={10} />}
      {Math.abs(change)}%
    </span>
  );
};

// ─── Drill-Down Modal ───────────────────────────────────────────
const DrilldownModal = ({ isOpen, onClose, title, subtitle, icon: Icon, filters, token }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        params.append('limit', '500');

        const res = await axios.get(`${API_URL}/nepalcan-orders/orders?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        let filtered = res.data.orders || [];
        if (filters.vendor) filtered = filtered.filter(o => (o.vendor || '').toLowerCase() === filters.vendor.toLowerCase());
        if (filters.paymentMethod) filtered = filtered.filter(o => (o.paymentMethod || 'Unknown') === filters.paymentMethod);
        if (filters.statusIn) filtered = filtered.filter(o => filters.statusIn.includes(o.orderStatus));

        setOrders(filtered);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [isOpen, filters, token]);

  const totalRevenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const delivered = orders.filter(o => o.orderStatus === 'Delivered').length;
  const returned = orders.filter(o => o.orderStatus === 'Returned').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {Icon && <div className="p-2 bg-white/10 rounded-xl"><Icon size={18} /></div>}
            <div>
              <h3 className="font-extrabold text-base">{title}</h3>
              <p className="text-xs text-red-200">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
        </div>
        {!loading && orders.length > 0 && (
          <div className="grid grid-cols-4 gap-3 p-5 border-b border-slate-50 bg-slate-50/50 shrink-0">
            <div className="text-center"><p className="text-lg font-extrabold text-slate-900">{orders.length}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Orders</p></div>
            <div className="text-center"><p className="text-lg font-extrabold text-emerald-600">{formatRs(totalRevenue)}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Revenue</p></div>
            <div className="text-center"><p className="text-lg font-extrabold text-blue-600">{delivered}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Delivered</p></div>
            <div className="text-center"><p className="text-lg font-extrabold text-violet-600">{returned}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Returned</p></div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12"><Package size={32} className="text-slate-200 mx-auto mb-2" /><p className="text-xs font-bold text-slate-400">No orders found</p></div>
          ) : (
            <div className="space-y-2">
              {orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(order => (
                <Link key={order.orderId} to={`/nepalcan-sales/${order.orderId}`}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-red-50/30 transition-colors group"
                  onClick={onClose}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-extrabold text-red-600">{order.orderId}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        style={{ backgroundColor: (STATUS_COLORS[order.orderStatus] || '#94a3b8') + '20', color: STATUS_COLORS[order.orderStatus] || '#94a3b8' }}>
                        {order.orderStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{order.customer || 'Unknown'} &middot; {order.vendor || 'No vendor'} &middot; {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-sm font-extrabold text-slate-900">{formatRs(order.totalAmount)}</span>
                    <ExternalLink size={12} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Month Selector Component ───────────────────────────────────
const MonthSelector = ({ months, selected, onChange, compareMode, compareWith, onCompareChange }) => {
  const [open, setOpen] = useState(false);
  const selectedMonth = months.find(m => m.year === selected.year && m.month === selected.month);
  const compareMonth = compareMode ? months.find(m => m.year === compareWith.year && m.month === compareWith.month) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Primary month selector */}
      <div className="relative">
        <button onClick={() => setOpen(open === 'primary' ? false : 'primary')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-red-600 transition-all">
          {selectedMonth ? monthLabel(selectedMonth) : 'Select Month'}
          <ChevronDown size={14} className={`transition-transform text-slate-400 ${open === 'primary' ? 'rotate-180' : ''}`} />
        </button>
        {open === 'primary' && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
              {months.map((m, i) => (
                <button key={i} onClick={() => { onChange(m); setOpen(false); }}
                  className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-between ${m.year === selected.year && m.month === selected.month ? 'text-red-600 bg-red-50' : 'text-slate-700'}`}>
                  <span>{monthLabel(m)}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{m.totalOrders} orders &middot; {formatRs(m.deliveredRevenue)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Compare toggle */}
      <button onClick={() => onCompareChange(!compareMode)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${compareMode ? 'bg-red-50 text-red-600 border-red-200 ring-1 ring-red-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600'}`}>
        <GitCompareArrows size={13} />
        Compare
      </button>

      {/* Compare month selector */}
      {compareMode && (
        <div className="relative">
          <button onClick={() => setOpen(open === 'compare' ? false : 'compare')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-red-600 transition-all">
            {compareMonth ? monthLabel(compareMonth) : 'Compare with...'}
            <ChevronDown size={14} className={`transition-transform text-slate-400 ${open === 'compare' ? 'rotate-180' : ''}`} />
          </button>
          {open === 'compare' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                {months.filter(m => !(m.year === selected.year && m.month === selected.month)).map((m, i) => (
                  <button key={i} onClick={() => { onCompareChange(m); setOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-between ${m.year === compareWith?.year && m.month === compareWith?.month ? 'text-red-600 bg-red-50' : 'text-slate-700'}`}>
                    <span>{monthLabel(m)}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{m.totalOrders} orders &middot; {formatRs(m.deliveredRevenue)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────
const NepalcanAnalyticsPage = ({ embedded }) => {
  const [monthlyData, setMonthlyData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const token = useSelector((state) => state.auth.token);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [monthlyRes, analyticsRes] = await Promise.all([
        axios.get(`${API_URL}/nepalcan-orders/monthly`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/nepalcan-orders/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const months = monthlyRes.data.months || [];
      setMonthlyData(months);
      setAnalyticsData(analyticsRes.data);
      if (months.length > 0 && !selectedMonth) {
        setSelectedMonth(months[0]);
        if (months.length > 1) setCompareWith(months[1]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const current = selectedMonth;
  const compare = compareMode ? compareWith : null;

  // Build monthly trend chart data (reversed for chronological order)
  const trendData = useMemo(() => [...monthlyData].reverse().map(m => ({
    ...m,
    label: monthLabel(m),
    shortLabel: `${MONTH_NAMES[m.month - 1].slice(0, 3)} '${String(m.year).slice(2)}`
  })), [monthlyData]);

  const handleBarClick = (data) => {
    if (data?.year && data?.month) {
      const m = monthlyData.find(d => d.year === data.year && d.month === data.month);
      if (m) setSelectedMonth(m);
    }
  };

  const openDrilldown = (title, subtitle, icon, filters) => {
    setDrilldown({ title, subtitle, icon, filters });
  };

  const getMonthRange = (m) => {
    if (!m) return {};
    const start = `${m.year}-${String(m.month).padStart(2, '0')}-01`;
    const end = new Date(m.year, m.month, 0).toISOString().split('T')[0];
    return { startDate: start, endDate: end };
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em]">Loading Analytics</p>
          <p className="text-[10px] text-slate-300 mt-1">Crunching Nepalcan data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><AlertCircle size={28} className="text-red-400" /></div>
          <p className="text-sm font-extrabold text-slate-900 mb-1">Failed to Load</p>
          <p className="text-xs text-slate-400 mb-6">{error}</p>
          <button onClick={fetchData} className="px-6 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-5 max-w-[1600px] mx-auto'}>
      {/* ── Hero Header ─────────────────────────────────── */}
      {!embedded && (
        <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-2xl p-6 lg:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-6 bg-white/40 rounded-full" />
                <span className="text-[10px] font-bold text-red-200 uppercase tracking-[0.2em]">Nepalcan Integration</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Analytics Dashboard</h1>
              <p className="text-xs text-red-200/80 mt-1.5">Month-wise trends, vendor performance, and operational insights</p>
            </div>
            <button onClick={fetchData}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl text-xs font-bold text-white transition-all shrink-0">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Month Selector ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
        <div className="flex-1">
          <MonthSelector months={monthlyData} selected={selectedMonth || {}} onChange={setSelectedMonth}
            compareMode={compareMode} compareWith={compareWith || {}} onCompareChange={(val) => {
              if (typeof val === 'boolean') {
                setCompareMode(val);
                if (val && monthlyData.length > 1) setCompareWith(monthlyData[1]);
              } else {
                setCompareWith(val);
              }
            }} />
        </div>
        {embedded && (
          <button onClick={fetchData}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 transition-all shrink-0"
            title="Refresh data">
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {/* ── Monthly Trend Chart ─────────────────────────── */}
      {trendData.length > 0 && (
        <SectionCard title="Monthly Revenue & Orders" icon={TrendingUp} badge={`${trendData.length} months`}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barGap={6}>
                <defs>
                  <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DC2626" stopOpacity={1} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="ordersBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FCA5A5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#FEE2E2" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="revenue" orientation="left" tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<RichTooltip />} />
                <Legend verticalAlign="top" height={36}
                  formatter={(value) => <span className="text-xs font-bold text-slate-600">{value}</span>} />
                <Bar yAxisId="revenue" dataKey="deliveredRevenue" name="Revenue" fill="url(#revenueBarGrad)" radius={[6, 6, 0, 0]} barSize={24}
                  cursor="pointer" onClick={(d) => handleBarClick(d)} />
                <Bar yAxisId="orders" dataKey="totalOrders" name="Orders" fill="url(#ordersBarGrad)" radius={[6, 6, 0, 0]} barSize={24}
                  cursor="pointer" onClick={(d) => handleBarClick(d)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-300 text-center mt-2">Click any bar to select that month</p>
        </SectionCard>
      )}

      {/* ── Selected Month Summary ──────────────────────── */}
      {current && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Package} label="Total Orders" value={current.totalOrders}
            subValue={`${current.pendingOrders} pending \u00B7 ${current.processingOrders} processing`}
            tooltip={`Orders placed in ${monthLabel(current)}`}
            trend={compare ? pctChange(current.totalOrders, compare.totalOrders) : null}
            trendLabel={compare ? `vs ${monthLabel(compare)}` : null}
            onClick={() => openDrilldown(`${monthLabel(current)} - All Orders`, 'Every order placed this month', Package, getMonthRange(current))} />
          <MetricCard icon={DollarSign} label="Revenue" value={formatRs(current.deliveredRevenue)}
            subValue={`AOV: ${formatRs(current.avgOrderValue)}`}
            tooltip={`Delivered revenue in ${monthLabel(current)}`}
            trend={compare ? pctChange(current.deliveredRevenue, compare.deliveredRevenue) : null}
            trendLabel={compare ? `vs ${formatRs(compare.deliveredRevenue)}` : null}
            onClick={() => openDrilldown(`${monthLabel(current)} - Delivered Revenue`, 'Delivered orders this month', DollarSign, { ...getMonthRange(current), status: 'Delivered' })} />
          <MetricCard icon={Truck} label="Delivered" value={current.deliveredOrders}
            subValue={`${current.deliveryRate}% delivery rate`}
            tooltip={`${current.deliveredOrders} of ${current.totalOrders} orders delivered`}
            trend={compare ? pctChange(current.deliveredOrders, compare.deliveredOrders) : null}
            trendLabel={compare ? `vs ${compare.deliveredOrders} last period` : null}
            onClick={() => openDrilldown(`${monthLabel(current)} - Delivered`, 'Successfully fulfilled orders', Truck, { ...getMonthRange(current), status: 'Delivered' })} />
          <MetricCard icon={RotateCcw} label="Returns" value={current.returnedOrders}
            subValue={`${current.returnRate}% return rate \u00B7 ${formatRs(current.returnedRevenue)} lost`}
            tooltip={`${current.returnedOrders} returns lost ${formatRs(current.returnedRevenue)}`}
            trend={compare ? pctChange(current.returnedOrders, compare.returnedOrders) : null}
            trendLabel={compare ? `vs ${compare.returnedOrders} last period` : null}
            onClick={() => openDrilldown(`${monthLabel(current)} - Returns`, 'Returned orders this month', RotateCcw, { ...getMonthRange(current), status: 'Returned' })} />
        </div>
      )}

      {/* ── Comparison Panel (when compare mode is on) ──── */}
      {compareMode && compare && current && (
        <SectionCard title={`${monthLabel(current)} vs ${monthLabel(compare)}`} icon={GitCompareArrows} badge="Comparison">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metric</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLabel(current)}</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monthLabel(compare)}</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { label: 'Total Orders', key: 'totalOrders', icon: Package },
                  { label: 'Revenue', key: 'deliveredRevenue', icon: DollarSign, isRs: true },
                  { label: 'Delivered', key: 'deliveredOrders', icon: Truck },
                  { label: 'Returns', key: 'returnedOrders', icon: RotateCcw, invert: true },
                  { label: 'Cancelled', key: 'cancelledOrders', icon: X, invert: true },
                  { label: 'Avg Order Value', key: 'avgOrderValue', icon: BarChart3, isRs: true },
                  { label: 'Unique Vendors', key: 'uniqueVendors', icon: Store },
                  { label: 'Unique Customers', key: 'uniqueCustomers', icon: Users },
                  { label: 'Delivery Rate', key: 'deliveryRate', icon: Truck, suffix: '%' },
                  { label: 'Return Rate', key: 'returnRate', icon: RotateCcw, suffix: '%', invert: true },
                ].map(row => {
                  const cur = current[row.key] || 0;
                  const prev = compare[row.key] || 0;
                  const change = pctChange(cur, prev);
                  const isGood = row.invert ? change < 0 : change > 0;
                  return (
                    <tr key={row.key} className="hover:bg-red-50/30 transition-colors">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <row.icon size={13} className="text-red-400" />
                        <span className="text-xs font-bold text-slate-700">{row.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-extrabold text-slate-900">
                        {row.isRs ? formatRs(cur) : `${cur}${row.suffix || ''}`}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-500">
                        {row.isRs ? formatRs(prev) : `${prev}${row.suffix || ''}`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isGood ? 'text-emerald-700 bg-emerald-50' : change === 0 ? 'text-slate-400 bg-slate-50' : 'text-red-700 bg-red-50'}`}>
                          {change > 0 ? <ArrowUpRight size={10} /> : change < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                          {Math.abs(change)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Status Breakdown for Selected Month ─────────── */}
      {current && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <SectionCard title={`${monthLabel(current)} - Status Breakdown`} icon={BarChart3}>
            <div className="space-y-3">
              {[
                { label: 'Delivered', count: current.deliveredOrders, color: '#10b981', status: 'Delivered' },
                { label: 'Shipped', count: current.shippedOrders, color: '#f59e0b', status: 'Shipped' },
                { label: 'Processing', count: current.processingOrders, color: '#3b82f6', status: 'Processing' },
                { label: 'Pending', count: current.pendingOrders, color: '#fbbf24', status: 'Pending' },
                { label: 'Returned', count: current.returnedOrders, color: '#8b5cf6', status: 'Returned' },
                { label: 'Cancelled', count: current.cancelledOrders, color: '#ef4444', status: 'Cancelled' },
              ].filter(s => s.count > 0).map(s => {
                const pct = current.totalOrders > 0 ? Math.round((s.count / current.totalOrders) * 100) : 0;
                return (
                  <button key={s.label} onClick={() => openDrilldown(`${monthLabel(current)} - ${s.label}`, `${s.count} orders (${pct}%)`, Package, { ...getMonthRange(current), status: s.status })}
                    className="w-full group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-red-600 transition-colors">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900">{s.count}</span>
                        <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Month-over-Month Revenue Trend */}
          <SectionCard title="Revenue by Month" icon={DollarSign}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<RichTooltip />} />
                  <Area type="monotone" dataKey="deliveredRevenue" name="Revenue" stroke="#DC2626" strokeWidth={2.5} fill="url(#revAreaGrad)"
                    dot={{ fill: '#DC2626', r: 3, strokeWidth: 0 }} activeDot={{ fill: '#DC2626', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    cursor="pointer" onClick={(d) => handleBarClick(d)} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Vendors & Customers for Selected Month ──────── */}
      {current && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MetricCard icon={Store} label="Active Vendors" value={current.uniqueVendors}
            tooltip={`${current.uniqueVendors} unique vendors had orders in ${monthLabel(current)}`}
            trend={compare ? pctChange(current.uniqueVendors, compare.uniqueVendors) : null}
            trendLabel={compare ? `vs ${compare.uniqueVendors} last period` : null} />
          <MetricCard icon={Users} label="Unique Customers" value={current.uniqueCustomers}
            tooltip={`${current.uniqueCustomers} unique customers ordered in ${monthLabel(current)}`}
            trend={compare ? pctChange(current.uniqueCustomers, compare.uniqueCustomers) : null}
            trendLabel={compare ? `vs ${compare.uniqueCustomers} last period` : null} />
        </div>
      )}

      {/* ── Vendor Performance Table (from analytics endpoint) ── */}
      {analyticsData?.vendorPerformance?.length > 0 && (
        <SectionCard title="All-Time Vendor Performance (Top 15)" icon={Store} badge="All time">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['#', 'Vendor', 'Orders', 'Revenue', 'Delivered', 'Returned', 'Return Rate', 'Avg Amount'].map((label, i) => (
                    <th key={label} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analyticsData.vendorPerformance.map((v, i) => (
                  <tr key={v.vendor + i}
                    onClick={() => openDrilldown(v.vendor, `${v.totalOrders} orders \u00B7 ${formatRs(v.totalRevenue)}`, Store, { vendor: v.vendor })}
                    className="hover:bg-red-50/40 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${i === 0 ? 'bg-red-600 text-white' : i === 1 ? 'bg-red-100 text-red-700' : i === 2 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3"><span className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors truncate block max-w-[200px]" title={v.vendor}>{v.vendor}</span></td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">{v.totalOrders}</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-slate-900">{formatRs(v.totalRevenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-600">{v.deliveredCount}</td>
                    <td className="px-4 py-3"><span className={`text-sm font-bold ${v.returnedCount > 0 ? 'text-red-600' : 'text-slate-300'}`}>{v.returnedCount}</span></td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${v.returnRate > 15 ? 'text-red-700 bg-red-50 ring-1 ring-red-200' : v.returnRate > 10 ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-200' : 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200'}`}>{v.returnRate}%</span></td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-medium">{formatRs(v.avgAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Click any row to drill down into that vendor's orders</p>
        </SectionCard>
      )}

      {/* ── Vendor Processing Time Performance ──────────── */}
      {analyticsData?.vendorProcessingTime && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Best & Worst Processing Time */}
          <SectionCard title="Processing Time (Pending → Processing)" icon={Timer} badge="Avg hours">
            <div className="grid grid-cols-2 gap-4">
              {/* Best */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award size={14} className="text-emerald-600" />
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Fastest</p>
                </div>
                <div className="space-y-2">
                  {analyticsData.vendorProcessingTime.bestProcessing.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data</p>
                  ) : (
                    analyticsData.vendorProcessingTime.bestProcessing.map((v, i) => (
                      <button key={v.vendor}
                        onClick={() => openDrilldown(`${v.vendor} - Orders`, `${formatHours(v.avgProcessingHours)} avg processing · ${v.ordersWithProcessingData} orders`, Timer, { vendor: v.vendor })}
                        className="w-full flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 hover:bg-emerald-100/50 transition-colors text-left group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold bg-emerald-600 text-white shrink-0">{i + 1}</span>
                          <span className="text-[11px] font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{v.vendor}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-700 shrink-0">{formatHours(v.avgProcessingHours)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Worst */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon size={14} className="text-red-600" />
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Slowest</p>
                </div>
                <div className="space-y-2">
                  {analyticsData.vendorProcessingTime.worstProcessing.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data</p>
                  ) : (
                    analyticsData.vendorProcessingTime.worstProcessing.map((v, i) => (
                      <button key={v.vendor}
                        onClick={() => openDrilldown(`${v.vendor} - Orders`, `${formatHours(v.avgProcessingHours)} avg processing · ${v.ordersWithProcessingData} orders`, Timer, { vendor: v.vendor })}
                        className="w-full flex items-center justify-between p-2.5 bg-red-50/50 rounded-xl border border-red-100 hover:bg-red-100/50 transition-colors text-left group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold bg-red-600 text-white shrink-0">{i + 1}</span>
                          <span className="text-[11px] font-bold text-slate-900 truncate group-hover:text-red-700 transition-colors">{v.vendor}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-red-700 shrink-0">{formatHours(v.avgProcessingHours)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-300 mt-3 text-center">Click any vendor to see their orders</p>
          </SectionCard>

          {/* Best & Worst Fulfillment Time */}
          <SectionCard title="Fulfillment Time (Pending → Delivered)" icon={Clock} badge="Avg hours">
            <div className="grid grid-cols-2 gap-4">
              {/* Best */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award size={14} className="text-emerald-600" />
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Fastest</p>
                </div>
                <div className="space-y-2">
                  {analyticsData.vendorProcessingTime.bestFulfillment.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data</p>
                  ) : (
                    analyticsData.vendorProcessingTime.bestFulfillment.map((v, i) => (
                      <button key={v.vendor}
                        onClick={() => openDrilldown(`${v.vendor} - Delivered Orders`, `${formatHours(v.avgFulfillmentHours)} avg fulfillment · ${v.ordersWithFulfillmentData} orders`, Truck, { vendor: v.vendor, status: 'Delivered' })}
                        className="w-full flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 hover:bg-emerald-100/50 transition-colors text-left group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold bg-emerald-600 text-white shrink-0">{i + 1}</span>
                          <span className="text-[11px] font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{v.vendor}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-700 shrink-0">{formatHours(v.avgFulfillmentHours)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Worst */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon size={14} className="text-red-600" />
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Slowest</p>
                </div>
                <div className="space-y-2">
                  {analyticsData.vendorProcessingTime.worstFulfillment.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data</p>
                  ) : (
                    analyticsData.vendorProcessingTime.worstFulfillment.map((v, i) => (
                      <button key={v.vendor}
                        onClick={() => openDrilldown(`${v.vendor} - Delivered Orders`, `${formatHours(v.avgFulfillmentHours)} avg fulfillment · ${v.ordersWithFulfillmentData} orders`, Truck, { vendor: v.vendor, status: 'Delivered' })}
                        className="w-full flex items-center justify-between p-2.5 bg-red-50/50 rounded-xl border border-red-100 hover:bg-red-100/50 transition-colors text-left group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold bg-red-600 text-white shrink-0">{i + 1}</span>
                          <span className="text-[11px] font-bold text-slate-900 truncate group-hover:text-red-700 transition-colors">{v.vendor}</span>
                        </div>
                        <span className="text-[11px] font-extrabold text-red-700 shrink-0">{formatHours(v.avgFulfillmentHours)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-300 mt-3 text-center">Click any vendor to see their delivered orders</p>
          </SectionCard>
        </div>
      )}

      {/* ── Processing Time Distribution ────────────────── */}
      {analyticsData?.processingTimeDistribution && (
        <SectionCard title="Processing Time Distribution" icon={BarChart3} badge="All orders">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.processingTimeDistribution} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-100">
                      <p className="font-extrabold text-sm text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-1">{payload[0].value} orders</p>
                    </div>
                  );
                }} />
                <Bar dataKey="count" fill="#DC2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">How long orders take from Pending to Processing</p>
        </SectionCard>
      )}

      {/* ── Hourly Order Pattern ────────────────────────── */}
      {analyticsData?.hourlyPattern && (
        <SectionCard title="Orders by Hour of Day" icon={Clock} badge="24h pattern">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.hourlyPattern}>
                <defs>
                  <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-100">
                      <p className="font-extrabold text-sm text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-1">{payload[0].value} orders · {formatRs(payload[1]?.value || 0)}</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="orders" stroke="#DC2626" strokeWidth={2.5} fill="url(#hourGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Peak ordering hours across all vendors</p>
        </SectionCard>
      )}

      {/* ── Return Rate vs Processing Time Scatter ──────── */}
      {analyticsData?.returnVsProcessing?.length > 0 && (
        <SectionCard title="Return Rate vs Processing Time" icon={GitCompareArrows} badge="Correlation">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.returnVsProcessing.sort((a, b) => b.returnRate - a.returnRate).slice(0, 15)} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="vendor" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} angle={-35} textAnchor="end" height={60} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} label={{ value: 'Return %', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} label={{ value: 'Hours', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-100">
                      <p className="font-extrabold text-sm text-slate-900">{d.vendor}</p>
                      <p className="text-xs text-slate-500 mt-1">Return rate: {d.returnRate}%</p>
                      <p className="text-xs text-slate-500">Processing: {formatHours(d.avgProcessingHours)}</p>
                      <p className="text-xs text-slate-500">{d.totalOrders} orders · {formatRs(d.totalRevenue)}</p>
                    </div>
                  );
                }} />
                <Bar yAxisId="left" dataKey="returnRate" fill="#EF4444" radius={[4, 4, 0, 0]} name="Return %" />
                <Bar yAxisId="right" dataKey="avgProcessingHours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Processing Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded" /><span className="text-[10px] font-bold text-slate-400">Return Rate %</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded" /><span className="text-[10px] font-bold text-slate-400">Processing Hours</span></div>
          </div>
        </SectionCard>
      )}

      {/* ── Vendor Growth Trend ─────────────────────────── */}
      {analyticsData?.vendorGrowthTrend?.length > 0 && (
        <SectionCard title="Vendor Growth Trend" icon={TrendingUp} badge="Top 5 vendors">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart>
                <defs>
                  {analyticsData.vendorGrowthTrend.map((_, i) => (
                    <linearGradient key={i} id={`vendorGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={RED_GRADIENT[i]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={RED_GRADIENT[i]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-100">
                      <p className="font-extrabold text-sm text-slate-900">{label}</p>
                      {payload.map((p, i) => (
                        <p key={i} className="text-xs text-slate-500 mt-0.5">
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color }} />
                          {p.name}: {p.value} orders
                        </p>
                      ))}
                    </div>
                  );
                }} />
                <Legend />
                {analyticsData.vendorGrowthTrend.map((v, i) => (
                  <Area key={v.vendor} type="monotone" data={v.months.map(m => ({ ...m, label: `${MONTH_NAMES[m.month - 1]} ${m.year}` }))} dataKey="orders" name={v.vendor} stroke={RED_GRADIENT[i]} strokeWidth={2} fill={`url(#vendorGrad${i})`} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Month-over-month order count for top 5 vendors</p>
        </SectionCard>
      )}

      {/* ── Status Flow ─────────────────────────────────── */}
      {analyticsData?.statusFlow?.length > 0 && (
        <SectionCard title="Order Status Flow" icon={Truck} badge="Transitions">
          <div className="space-y-2">
            {analyticsData.statusFlow.slice(0, 12).map((flow, i) => {
              const maxCount = analyticsData.statusFlow[0]?.count || 1;
              const pct = Math.round((flow.count / maxCount) * 100);
              return (
                <div key={`${flow.from}-${flow.to}`} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-48 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: STATUS_COLORS[flow.from] + '20', color: STATUS_COLORS[flow.from] }}>{flow.from}</span>
                    <span className="text-slate-300">→</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: STATUS_COLORS[flow.to] + '20', color: STATUS_COLORS[flow.to] }}>{flow.to}</span>
                  </div>
                  <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden">
                    <div className="h-full rounded-lg transition-all" style={{ width: `${pct}%`, background: STATUS_COLORS[flow.to] || '#94a3b8' }} />
                  </div>
                  <span className="text-xs font-extrabold text-slate-700 w-16 text-right">{flow.count}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Most common order status transitions</p>
        </SectionCard>
      )}

      {/* ── Customer Lifetime Value ─────────────────────── */}
      {analyticsData?.customerLTV?.length > 0 && (
        <SectionCard title="Top Customers by Lifetime Value" icon={Users} badge="LTV">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">#</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orders</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Spent</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analyticsData.customerLTV.map((c, i) => (
                  <tr key={c.customer} className="hover:bg-red-50/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-extrabold ${i === 0 ? 'bg-red-600 text-white' : i === 1 ? 'bg-red-100 text-red-700' : i === 2 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-900 truncate max-w-[200px]" title={c.customer}>{c.customer}</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-700 text-right">{c.orderCount}</td>
                    <td className="px-4 py-2.5 text-sm font-extrabold text-slate-900 text-right">{formatRs(c.totalSpent)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-500 text-right">{formatRs(Math.round(c.totalSpent / c.orderCount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Top 20 customers by total spend</p>
        </SectionCard>
      )}

      {/* ── Customer Retention & Day of Week ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analyticsData?.customerRetention && (
          <SectionCard title="Customer Retention" icon={Users}
            onClick={() => openDrilldown('All Orders', 'Complete order list', Users, {})}>
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-6">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#DC2626" strokeWidth="8"
                      strokeDasharray={`${analyticsData.customerRetention.repeatRate * 2.64} ${264 - analyticsData.customerRetention.repeatRate * 2.64}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-extrabold text-slate-900">{analyticsData.customerRetention.repeatRate}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-600" /><span className="text-xs font-bold text-slate-600">Repeat: <span className="text-slate-900">{analyticsData.customerRetention.repeatCustomers}</span></span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-200" /><span className="text-xs font-bold text-slate-600">New: <span className="text-slate-900">{analyticsData.customerRetention.newCustomers}</span></span></div>
                  <p className="text-[10px] text-slate-400">Avg <span className="font-extrabold text-slate-700">{analyticsData.customerRetention.avgOrdersPerCustomer}</span> orders/customer</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                <div className="text-center p-2"><p className="text-xl font-extrabold text-slate-900">{analyticsData.customerRetention.totalCustomers}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Total</p></div>
                <div className="text-center p-2"><p className="text-xl font-extrabold text-red-600">{analyticsData.customerRetention.repeatCustomers}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Repeat</p></div>
                <div className="text-center p-2"><p className="text-xl font-extrabold text-slate-900">{analyticsData.customerRetention.avgOrdersPerCustomer}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Avg/Cust</p></div>
              </div>
            </div>
          </SectionCard>
        )}

        {analyticsData?.dayOfWeek?.length > 0 && (
          <SectionCard title="Orders by Day of Week" icon={BarChart3}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.dayOfWeek} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<RichTooltip />} />
                  <Bar dataKey="orders" name="Orders" fill="#DC2626" radius={[8, 8, 0, 0]} cursor="pointer">
                    {analyticsData.dayOfWeek.map((entry, i) => {
                      const max = Math.max(...analyticsData.dayOfWeek.map(d => d.orders));
                      return <Cell key={i} fill={entry.orders === max ? '#DC2626' : '#FCA5A5'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Orders At Risk ──────────────────────────────── */}
      {analyticsData?.ordersAtRisk && (
        <SectionCard title="Orders At Risk" icon={AlertTriangle}
          className={analyticsData.ordersAtRisk.length > 0 ? 'ring-1 ring-amber-200 bg-amber-50/20' : ''}
          onClick={analyticsData.ordersAtRisk.length > 0 ? () => openDrilldown('Orders At Risk', 'Stuck in Processing or Shipped', AlertTriangle, { statusIn: ['Processing', 'Shipped'] }) : undefined}
          badge={analyticsData.ordersAtRisk.length > 0 ? `${analyticsData.ordersAtRisk.length} stuck` : null}>
          {analyticsData.ordersAtRisk.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3"><Truck size={24} className="text-emerald-500" /></div>
              <p className="text-sm font-extrabold text-emerald-600">All Clear</p>
              <p className="text-[10px] text-slate-400 mt-0.5">No orders currently stuck</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analyticsData.ordersAtRisk.slice(0, 6).map(o => {
                const days = Math.floor((Date.now() - new Date(o.updatedAt)) / 86400000);
                return (
                  <Link key={o.orderId} to={`/nepalcan-sales/${o.orderId}`}
                    className="flex items-center justify-between p-4 bg-white border border-amber-100 rounded-xl hover:border-red-200 hover:bg-red-50/30 transition-all group"
                    onClick={e => e.stopPropagation()}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-extrabold text-red-600">{o.orderId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${o.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{o.orderStatus}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{o.customer} &middot; {o.vendor || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="text-right"><p className="text-sm font-extrabold text-red-600">{days}d</p><p className="text-[10px] text-slate-400">{formatRs(o.totalAmount)}</p></div>
                      <ExternalLink size={14} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Return Analysis & Payment Methods ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {analyticsData?.returnAnalysis?.length > 0 && (
          <SectionCard title="Return Analysis by Vendor" icon={RotateCcw} badge={`${analyticsData.returnAnalysis.length} vendors`}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.returnAnalysis} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="vendor" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<RichTooltip />} />
                  <Bar dataKey="returnCount" name="Returns" radius={[0, 6, 6, 0]} cursor="pointer"
                    onClick={(d) => openDrilldown(`Returns - ${d.vendor}`, `${d.returnCount} returns \u00B7 ${formatRs(d.totalReturnedAmount)} lost`, RotateCcw, { vendor: d.vendor, status: 'Returned' })}>
                    {analyticsData.returnAnalysis.map((_, i) => <Cell key={i} fill={i === 0 ? '#EF4444' : '#FCA5A5'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-50 text-xs">
              <span className="font-bold text-slate-500">Total: <span className="text-red-600 font-extrabold">{analyticsData.returnAnalysis.reduce((s, r) => s + r.returnCount, 0)}</span></span>
              <span className="font-bold text-slate-500">Lost: <span className="text-red-600 font-extrabold">{formatRs(analyticsData.returnAnalysis.reduce((s, r) => s + r.totalReturnedAmount, 0))}</span></span>
            </div>
          </SectionCard>
        )}

        {analyticsData?.paymentMethods?.length > 0 && (
          <SectionCard title="Payment Methods" icon={CreditCard} badge={`${analyticsData.paymentMethods.length} methods`}>
            <div className="space-y-4">
              {analyticsData.paymentMethods.length > 1 && (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analyticsData.paymentMethods} cx="50%" cy="50%" outerRadius={78} innerRadius={48} paddingAngle={4} dataKey="count" nameKey="method"
                        cursor="pointer" onClick={(d) => openDrilldown(`${d.method} Orders`, `${d.count} orders \u00B7 ${formatRs(d.revenue)}`, CreditCard, { paymentMethod: d.method })}>
                        {analyticsData.paymentMethods.map((_, i) => <Cell key={i} fill={RED_GRADIENT[i % RED_GRADIENT.length]} stroke="none" />)}
                      </Pie>
                      <Tooltip content={<RichTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-2">
                {analyticsData.paymentMethods.map((pm, i) => (
                  <button key={pm.method}
                    onClick={() => openDrilldown(`${pm.method} Orders`, `${pm.count} orders \u00B7 ${formatRs(pm.revenue)}`, CreditCard, { paymentMethod: pm.method })}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-red-50/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ background: RED_GRADIENT[i % RED_GRADIENT.length] }} />
                      <span className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors">{pm.method}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400 font-medium">{pm.count} orders</span>
                      <span className="text-sm font-extrabold text-slate-900">{formatRs(pm.revenue)}</span>
                      <ChevronRight size={14} className="text-slate-200 group-hover:text-red-400 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Drill-Down Modal ────────────────────────────── */}
      {drilldown && (
        <DrilldownModal isOpen={!!drilldown} onClose={() => setDrilldown(null)}
          title={drilldown.title} subtitle={drilldown.subtitle} icon={drilldown.icon}
          filters={drilldown.filters} token={token} />
      )}
    </div>
  );
};

export default NepalcanAnalyticsPage;
