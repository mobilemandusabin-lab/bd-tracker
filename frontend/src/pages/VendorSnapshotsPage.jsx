import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Store, ShieldCheck, Package, Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2, AlertCircle, Camera } from 'lucide-react';
import { formatNepaliDate, formatNepaliDateLong, getNepaliMonthName } from '../utils/nepaliDate';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const StatCard = ({ icon: Icon, label, value, subValue, iconBg = 'bg-red-50' }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-3">
      <div className={`${iconBg} p-2.5 rounded-xl`}>
        <Icon size={18} className="text-red-600" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900">{value}</p>
    {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
  </div>
);

const DeltaBadge = ({ delta, percent }) => {
  if (delta === 0) return <span className="text-xs text-slate-400 font-semibold">-</span>;
  const isPositive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
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
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-bold text-slate-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function VendorSnapshotsPage({ embedded }) {
  const [snapshots, setSnapshots] = useState([]);
  const [latestSnapshots, setLatestSnapshots] = useState(null);
  const [comparisonData, setComparisonData] = useState([]);
  const [snapshotType, setSnapshotType] = useState('weekly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapshotsRes, latestRes, compareRes] = await Promise.all([
        axios.get(`${API_URL}/vendor-snapshots?type=${snapshotType}&limit=24`, { headers }),
        axios.get(`${API_URL}/vendor-snapshots/latest`, { headers }),
        axios.get(`${API_URL}/vendor-snapshots/compare?type=${snapshotType}&count=12`, { headers })
      ]);
      setSnapshots(snapshotsRes.data.data.snapshots);
      setLatestSnapshots(latestRes.data.data);
      setComparisonData(compareRes.data.data.snapshots);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [snapshotType]);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      await axios.post(`${API_URL}/vendor-snapshots/capture`, { type: snapshotType }, { headers });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to capture snapshot');
    } finally {
      setCapturing(false);
    }
  };

  const latest = latestSnapshots?.weekly || latestSnapshots?.monthly;

  const chartData = useMemo(() => {
    return [...comparisonData].reverse().map(s => ({
      name: s.nepaliDate,
      'Total Vendors': s.totalVendors,
      'Verified Vendors': s.verifiedVendors,
      'Active Sellers': s.activeSellers
    }));
  }, [comparisonData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="text-red-600 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading snapshots...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      {!embedded && (
        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Camera size={24} className="text-white/80" />
                  <h1 className="text-2xl lg:text-3xl font-extrabold text-white">Vendor Snapshots</h1>
                </div>
                <p className="text-red-200 text-sm font-medium">
                  Weekly and monthly vendor metrics comparison in Nepali calendar
                </p>
                {latest && (
                  <p className="text-red-100 text-xs font-semibold mt-2">
                    Latest: {latest.nepaliDate} ({snapshotType})
                  </p>
                )}
              </div>
              <button
                onClick={handleCapture}
                disabled={capturing}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all text-sm font-bold backdrop-blur-sm disabled:opacity-50"
              >
                {capturing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {capturing ? 'Capturing...' : 'Capture Now'}
              </button>
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
          <button onClick={handleCapture} disabled={capturing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all">
            {capturing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {capturing ? 'Capturing...' : 'Capture'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Store}
          label="Total Vendors"
          value={latest?.totalVendors ?? '-'}
        />
        <StatCard
          icon={ShieldCheck}
          label="Verified Vendors"
          value={latest?.verifiedVendors ?? '-'}
        />
        <StatCard
          icon={Package}
          label="Active Sellers"
          value={latest?.activeSellers ?? '-'}
        />
        <StatCard
          icon={Calendar}
          label="Last Snapshot"
          value={latest ? formatNepaliDate(latest.snapshotDate) : '-'}
          subValue={latest ? new Date(latest.snapshotDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null}
        />
      </div>

      {/* Type Toggle */}
      <div className="flex items-center gap-2">
        {['weekly', 'monthly'].map(type => (
          <button
            key={type}
            onClick={() => setSnapshotType(type)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              snapshotType === type
                ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-red-50 hover:text-red-600'
            }`}
          >
            {type === 'weekly' ? 'Weekly (Sunday)' : 'Monthly (Month-end)'}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            {snapshotType === 'weekly' ? 'Weekly' : 'Monthly'} Vendor Trends
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F87171" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FCA5A5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FCA5A5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs font-semibold text-slate-700">{value}</span>}
              />
              <Area type="monotone" dataKey="Total Vendors" stroke="#DC2626" fill="url(#totalGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Verified Vendors" stroke="#F87171" fill="url(#verifiedGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Active Sellers" stroke="#FCA5A5" fill="url(#activeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 lg:p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            {snapshotType === 'weekly' ? 'Weekly' : 'Monthly'} Comparison
          </h3>
          <p className="text-xs text-slate-500 mt-1">Changes compared to previous period</p>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Period</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Vendors</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Verified</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Sellers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {comparisonData.map((snap, i) => (
                <tr key={snap._id} className={i === 0 ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{snap.nepaliDate}</span>
                      {snap.prevNepaliDate && (
                        <span className="text-[10px] text-slate-400 mt-0.5">vs {snap.prevNepaliDate}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex flex-col items-end">
                      {snap.prevTotalVendors != null && (
                        <span className="text-xs text-slate-400">{snap.prevTotalVendors}</span>
                      )}
                      <span className="text-sm font-extrabold text-slate-900">{snap.totalVendors}</span>
                      <DeltaBadge delta={snap.totalVendorsDelta} percent={snap.totalVendorsPercentChange} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex flex-col items-end">
                      {snap.prevVerifiedVendors != null && (
                        <span className="text-xs text-slate-400">{snap.prevVerifiedVendors}</span>
                      )}
                      <span className="text-sm font-extrabold text-slate-900">{snap.verifiedVendors}</span>
                      <DeltaBadge delta={snap.verifiedVendorsDelta} percent={snap.verifiedVendorsPercentChange} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex flex-col items-end">
                      {snap.prevActiveSellers != null && (
                        <span className="text-xs text-slate-400">{snap.prevActiveSellers}</span>
                      )}
                      <span className="text-sm font-extrabold text-slate-900">{snap.activeSellers}</span>
                      <DeltaBadge delta={snap.activeSellersDelta} percent={snap.activeSellersPercentChange} />
                    </div>
                  </td>
                </tr>
              ))}
              {comparisonData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <Camera size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No snapshot data yet</p>
                    <p className="text-xs text-slate-400 mt-1">Snapshots are taken every Sunday and month-end</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-slate-50">
          {comparisonData.map((snap) => (
            <div key={snap._id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-900">{snap.nepaliDate}</span>
                  {snap.prevNepaliDate && (
                    <span className="text-[10px] text-slate-400 ml-2">vs {snap.prevNepaliDate}</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Total</p>
                  {snap.prevTotalVendors != null && <p className="text-xs text-slate-400">{snap.prevTotalVendors} &rarr;</p>}
                  <p className="text-base font-extrabold text-slate-900">{snap.totalVendors}</p>
                  <DeltaBadge delta={snap.totalVendorsDelta} percent={snap.totalVendorsPercentChange} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Verified</p>
                  {snap.prevVerifiedVendors != null && <p className="text-xs text-slate-400">{snap.prevVerifiedVendors} &rarr;</p>}
                  <p className="text-base font-extrabold text-slate-900">{snap.verifiedVendors}</p>
                  <DeltaBadge delta={snap.verifiedVendorsDelta} percent={snap.verifiedVendorsPercentChange} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Active</p>
                  {snap.prevActiveSellers != null && <p className="text-xs text-slate-400">{snap.prevActiveSellers} &rarr;</p>}
                  <p className="text-base font-extrabold text-slate-900">{snap.activeSellers}</p>
                  <DeltaBadge delta={snap.activeSellersDelta} percent={snap.activeSellersPercentChange} />
                </div>
              </div>
            </div>
          ))}
          {comparisonData.length === 0 && (
            <div className="p-8 text-center">
              <Camera size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-400">No snapshot data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
