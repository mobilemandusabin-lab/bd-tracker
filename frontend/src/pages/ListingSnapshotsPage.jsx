import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Package, ListChecks, FileText, Calendar, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, AlertCircle, Camera, Clock, Target, Save, CheckCircle2 } from 'lucide-react';
import { formatNepaliDate } from '../utils/nepaliDate';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

function formatCountdown(ms) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function CountdownDisplay({ targetDate, label, light }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = new Date(targetDate).getTime() - now;
  const { days, hours, minutes, seconds } = formatCountdown(msLeft);
  const isDue = msLeft <= 3600000 && msLeft > 0;

  const colorClass = light
    ? (isDue ? 'text-yellow-200' : 'text-red-100')
    : (isDue ? 'text-amber-600' : 'text-slate-400');

  return (
    <div className={`flex items-center gap-1.5 ${colorClass}`}>
      <Clock size={11} />
      <span className="text-[10px] font-semibold">{label}:</span>
      <span className="text-[11px] font-bold tabular-nums">
        {days > 0 ? `${days}d ` : ''}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

const DeltaBadge = ({ delta, percent }) => {
  if (delta === 0) return <span className="text-xs text-slate-300 font-medium">-</span>;
  const isPositive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {isPositive ? '+' : ''}{delta} ({isPositive ? '+' : ''}{percent}%)
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg">
      <p className="text-xs font-bold text-slate-900 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-bold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ListingSnapshotsPage({ embedded }) {
  const [snapshots, setSnapshots] = useState([]);
  const [latestSnapshots, setLatestSnapshots] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [nextSchedule, setNextSchedule] = useState({ weekly: null, monthly: null });
  const [snapshotType, setSnapshotType] = useState('weekly');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [targetInputs, setTargetInputs] = useState({
    totalListings: '',
    dailyAverageListings: '',
    totalSpecificationsAdded: ''
  });

  const [period, setPeriod] = useState('7d');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotsRes, latestRes, compareRes, scheduleRes] = await Promise.all([
        axios.get(`${API_URL}/listing-snapshots?type=${snapshotType}&limit=24`, { headers }),
        axios.get(`${API_URL}/listing-snapshots/latest`, { headers }),
        axios.get(`${API_URL}/listing-snapshots/compare?type=${snapshotType}&count=12`, { headers }),
        axios.get(`${API_URL}/listing-snapshots/next-schedule`, { headers })
      ]);
      setSnapshots(snapshotsRes.data.data.snapshots);
      setLatestSnapshots(latestRes.data.data);
      setComparisonData(compareRes.data.data.snapshots);
      setNextSchedule(scheduleRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }

    try {
      let liveUrl = `${API_URL}/listing-snapshots/live`;
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (periodStartDate) params.set('start_date', periodStartDate);
      if (periodEndDate) params.set('end_date', periodEndDate);
      const qs = params.toString();
      if (qs) liveUrl += '?' + qs;
      const liveRes = await axios.get(liveUrl, { headers });
      setLiveData(liveRes.data.data);
    } catch {
      console.warn('[ListingSnapshots] Failed to fetch live data, falling back to snapshot');
    }
  }, [snapshotType, period, periodStartDate, periodEndDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const latest = latestSnapshots?.[snapshotType];
    if (latest?.targets) {
      setTargetInputs({
        totalListings: latest.targets.totalListings?.toString() || '',
        dailyAverageListings: latest.targets.dailyAverageListings?.toString() || '',
        totalSpecificationsAdded: latest.targets.totalSpecificationsAdded?.toString() || ''
      });
    }
  }, [latestSnapshots, snapshotType]);

  const handleSaveTargets = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const targets = {
        totalListings: parseInt(targetInputs.totalListings) || null,
        dailyAverageListings: parseInt(targetInputs.dailyAverageListings) || null,
        totalSpecificationsAdded: parseInt(targetInputs.totalSpecificationsAdded) || null
      };
      await axios.patch(`${API_URL}/listing-snapshots/targets`, { type: snapshotType, targets }, { headers });
      setSaveSuccess(true);
      await fetchData();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save targets');
    } finally {
      setSaving(false);
    }
  };

  const latest = latestSnapshots?.[snapshotType];

  const chartData = useMemo(() => {
    return [...comparisonData].reverse().map(s => ({
      name: s.nepaliDate,
      'Marketplace Products': s.totalMarketplaceProducts,
      'Verified Only': s.verifiedMarketplaceProducts,
      'Total Listings': s.totalListings,
      'Daily Avg Listings': s.dailyAverageListings,
      'Specs Added': s.totalSpecificationsAdded
    }));
  }, [comparisonData]);

  const metricConfig = [
    { key: 'totalMarketplaceProducts', label: 'Marketplace Products', icon: Package, color: 'red' },
    { key: 'verifiedMarketplaceProducts', label: 'Marketplace Products (Verified Only)', icon: Package, color: 'purple' },
    { key: 'totalListings', label: 'Total Listings', icon: Package, color: 'orange' },
    { key: 'dailyAverageListings', label: 'Daily Avg Listings', icon: ListChecks, color: 'amber' },
    { key: 'totalSpecificationsAdded', label: 'Specs Added', icon: FileText, color: 'emerald' }
  ];

  const targetMetrics = [
    { key: 'totalListings', label: 'Total Listings', icon: Package, color: 'orange' },
    { key: 'dailyAverageListings', label: 'Daily Avg Listings', icon: ListChecks, color: 'amber' },
    { key: 'totalSpecificationsAdded', label: 'Specs Added', icon: FileText, color: 'emerald' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="text-red-500 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading snapshots...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 lg:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <ListChecks size={20} className="text-white/80" />
                  <h1 className="text-xl lg:text-2xl font-extrabold text-white">Listing Snapshots</h1>
                </div>
                <p className="text-red-200 text-xs font-medium">
                  Weekly and monthly listing metrics
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {nextSchedule.weekly?.targetDate && (
                    <CountdownDisplay targetDate={nextSchedule.weekly.targetDate} label="Auto weekly" light />
                  )}
                  {nextSchedule.monthly?.targetDate && (
                    <CountdownDisplay targetDate={nextSchedule.monthly.targetDate} label="Auto monthly" light />
                  )}
                </div>
                {latest && (
                  <p className="text-red-100 text-[11px] font-semibold mt-1.5">
                    Latest: {latest.nepaliDate} ({snapshotType})
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {['weekly', 'monthly'].map(t => (
                  <button key={t} onClick={() => setSnapshotType(t)}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all
                      ${snapshotType === t ? 'bg-white text-red-700 shadow-sm' : 'bg-white/15 text-white/80 hover:bg-white/25'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['weekly', 'monthly'].map(t => (
              <button key={t} onClick={() => setSnapshotType(t)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all
                  ${snapshotType === t ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {nextSchedule.weekly?.targetDate && (
              <CountdownDisplay targetDate={nextSchedule.weekly.targetDate} label="Auto weekly" />
            )}
            {nextSchedule.monthly?.targetDate && (
              <CountdownDisplay targetDate={nextSchedule.monthly.targetDate} label="Auto monthly" />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'targets', label: 'Targets' },
          { id: 'comparison', label: 'Comparison' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {metricConfig.map(({ key, label, icon: Icon, color }) => {
              const snap = latest?.[key];
              const bgMap = { red: 'bg-red-50', amber: 'bg-amber-50', emerald: 'bg-emerald-50', orange: 'bg-orange-50', purple: 'bg-purple-50' };
              const textMap = { red: 'text-red-600', amber: 'text-amber-600', emerald: 'text-emerald-600', orange: 'text-orange-600', purple: 'text-purple-600' };
              return (
                <div key={key} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className={`${bgMap[color]} p-2 rounded-xl`}>
                      <Icon size={16} className={textMap[color]} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">{snap ?? '-'}</p>
                </div>
              );
            })}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <Calendar size={16} className="text-slate-500" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Snapshot</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900">{latest ? formatNepaliDate(latest.snapshotDate) : '-'}</p>
              {latest && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(latest.snapshotDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                {snapshotType === 'weekly' ? 'Weekly' : 'Monthly'} Trends
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333EA" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="saGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(value) => <span className="text-[11px] font-semibold text-slate-600">{value}</span>} />
                  <Area type="monotone" dataKey="Marketplace Products" stroke="#DC2626" fill="url(#mpGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Verified Only" stroke="#9333EA" fill="url(#vpGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Total Listings" stroke="#F97316" fill="url(#tlGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Daily Avg Listings" stroke="#F59E0B" fill="url(#dalGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Specs Added" stroke="#10B981" fill="url(#saGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === 'targets' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 lg:p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="bg-red-50 p-2 rounded-xl">
                <Target size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Set {snapshotType === 'weekly' ? 'Weekly' : 'Monthly'} Targets</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Goals to achieve by the next {snapshotType} snapshot</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
              {targetMetrics.map(({ key, label, icon: Icon, color }) => {
                const current = liveData?.[key] ?? 0;
                const target = latest?.targets?.[key];
                const bgMap = { orange: 'bg-orange-50 border-orange-100', amber: 'bg-amber-50 border-amber-100', emerald: 'bg-emerald-50 border-emerald-100' };
                const textMap = { orange: 'text-orange-600', amber: 'text-amber-600', emerald: 'text-emerald-600' };
                const ringMap = { orange: 'focus:ring-orange-200 focus:border-orange-300', amber: 'focus:ring-amber-200 focus:border-amber-300', emerald: 'focus:ring-emerald-200 focus:border-emerald-300' };
                return (
                  <div key={key} className={`rounded-xl border p-4 ${bgMap[color]}`}>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
                      <Icon size={14} className={textMap[color]} />
                      {label}
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Current: <span className="font-bold text-slate-700">{current}</span>
                      {target != null && target > 0 && (
                        <span className="ml-1.5">
                          <span className="text-slate-400">|</span>
                          {' '}Target: <span className="font-bold text-slate-700">{target}</span>
                          {' '}
                          <span className="text-slate-400">|</span>
                          {' '}
                          {current >= target
                            ? <span className="text-emerald-600 font-semibold">✓ Met</span>
                            : <span className="text-red-500 font-semibold">({target - current} to go)</span>
                          }
                        </span>
                      )}
                    </p>
                    <input
                      type="number"
                      value={targetInputs[key]}
                      onChange={e => setTargetInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Set target"
                      className={`w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 ${ringMap[color]} transition-all`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                {latest ? `Last snapshot: ${latest.nepaliDate}` : 'No snapshots yet'}
              </p>
              <button
                onClick={handleSaveTargets}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  saveSuccess
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                }`}
              >
                {saveSuccess ? (
                  <><CheckCircle2 size={15} /> Saved</>
                ) : saving ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving...</>
                ) : (
                  <><Save size={15} /> Save Targets</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Period</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Marketplace Products</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified Only</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Listings</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Daily Avg Listings</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Specs Added</th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Targets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {comparisonData.map((snap, i) => {
                  const t = snap.targets || {};
                  const hasTargets = t.totalListings || t.dailyAverageListings || t.totalSpecificationsAdded;
                  return (
                  <tr key={snap._id} className={i === 0 ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{snap.nepaliDate}</span>
                        <span className="text-[10px] text-slate-400">{new Date(snap.snapshotDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        {snap.prevNepaliDate && (
                          <span className="text-[10px] text-slate-400 mt-1">vs {snap.prevNepaliDate} ({new Date(snap.prevSnapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end">
                        {snap.prevTotalMarketplaceProducts != null && (
                          <span className="text-xs text-slate-400">{snap.prevTotalMarketplaceProducts}</span>
                        )}
                        <span className="text-sm font-extrabold text-slate-900">{snap.totalMarketplaceProducts}</span>
                        <DeltaBadge delta={snap.totalMarketplaceProductsDelta} percent={snap.totalMarketplaceProductsPercentChange} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end">
                        {snap.prevVerifiedMarketplaceProducts != null && (
                          <span className="text-xs text-slate-400">{snap.prevVerifiedMarketplaceProducts}</span>
                        )}
                        <span className="text-sm font-extrabold text-slate-900">{snap.verifiedMarketplaceProducts}</span>
                        <DeltaBadge delta={snap.verifiedMarketplaceProductsDelta} percent={snap.verifiedMarketplaceProductsPercentChange} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end">
                        {snap.prevTotalListings != null && (
                          <span className="text-xs text-slate-400">{snap.prevTotalListings}</span>
                        )}
                        <span className="text-sm font-extrabold text-slate-900">{snap.totalListings}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end">
                        {snap.prevDailyAverageListings != null && (
                          <span className="text-xs text-slate-400">{snap.prevDailyAverageListings}</span>
                        )}
                        <span className="text-sm font-extrabold text-slate-900">{snap.dailyAverageListings}</span>
                        <DeltaBadge delta={snap.dailyAverageListingsDelta} percent={snap.dailyAverageListingsPercentChange} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end">
                        {snap.prevTotalSpecificationsAdded != null && (
                          <span className="text-xs text-slate-400">{snap.prevTotalSpecificationsAdded}</span>
                        )}
                        <span className="text-sm font-extrabold text-slate-900">{snap.totalSpecificationsAdded}</span>
                        <DeltaBadge delta={snap.totalSpecificationsAddedDelta} percent={snap.totalSpecificationsAddedPercentChange} />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {hasTargets ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {t.totalListings && (
                            <span className="text-[10px] text-slate-500">
                              <span className="font-semibold">L:</span> {t.totalListings}
                              {snap.totalListings >= t.totalListings
                                ? <span className="text-emerald-600 ml-1">✓</span>
                                : <span className="text-red-500 ml-1">({snap.totalListings - t.totalListings})</span>
                              }
                            </span>
                          )}
                          {t.dailyAverageListings && (
                            <span className="text-[10px] text-slate-500">
                              <span className="font-semibold">D:</span> {t.dailyAverageListings}
                              {snap.dailyAverageListings >= t.dailyAverageListings
                                ? <span className="text-emerald-600 ml-1">✓</span>
                                : <span className="text-red-500 ml-1">({snap.dailyAverageListings - t.dailyAverageListings})</span>
                              }
                            </span>
                          )}
                          {t.totalSpecificationsAdded && (
                            <span className="text-[10px] text-slate-500">
                              <span className="font-semibold">S:</span> {t.totalSpecificationsAdded}
                              {snap.totalSpecificationsAdded >= t.totalSpecificationsAdded
                                ? <span className="text-emerald-600 ml-1">✓</span>
                                : <span className="text-red-500 ml-1">({snap.totalSpecificationsAdded - t.totalSpecificationsAdded})</span>
                              }
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {comparisonData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <ListChecks size={36} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-sm font-bold text-slate-400">No snapshot data yet</p>
                      <p className="text-xs text-slate-400 mt-1">Snapshots are taken every Friday</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-slate-50">
            {comparisonData.map((snap) => {
              const t = snap.targets || {};
              return (
              <div key={snap._id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-900">{snap.nepaliDate}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{new Date(snap.snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  {snap.prevNepaliDate && (
                    <span className="text-[10px] text-slate-400">vs {snap.prevNepaliDate}</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Products', curr: snap.totalMarketplaceProducts, prev: snap.prevTotalMarketplaceProducts, delta: snap.totalMarketplaceProductsDelta, pct: snap.totalMarketplaceProductsPercentChange },
                    { label: 'Verified', curr: snap.verifiedMarketplaceProducts, prev: snap.prevVerifiedMarketplaceProducts, delta: snap.verifiedMarketplaceProductsDelta, pct: snap.verifiedMarketplaceProductsPercentChange },
                    { label: 'Daily Avg', curr: snap.dailyAverageListings, prev: snap.prevDailyAverageListings, delta: snap.dailyAverageListingsDelta, pct: snap.dailyAverageListingsPercentChange, target: t.dailyAverageListings },
                    { label: 'Specs', curr: snap.totalSpecificationsAdded, prev: snap.prevTotalSpecificationsAdded, delta: snap.totalSpecificationsAddedDelta, pct: snap.totalSpecificationsAddedPercentChange, target: t.totalSpecificationsAdded }
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{m.label}</p>
                      {m.prev != null && <p className="text-xs text-slate-400">{m.prev} &rarr; {m.curr}</p>}
                      {m.prev == null && <p className="text-base font-extrabold text-slate-900">{m.curr}</p>}
                      <DeltaBadge delta={m.delta} percent={m.pct} />
                      {m.target && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          <Target size={8} className="inline" /> {m.target}
                          {m.curr >= m.target
                            ? <span className="text-emerald-600 ml-0.5">✓</span>
                            : <span className="text-red-500 ml-0.5">({m.curr - m.target})</span>
                          }
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
            {comparisonData.length === 0 && (
              <div className="p-8 text-center">
                <ListChecks size={36} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm font-bold text-slate-400">No snapshot data yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
