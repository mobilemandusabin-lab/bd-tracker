import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import {
  Users,
  UserCheck,
  ClipboardList,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Target,
  ShoppingBag,
  RefreshCw,
  Calendar,
  BarChart3,
  Shield,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Store,
  ShieldCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { API_URL } from '../config/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700">
      <p className="font-bold text-xs mb-1 uppercase tracking-wider">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-bold text-white">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, trend, color }) => {
  const colorMap = {
    red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-600', border: 'border-red-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-600', border: 'border-emerald-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-600', border: 'border-blue-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-600', border: 'border-amber-100' },
  };
  const c = colorMap[color] || colorMap.red;

  return (
    <div className={`bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 ${c.icon} rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
            <ArrowUpRight size={10} /> {trend}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-1">{value}</h3>
    </div>
  );
};

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [serverSyncing, setServerSyncing] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const [syncResult, setSyncResult] = useState(null);
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => { syncingRef.current = syncing; }, [syncing]);

  const { token, user } = useSelector((state) => state.auth);

  const fetchSyncStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/sync-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data;
      setServerSyncing(data.syncing);
      if (data.syncing) {
        setSyncing(true);
        const started = new Date(data.runningSince).getTime();
        setSyncElapsed(Math.floor((Date.now() - started) / 1000));
        return true;
      }
      if (syncingRef.current) {
        setSyncing(false);
        setServerSyncing(false);
        setSyncElapsed(0);
        fetchSyncLogs();
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_URL}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(() => {
      setSyncElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [syncing]);

  const handleFullSync = async () => {
    if (!window.confirm('Run full system sync? This includes Nepalcan orders, vendors, service branches, return checks, and vendor snapshots.')) return;

    setSyncing(true);
    setSyncResult(null);

    try {
      await axios.post(`${API_URL}/dashboard/sync-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let poll = 0;
      const checkDone = setInterval(async () => {
        poll++;
        const stillRunning = await fetchSyncStatus();
        if (!stillRunning || poll > 120) {
          clearInterval(checkDone);
        }
      }, 3000);
    } catch (err) {
      setSyncResult({ success: false, errorMessage: err.response?.data?.message || err.message });
      setSyncing(false);
    }
  };

  const fetchSyncLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_URL}/dashboard/sync-logs?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncLogs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-red-100 rounded-full" />
        <div className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Dashboard</p>
    </div>
  );

  const RED_GRADIENT = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

  return (
    <div className="space-y-6 lg:space-y-8 max-w-[1600px] mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-2xl lg:rounded-3xl p-6 lg:p-8">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-1 bg-white/40 rounded-full" />
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Real-time Intelligence</span>
            </div>
            <h1 className="text-2xl lg:text-4xl font-black text-white tracking-tight">Executive Dashboard</h1>
            <p className="text-sm text-white/60 mt-1 font-medium">
              <Calendar size={14} className="inline mr-1" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/analytics"
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
            >
              <BarChart3 size={14} /> Analytics
            </Link>
            {stats.__userRole === 'super_admin' && (
              <>
                <Link
                  to="/nepalcan-sales"
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
                >
                  <ShoppingBag size={14} /> Sales
                </Link>
<button
  onClick={handleFullSync}
  disabled={syncing}
  className="flex items-center gap-2 px-4 py-2.5 bg-white text-red-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-red-50 transition-all shadow-lg disabled:opacity-50"
>
  {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
  {syncing ? `Syncing ${syncElapsed}s` : 'Sync All'}
</button>
                <button
                  onClick={() => { setShowSyncLog(!showSyncLog); if (!showSyncLog) fetchSyncLogs(); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
                >
                  {showSyncLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Log
                </button>
              </>
            )}
          </div>
        </div>
        {(syncResult || syncing) && (
          <div className="relative mt-4 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              {syncing ? (
                <Loader2 size={14} className="animate-spin text-amber-300" />
              ) : syncResult?.success ? (
                <CheckCircle2 size={14} className="text-emerald-300" />
              ) : (
                <XCircle size={14} className="text-red-300" />
              )}
              <p className="text-xs font-bold text-white">
                {syncing ? `Sync in progress (${syncElapsed}s)` : syncResult?.success ? 'Sync completed' : 'Sync completed with errors'}
                {!syncing && syncResult?.durationMs ? ` (${(syncResult.durationMs / 1000).toFixed(1)}s)` : ''}
              </p>
            </div>
            {syncResult?.tasks && (
              <div className="flex flex-wrap gap-3 text-[10px] font-bold text-white/80">
                {syncResult.tasks.nepalcanOrders?.ran && (
                  <span className={syncResult.tasks.nepalcanOrders.success === false ? 'text-red-300' : ''}>
                    Orders: {syncResult.tasks.nepalcanOrders.ordersSynced ?? '-'}
                  </span>
                )}
                {syncResult.tasks.vendorSync?.ran && (
                  <span className={syncResult.tasks.vendorSync.success === false ? 'text-red-300' : ''}>
                    Vendors: {syncResult.tasks.vendorSync.vendorsSynced ?? '-'}
                    {syncResult.tasks.vendorSync.vendorsCreated > 0 && ` (+${syncResult.tasks.vendorSync.vendorsCreated} new)`}
                  </span>
                )}
                {syncResult.tasks.returnedCheck?.ran && (
                  <span>Returns: {syncResult.tasks.returnedCheck.ordersUpdated ?? 0}</span>
                )}
                {syncResult.tasks.vendorSnapshots?.ran && (
                  <span>Snapshots: {syncResult.tasks.vendorSnapshots.snapshotsTaken ?? 0}</span>
                )}
                {syncResult.tasks.overdueCheck?.ran && (
                  <span>Overdue: {syncResult.tasks.overdueCheck?.result?.overdueCount ?? 0}</span>
                )}
              </div>
            )}
          </div>
        )}
        {showSyncLog && syncLogs.length > 0 && (
          <div className="relative mt-3 bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-white/10">
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Recent Sync History</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {syncLogs.map((log, i) => (
                <div key={log._id || i} className="px-4 py-2 border-b border-white/5 last:border-0 hover:bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'running' ? (
                        <Loader2 size={10} className="animate-spin text-amber-300" />
                      ) : log.success ? (
                        <CheckCircle2 size={10} className="text-emerald-300" />
                      ) : (
                        <XCircle size={10} className="text-red-300" />
                      )}
                      <span className="text-[10px] font-bold text-white">
                        {log.triggeredBy === 'manual' ? 'Manual' : log.triggeredBy === 'cron' ? 'Scheduled' : 'Startup'}
                        {log.userId?.name && ` by ${log.userId.name}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/50">
                      {new Date(log.createdAt).toLocaleString()} · {(log.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {log.tasks && (log.tasks.nepalcanOrders?.ran || log.tasks.vendorSync?.ran) && (
                    <div className="flex flex-wrap gap-2 mt-1 ml-4">
                      {log.tasks.nepalcanOrders?.ran && (
                        <span className="text-[9px] text-white/40">
                          Orders: {log.tasks.nepalcanOrders.ordersSynced ?? '-'}
                        </span>
                      )}
                      {log.tasks.vendorSync?.ran && (
                        <span className="text-[9px] text-white/40">
                          Vendors: {log.tasks.vendorSync.vendorsSynced ?? '-'}
                          {log.tasks.vendorSync.vendorsCreated > 0 && ` (${log.tasks.vendorSync.vendorsCreated} new)`}
                        </span>
                      )}
                      {log.tasks.vendorSnapshots?.ran && (
                        <span className="text-[9px] text-white/40">
                          Snapshots: {log.tasks.vendorSnapshots.snapshotsTaken}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5">
        <StatCard title="Total Leads" value={stats.summary.totalLeads} icon={Users} color="red" trend="12.5%" />
        <StatCard title="Total Vendors" value={stats.summary.totalVendors ?? 0} icon={Store} color="blue" />
        <StatCard title="Verified Vendors" value={stats.summary.verifiedVendors ?? 0} icon={ShieldCheck} color="emerald" />
        <StatCard title="Active Sellers" value={stats.summary.activeSellers} icon={UserCheck} color="green" trend="8.2%" />
        <StatCard title="Pending Tasks" value={stats.summary.pendingTasks} icon={ClipboardList} color="blue" trend="24.1%" />
        <StatCard title="Pending Follow-ups" value={stats.summary.pendingFollowups} icon={Clock} color="amber" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bar Chart */}
        <div className="lg:col-span-8 bg-white p-5 lg:p-7 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-red-600 rounded-full" />
              <h3 className="text-base font-black text-slate-900">Lead Pipeline</h3>
            </div>
            <select className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 outline-none focus:ring-2 focus:ring-red-100">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="h-[250px] lg:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.leadStats} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(220,38,38,0.04)'}} />
                <Bar dataKey="count" name="Leads" radius={[8, 8, 0, 0]}>
                  {stats.leadStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RED_GRADIENT[index % RED_GRADIENT.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="lg:col-span-4 bg-white p-5 lg:p-7 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <h3 className="text-base font-black text-slate-900">Segments</h3>
          </div>
          <div className="h-[200px] lg:h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.onboardingStats}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={6}
                  dataKey="count"
                  nameKey="_id"
                >
                  {stats.onboardingStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RED_GRADIENT[index % RED_GRADIENT.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2.5">
            {stats.onboardingStats.slice(0, 5).map((cat, idx) => (
              <div key={cat._id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: RED_GRADIENT[idx % RED_GRADIENT.length]}} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cat._id}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
