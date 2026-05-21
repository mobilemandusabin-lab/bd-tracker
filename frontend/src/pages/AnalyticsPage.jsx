import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Target, DollarSign,
  Clock, Activity as ActivityIcon, Flame, ArrowUpRight, ArrowDownRight,
  Filter, Zap, AlertTriangle, Store, Trophy, PieChart, Camera, ShoppingBag,
  User, CheckCircle2, Calendar
} from 'lucide-react';
import { API_URL } from '../config/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie
} from 'recharts';

// Lazy-loaded tab components
const BDLeaderboardPage = lazy(() => import('./BDLeaderboardPage'));
const DailyReportPage = lazy(() => import('./DailyReportPage'));
const NepalcanAnalyticsPage = lazy(() => import('./NepalcanAnalyticsPage'));
const VendorSnapshotsPage = lazy(() => import('./VendorSnapshotsPage'));

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'my-analytics', label: 'My Analytics', icon: User },
  { key: 'leaderboard', label: 'BD Leaderboard', icon: Trophy },
  { key: 'daily', label: 'Daily Report', icon: PieChart },
  { key: 'nepalcan', label: 'Nepalcan', icon: ShoppingBag },
  { key: 'vendors', label: 'Vendor Snapshots', icon: Camera },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCORE_LABELS = ['0-20', '21-40', '41-60', '61-80', '81-100'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-slate-100">
      <p className="font-bold text-sm text-slate-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: p.color || '#DC2626' }} />
          {p.name}: <span className="font-bold text-slate-900">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, subValue, trend, trendUp, color }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      )}
    </div>
    <p className="text-2xl lg:text-3xl font-extrabold text-slate-900">{value}</p>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
  </div>
);

const SectionCard = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
    <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
      {Icon && <Icon size={16} className="text-red-600" />}
      <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const TabLoading = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
    </div>
  </div>
);

const OverviewTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/analytics?period=all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [token]);

  const funnelOrder = ['New', 'Contacted', 'Interested', 'Meeting Scheduled', 'Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller'];

  const funnelData = useMemo(() => {
    if (!data?.funnel) return [];
    const map = {};
    data.funnel.forEach(f => { map[f._id] = f.count; });
    return funnelOrder.map(name => ({ name, count: map[name] || 0 })).filter(f => f.count > 0);
  }, [data]);

  const trendData = useMemo(() => {
    if (!data?.monthlyTrends) return [];
    return data.monthlyTrends.map(t => ({ month: MONTHS[t._id.month - 1], created: t.created, converted: t.converted }));
  }, [data]);

  const sourceData = useMemo(() => {
    if (!data?.sourceConversion) return [];
    return data.sourceConversion.filter(s => s._id).map(s => ({
      name: s._id, total: s.total, converted: s.converted,
      rate: s.total > 0 ? ((s.converted / s.total) * 100).toFixed(1) : 0
    }));
  }, [data]);

  const categoryData = useMemo(() => {
    if (!data?.categoryConversion) return [];
    return data.categoryConversion.filter(c => c._id).map(c => ({
      name: c._id, total: c.total, converted: c.converted,
      rate: c.total > 0 ? ((c.converted / c.total) * 100).toFixed(1) : 0
    }));
  }, [data]);

  const dropData = useMemo(() => {
    if (!data?.dropReasons) return [];
    return data.dropReasons.filter(d => d._id).map(d => ({ name: d._id, count: d.count }));
  }, [data]);

  const heatmapData = useMemo(() => {
    if (!data?.activityHeatmap) return [];
    const grid = [];
    for (let day = 1; day <= 7; day++) {
      for (let hour = 6; hour <= 22; hour++) {
        const entry = data.activityHeatmap.find(h => h._id.day === day && h._id.hour === hour);
        grid.push({ day: DAYS[day - 1], hour: `${hour}:00`, count: entry?.count || 0 });
      }
    }
    return grid;
  }, [data]);

  const maxHeatmap = useMemo(() => Math.max(...heatmapData.map(h => h.count), 1), [heatmapData]);

  const revenueData = useMemo(() => {
    if (!data?.revenueTrend) return [];
    return data.revenueTrend.map(r => ({ month: MONTHS[r._id.month - 1], revenue: r.revenue, orders: r.orders }));
  }, [data]);

  const vendorTrendData = useMemo(() => {
    if (!data?.vendorTrends) return [];
    return data.vendorTrends.map(t => ({
      month: MONTHS[t._id.month - 1], total: t.total, verified: t.verified, activeSellers: t.activeSellers
    }));
  }, [data]);

  const scoreData = useMemo(() => {
    if (!data?.scoreDistribution) return [];
    return data.scoreDistribution.map((s, i) => ({ range: SCORE_LABELS[i] || s._id, count: s.count }));
  }, [data]);

  if (loading) return <TabLoading />;
  if (!data) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <AlertTriangle size={40} className="text-slate-200 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-400">Failed to load analytics data</p>
    </div>
  );

  const { summary } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Total Leads" value={summary.totalLeads} color="bg-blue-600" />
        <MetricCard icon={Store} label="Total Vendors" value={summary.totalVendors || 0} subValue={`${summary.activeVendors || 0} active sellers`} color="bg-red-600" />
        <MetricCard icon={Target} label="Converted" value={summary.totalConverted} color="bg-emerald-600" />
        <MetricCard icon={TrendingUp} label="Conv. Rate" value={`${summary.conversionRate}%`} color="bg-purple-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={AlertTriangle} label="Lost" value={summary.totalLost} color="bg-red-600" />
        <MetricCard icon={DollarSign} label="Revenue" value={`Rs. ${summary.totalRevenue.toLocaleString()}`} subValue={`${summary.totalOrders || 0} delivered orders`} color="bg-amber-600" />
        <MetricCard icon={Clock} label="Avg Conv. Time" value={`${summary.avgConversionDays}d`} color="bg-indigo-600" />
        <MetricCard icon={Flame} label="Active Rate" value={summary.totalVendors > 0 ? `${((summary.activeVendors / summary.totalVendors) * 100).toFixed(0)}%` : '0%'} color="bg-orange-600" />
      </div>

      {funnelData.length > 0 && (
        <SectionCard title="Lead Funnel" icon={Filter}>
          <div className="space-y-2">
            {funnelData.map((stage) => {
              const maxCount = funnelData[0]?.count || 1;
              const pct = (stage.count / maxCount) * 100;
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-32 text-right truncate">{stage.name}</span>
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-lg transition-all duration-700" style={{ width: `${pct}%` }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-700">{stage.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Monthly Trends" icon={TrendingUp}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} /><stop offset="95%" stopColor="#DC2626" stopOpacity={0} /></linearGradient>
                  <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="created" name="Created" stroke="#DC2626" strokeWidth={2.5} fill="url(#createdGrad)" dot={{ fill: '#DC2626', r: 3 }} />
                <Area type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2.5} fill="url(#convGrad)" dot={{ fill: '#10B981', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Revenue Trend" icon={DollarSign}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue (Rs.)" stroke="#F59E0B" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#F59E0B', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {vendorTrendData.length > 0 && (
        <SectionCard title="Vendor Growth — Monthly Comparison" icon={Store}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorTrendData} barSize={20} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total Vendors" fill="#FEE2E2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="verified" name="Verified" fill="#DC2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="activeSellers" name="Active Sellers" fill="#991B1B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Conversion by Source" icon={Zap}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" fill="#FEE2E2" radius={[0, 4, 4, 0]} />
                <Bar dataKey="converted" name="Converted" fill="#DC2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Conversion by Category" icon={BarChart3}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" fill="#DBEAFE" radius={[0, 4, 4, 0]} />
                <Bar dataKey="converted" name="Converted" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Drop Reasons" icon={AlertTriangle}>
          {dropData.length > 0 ? (
            <div className="space-y-3">
              {dropData.map((d) => {
                const maxDrop = dropData[0]?.count || 1;
                const pct = (d.count / maxDrop) * 100;
                return (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 truncate mr-2">{d.name}</span>
                      <span className="font-extrabold text-red-600 shrink-0">{d.count}</span>
                    </div>
                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-slate-400 text-center py-8">No drop data</p>}
        </SectionCard>

        <SectionCard title="Lead Score Distribution" icon={Flame}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Leads" radius={[6, 6, 0, 0]}>
                  {scoreData.map((_, i) => <Cell key={i} fill={['#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#059669'][i] || '#DC2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Activity Heatmap" icon={ActivityIcon}>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(d => <div key={d} className="text-[9px] font-bold text-slate-400 text-center uppercase">{d}</div>)}
            {heatmapData.map((cell, i) => {
              const intensity = cell.count / maxHeatmap;
              return (
                <div key={i} className="aspect-square rounded-md flex items-center justify-center text-[11px] font-extrabold transition-colors"
                  style={{ backgroundColor: intensity > 0 ? `rgba(220, 38, 38, ${0.1 + intensity * 0.7})` : '#f8fafc', color: intensity > 0.5 ? 'white' : intensity > 0 ? '#DC2626' : '#cbd5e1' }}
                  title={`${cell.day} ${cell.hour}: ${cell.count} activities`}>
                  {cell.count > 0 ? cell.count : ''}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[9px] text-slate-400 font-bold">Less</span>
            {[0.1, 0.3, 0.5, 0.8].map(v => <div key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(220, 38, 38, ${v})` }} />)}
            <span className="text-[9px] text-slate-400 font-bold">More</span>
          </div>
        </SectionCard>
      </div>

      {/* Goal vs Achieved (Admin only) */}
      {(user?.role === 'super_admin' || user?.role === 'admin') && data.goals?.length > 0 && (
        <SectionCard title="Goal vs Achieved — All Users" icon={Target}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.goals.map((goal) => {
              const unitIcons = { leads: Users, conversions: CheckCircle2, revenue: DollarSign, activated_vendors: Store, activities: ActivityIcon, calls: ActivityIcon };
              const UnitIcon = unitIcons[goal.unit] || Target;
              const unitLabels = { leads: 'Leads', conversions: 'Conversions', revenue: 'Revenue', activated_vendors: 'Activated Vendors', activities: 'Activities', calls: 'Calls' };
              const formatValue = (val) => goal.unit === 'revenue' ? `Rs. ${val.toLocaleString()}` : val.toLocaleString();
              return (
                <div key={goal._id} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${goal.progress >= 100 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <UnitIcon size={16} className={goal.progress >= 100 ? 'text-emerald-600' : 'text-red-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{goal.title}</h4>
                      <p className="text-[10px] text-slate-400">{goal.assigned_to?.name || 'Unknown'} · {goal.period} · {unitLabels[goal.unit] || goal.unit}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${goal.progress >= 100 ? 'bg-emerald-100 text-emerald-700' : goal.progress >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Achieved</p>
                      <p className="text-lg font-extrabold text-slate-900">{formatValue(goal.currentValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Target</p>
                      <p className="text-sm font-bold text-slate-500">{formatValue(goal.target_value)}</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-white rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all duration-700 ${goal.progress >= 100 ? 'bg-emerald-500' : goal.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">{formatValue(goal.remaining)} remaining</span>
                    {goal.end_date && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        Due: {new Date(goal.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

const MyAnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [selectedStage, setSelectedStage] = useState(null);
  const [stageLeads, setStageLeads] = useState([]);
  const [stageLoading, setStageLoading] = useState(false);
  const token = useSelector((state) => state.auth.token);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const fetchMyAnalytics = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/my-analytics?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.data);
      } catch (err) {
        console.error('Error fetching my analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyAnalytics();
  }, [token, period]);

  const funnelOrder = ['New', 'Contacted', 'Interested', 'Meeting Scheduled', 'Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller'];

  const funnelData = useMemo(() => {
    if (!data?.funnel) return [];
    const map = {};
    data.funnel.forEach(f => { map[f._id] = f.count; });
    return funnelOrder.map(name => ({ name, count: map[name] || 0 })).filter(f => f.count > 0);
  }, [data]);

  const trendData = useMemo(() => {
    if (!data?.monthlyTrends) return [];
    return data.monthlyTrends.map(t => ({ month: MONTHS[t._id.month - 1], created: t.created, converted: t.converted }));
  }, [data]);

  const revenueTrendData = useMemo(() => {
    if (!data?.revenueTrend) return [];
    return data.revenueTrend.map(r => ({ month: MONTHS[r._id.month - 1], revenue: r.revenue, orders: r.orders }));
  }, [data]);

  const fetchStageLeads = async (stageName) => {
    setSelectedStage(stageName);
    setStageLoading(true);
    try {
      const params = new URLSearchParams({ type: 'lead', lead_status: stageName, limit: '50' });
      const res = await axios.get(`${API_URL}/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStageLeads(res.data.data?.leads || res.data.data || []);
    } catch (err) {
      console.error('Error fetching stage leads:', err);
      setStageLeads([]);
    } finally {
      setStageLoading(false);
    }
  };

  const heatmapData = useMemo(() => {
    if (!data?.activityHeatmap) return [];
    const grid = [];
    for (let day = 1; day <= 7; day++) {
      for (let hour = 6; hour <= 22; hour++) {
        const entry = data.activityHeatmap.find(h => h._id.day === day && h._id.hour === hour);
        grid.push({ day: DAYS[day - 1], hour: `${hour}:00`, count: entry?.count || 0 });
      }
    }
    return grid;
  }, [data]);

  const maxHeatmap = useMemo(() => Math.max(...heatmapData.map(h => h.count), 1), [heatmapData]);

  if (loading) return <TabLoading />;
  if (!data) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
      <AlertTriangle size={40} className="text-slate-200 mx-auto mb-3" />
      <p className="text-sm font-bold text-slate-400">Failed to load your analytics</p>
    </div>
  );

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center gap-2">
        {['all', '30d', '90d', '6m', '1y'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all
              ${period === p ? 'bg-red-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300'}`}>
            {p === 'all' ? 'All Time' : p}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="My Leads" value={summary.totalLeads} color="bg-blue-600" />
        <MetricCard icon={CheckCircle2} label="Converted" value={summary.totalConverted} color="bg-emerald-600" />
        <MetricCard icon={TrendingUp} label="Conv. Rate" value={`${summary.conversionRate}%`} color="bg-purple-600" />
        <MetricCard icon={DollarSign} label="Revenue" value={`Rs. ${summary.totalRevenue.toLocaleString()}`} subValue={`${summary.totalOrders} delivered orders`} color="bg-amber-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={AlertTriangle} label="Lost" value={summary.totalLost} color="bg-red-600" />
        <MetricCard icon={Clock} label="Avg Conv. Time" value={`${summary.avgConversionDays}d`} color="bg-indigo-600" />
        <MetricCard icon={ActivityIcon} label="Activities" value={summary.totalActivities} color="bg-orange-600" />
        <MetricCard icon={Target} label="Active Goals" value={data.goals?.length || 0} color="bg-teal-600" />
      </div>

      {/* Goal vs Achieved */}
      {data.goals?.length > 0 && (
        <SectionCard title="Goal vs Achieved" icon={Target}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.goals.map((goal) => {
              const unitIcons = { leads: Users, conversions: CheckCircle2, revenue: DollarSign, activated_vendors: Store, activities: ActivityIcon, calls: ActivityIcon };
              const UnitIcon = unitIcons[goal.unit] || Target;
              const unitLabels = { leads: 'Leads', conversions: 'Conversions', revenue: 'Revenue', activated_vendors: 'Activated Vendors', activities: 'Activities', calls: 'Calls' };
              const formatValue = (val) => goal.unit === 'revenue' ? `Rs. ${val.toLocaleString()}` : val.toLocaleString();
              return (
                <div key={goal._id} className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${goal.progress >= 100 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <UnitIcon size={16} className={goal.progress >= 100 ? 'text-emerald-600' : 'text-red-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{goal.title}</h4>
                      <p className="text-[10px] text-slate-400 capitalize">{goal.period} · {unitLabels[goal.unit] || goal.unit} · {goal.priority}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${goal.progress >= 100 ? 'bg-emerald-100 text-emerald-700' : goal.progress >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Achieved</p>
                      <p className="text-lg font-extrabold text-slate-900">{formatValue(goal.currentValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Target</p>
                      <p className="text-sm font-bold text-slate-500">{formatValue(goal.target_value)}</p>
                    </div>
                  </div>
                  <div className="h-2.5 bg-white rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all duration-700 ${goal.progress >= 100 ? 'bg-emerald-500' : goal.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400">{formatValue(goal.remaining)} remaining</span>
                    {goal.end_date && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        Due: {new Date(goal.end_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Lead Funnel */}
      {funnelData.length > 0 && (
        <SectionCard title="My Lead Funnel" icon={Filter}>
          <div className="space-y-2">
            {funnelData.map((stage) => {
              const maxCount = funnelData[0]?.count || 1;
              const pct = (stage.count / maxCount) * 100;
              return (
                <button key={stage.name} onClick={() => fetchStageLeads(stage.name)}
                  className="w-full flex items-center gap-3 group">
                  <span className="text-xs font-bold text-slate-500 w-32 text-right truncate group-hover:text-red-600 transition-colors">{stage.name}</span>
                  <div className="flex-1 h-8 bg-slate-50 rounded-lg overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-lg transition-all duration-700" style={{ width: `${pct}%` }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-700">{stage.count}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-300 mt-3 text-center">Click any stage to see leads</p>
        </SectionCard>
      )}

      {/* Stage Leads Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedStage(null); setStageLeads([]); }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{selectedStage}</h3>
                <p className="text-[10px] text-slate-400">{stageLeads.length} leads in this stage</p>
              </div>
              <button onClick={() => { setSelectedStage(null); setStageLeads([]); }} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {stageLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : stageLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No leads in this stage</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div key={lead._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-red-50/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{lead.business_name || lead.name}</p>
                        <p className="text-[10px] text-slate-400">{lead.email || lead.phone || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          lead.lead_status === 'Active Seller' ? 'bg-emerald-100 text-emerald-700' :
                          lead.lead_status === 'Activated' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{lead.lead_status}</span>
                        {lead.lead_source && <span className="text-[10px] text-slate-400">{lead.lead_source}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="My Monthly Trends" icon={TrendingUp}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="myCreatedGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} /><stop offset="95%" stopColor="#DC2626" stopOpacity={0} /></linearGradient>
                  <linearGradient id="myConvGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="created" name="Created" stroke="#DC2626" strokeWidth={2.5} fill="url(#myCreatedGrad)" dot={{ fill: '#DC2626', r: 3 }} />
                <Area type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2.5} fill="url(#myConvGrad)" dot={{ fill: '#10B981', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="My Revenue Trend" icon={DollarSign}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="myRevGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue (Rs.)" stroke="#F59E0B" strokeWidth={2.5} fill="url(#myRevGrad)" dot={{ fill: '#F59E0B', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Activity Heatmap */}
      <SectionCard title="My Activity Heatmap" icon={ActivityIcon}>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map(d => <div key={d} className="text-[9px] font-bold text-slate-400 text-center uppercase">{d}</div>)}
          {heatmapData.map((cell, i) => {
            const intensity = cell.count / maxHeatmap;
            return (
              <div key={i} className="aspect-square rounded-md flex items-center justify-center text-[11px] font-extrabold transition-colors"
                style={{ backgroundColor: intensity > 0 ? `rgba(220, 38, 38, ${0.1 + intensity * 0.7})` : '#f8fafc', color: intensity > 0.5 ? 'white' : intensity > 0 ? '#DC2626' : '#cbd5e1' }}
                title={`${cell.day} ${cell.hour}: ${cell.count} activities`}>
                {cell.count > 0 ? cell.count : ''}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-[9px] text-slate-400 font-bold">Less</span>
          {[0.1, 0.3, 0.5, 0.8].map(v => <div key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(220, 38, 38, ${v})` }} />)}
          <span className="text-[9px] text-slate-400 font-bold">More</span>
        </div>
      </SectionCard>
    </div>
  );
};

const AnalyticsPage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TABS.find(t => t.key === hash)?.key || 'overview';
  });

  const handleTabChange = (key) => {
    setActiveTab(key);
    window.location.hash = key;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Intelligence</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">All analytics & reports in one place</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl whitespace-nowrap transition-all
                ${activeTab === tab.key
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600'}`}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'my-analytics' && <MyAnalyticsTab />}
      {activeTab !== 'overview' && activeTab !== 'my-analytics' && (
        <Suspense fallback={<TabLoading />}>
          {activeTab === 'leaderboard' && <BDLeaderboardPage embedded />}
          {activeTab === 'daily' && <DailyReportPage embedded />}
          {activeTab === 'nepalcan' && <NepalcanAnalyticsPage embedded />}
          {activeTab === 'vendors' && <VendorSnapshotsPage embedded />}
        </Suspense>
      )}
    </div>
  );
};

export default AnalyticsPage;
