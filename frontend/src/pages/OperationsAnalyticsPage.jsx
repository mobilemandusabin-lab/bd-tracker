import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3, Package, ShieldCheck, ShieldX, Clock, FileText,
  TrendingUp, TrendingDown, Users, ChevronLeft, RefreshCw, Calendar, Trash2,
  Trophy, AlertTriangle, Timer, Activity, ArrowUp, ArrowDown
} from 'lucide-react';
import { API_URL } from '../config/api';

const OperationsAnalyticsPage = () => {
  const { token } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [view, setView] = useState('total');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [period, startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/extension/analytics`;
      if (startDate && endDate) {
        url += `?start_date=${startDate}&end_date=${endDate}`;
      } else {
        url += `?period=${period}`;
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(res.data.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDate = (e) => {
    setStartDate(e.target.value);
    if (!endDate) setEndDate(new Date().toISOString().split('T')[0]);
  };

  const clearDateRange = () => {
    setStartDate('');
    setEndDate('');
  };

  const deleteQcPending = async () => {
    if (!confirm('Delete QC Pending data? Extension will re-sync on next page load.')) return;
    try {
      await axios.delete(`${API_URL}/extension/qc-pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnalytics();
    } catch (err) {
      console.error('Error deleting qc_pending:', err);
    }
  };

  const deleteUserEvents = async (userId, userName) => {
    if (!confirm(`Delete ALL events for ${userName}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/extension/events/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnalytics();
    } catch (err) {
      console.error('Error deleting user events:', err);
    }
  };

  const deleteUserEventType = async (userId, userName, eventType) => {
    if (!confirm(`Delete all ${eventType} events for ${userName}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/extension/events/user/${userId}?event_type=${eventType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnalytics();
    } catch (err) {
      console.error('Error deleting user event type:', err);
    }
  };

  const eventTypes = [
    { key: 'listing_created', label: 'Products Listed', icon: Package, color: 'blue' },
    { key: 'qc_approved', label: 'QC Approved', icon: ShieldCheck, color: 'emerald' },
    { key: 'qc_rejected', label: 'QC Rejected', icon: ShieldX, color: 'red' },
    { key: 'qc_pending', label: 'QC Pending', icon: Clock, color: 'amber', global: true },
    { key: 'spec_added', label: 'Specs Added', icon: FileText, color: 'violet' },
  ];

  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
    red: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
  };

  const summary = analytics?.summary || {};
  const totalEvents = summary.total || 0;
  const comparisonRows = analytics?.dailyComparison || [];

  // Build user rows from eventsByUser
  const userRows = (analytics?.eventsByUser || []).map((u) => {
    const eventMap = {};
    for (const ev of u.events) {
      eventMap[ev.event_type] = ev.count;
    }
    return {
      id: u._id,
      name: u.user_name || 'Unknown',
      team: u.user_team || '',
      ...eventMap,
      total: u.total,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Internal Operations</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Operations Analytics</h1>
        </div>
        <button
          onClick={() => navigate('/extension')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft size={14} />
          Chrome Extension
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            {[
              { key: 'total', label: 'Total', icon: BarChart3 },
              { key: 'users', label: 'By Users', icon: Users },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  view === key
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Period + Refresh */}
          <div className="flex items-center gap-2">
            {['today', '7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); clearDateRange(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p && !startDate
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
            <button
              onClick={fetchAnalytics}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={handleStartDate}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border-none outline-none"
          />
          <span className="text-xs text-slate-400 font-bold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border-none outline-none"
          />
          {startDate && (
            <button
              onClick={clearDateRange}
              className="px-2 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Total View */}
      {view === 'total' && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {eventTypes.map(({ key, label, icon: Icon, color, global }) => {
              const c = colorMap[color];
              return (
                <div key={key} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-center relative">
                  {key === 'qc_pending' && (
                    <button
                      onClick={deleteQcPending}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete QC Pending data (allows re-sync)"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${c.bg} ${c.text}`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">{summary[key] ?? '—'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
                </div>
              );
            })}
          </div>

          {/* Total Events Bar */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">Activity Breakdown</h3>
              <span className="text-2xl font-extrabold text-slate-900">{totalEvents} <span className="text-xs font-bold text-slate-400">total events</span></span>
            </div>
            {totalEvents > 0 ? (
              <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
                {eventTypes.map(({ key, color }) => {
                  const count = summary[key] || 0;
                  if (!count) return null;
                  const pct = (count / totalEvents) * 100;
                  return (
                    <div
                      key={key}
                      className={`${colorMap[color].bar} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${key}: ${count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-6 rounded-full bg-slate-100" />
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              {eventTypes.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${colorMap[color].bar}`} />
                  <span className="text-[10px] font-bold text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* QC Daily Comparison Table */}
          {comparisonRows.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">QC Daily Comparison</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Pending count vs approved vs rejected per day</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Pending</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Approved</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Rejected</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Listed</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Specs</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {comparisonRows.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-700">{row.date}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-amber-600">
                          {row.pending !== null ? row.pending.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-600">
                          {row.approved || 0}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-red-600">
                          {row.rejected || 0}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-600">
                          {row.listed || 0}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-violet-600">
                          {row.specs || 0}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-500">
                          {row.updated || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}

          {/* QC Approval Rate */}
          {(() => {
            const qc = analytics?.qcStats || {};
            const totalQc = (qc.approved || 0) + (qc.rejected || 0);
            const approvalRate = totalQc > 0 ? Math.round(((qc.approved || 0) / totalQc) * 100) : 0;
            const bulkTotal = (qc.bulk_approved || 0) + (qc.bulk_rejected || 0);
            const indTotal = (qc.individual_approved || 0) + (qc.individual_rejected || 0);
            return totalQc > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-700 mb-4">QC Approval Rate</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-2">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-100" stroke="currentColor" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="text-emerald-500" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray={`${approvalRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-slate-900">{approvalRate}%</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Approval Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-emerald-600">{qc.approved || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total Approved</p>
                    <p className="text-[10px] text-slate-300">({qc.rejected || 0} rejected)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-blue-600">{bulkTotal}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Bulk QC</p>
                    <p className="text-[10px] text-slate-300">({qc.bulk_approved || 0} approved, {qc.bulk_rejected || 0} rejected)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-violet-600">{indTotal}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Individual QC</p>
                    <p className="text-[10px] text-slate-300">({qc.individual_approved || 0} approved, {qc.individual_rejected || 0} rejected)</p>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Top Products */}
          {analytics?.topProducts?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Top Products by Activity</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Most active products during this period</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">#</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Product</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Total</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Listings</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Specs</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Updates</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Pass</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Fail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.topProducts.map((p, i) => (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900 max-w-xs truncate">{p._id}</td>
                        <td className="px-4 py-2.5 text-center font-extrabold text-slate-900">{p.total}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-600">{p.listings || 0}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-violet-600">{p.specs || 0}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-500">{p.updates || 0}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{p.qc_approved || 0}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-red-600">{p.qc_rejected || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Vendors */}
          {analytics?.topVendors?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Top Vendors by Activity</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Vendors with most product activity</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">#</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Vendor</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Total</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Products</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Listings</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Pass</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">QC Fail</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.topVendors.map((v, i) => {
                      const totalQc = (v.qc_approved || 0) + (v.qc_rejected || 0);
                      const passRate = totalQc > 0 ? Math.round((v.qc_approved / totalQc) * 100) : null;
                      return (
                        <tr key={v._id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-bold text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 max-w-xs truncate">{v.vendor_name}</td>
                          <td className="px-4 py-2.5 text-center font-extrabold text-slate-900">{v.total}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-600">{v.product_count || 0}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-blue-600">{v.listings || 0}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{v.qc_approved || 0}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-red-600">{v.qc_rejected || 0}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-900">{passRate !== null ? `${passRate}%` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Best & Worst Days */}
          {analytics?.bestWorst && Object.keys(analytics.bestWorst).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Best & Worst Days</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[
                  { key: 'listed', label: 'Products Listed', color: 'blue' },
                  { key: 'specs', label: 'Specs Added', color: 'violet' },
                  { key: 'updated', label: 'Products Updated', color: 'slate' },
                  { key: 'approved', label: 'QC Approved', color: 'emerald' },
                  { key: 'rejected', label: 'QC Rejected', color: 'red' },
                ].map(({ key, label, color }) => {
                  const data = analytics.bestWorst[key];
                  if (!data?.best) return null;
                  return (
                    <div key={key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                      <p className="text-xs font-bold text-slate-500 mb-3">{label}</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowUp size={12} className="text-emerald-500" />
                          <span className="text-[10px] text-slate-400 font-bold w-12">Best</span>
                          <span className="text-xs font-bold text-slate-900">{data.best.date}</span>
                          <span className={`ml-auto text-sm font-extrabold text-${color}-600`}>{data.best[key]}</span>
                        </div>
                        {data.worst && data.worst.date !== data.best.date && (
                          <div className="flex items-center gap-2">
                            <ArrowDown size={12} className="text-red-500" />
                            <span className="text-[10px] text-slate-400 font-bold w-12">Lowest</span>
                            <span className="text-xs font-bold text-slate-900">{data.worst.date}</span>
                            <span className={`ml-auto text-sm font-extrabold text-slate-400`}>{data.worst[key]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hourly Activity Heatmap */}
          {analytics?.hourlyActivity?.length > 0 && (() => {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const maxCount = Math.max(...analytics.hourlyActivity.map(h => h.count));
            const heatMap = {};
            for (const h of analytics.hourlyActivity) {
              heatMap[`${h.dow}-${h.hour}`] = h.count;
            }
            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-700 mb-1">Hourly Activity Heatmap</h3>
                <p className="text-[10px] text-slate-400 mb-4">When extension events are captured (hours in server timezone)</p>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px]">
                    <div className="flex gap-0.5 mb-0.5">
                      <div className="w-10" />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="flex-1 text-center text-[8px] font-bold text-slate-400">{h}</div>
                      ))}
                    </div>
                    {dayNames.map((day, dow) => {
                      const realDow = dow + 1;
                      return (
                        <div key={dow} className="flex gap-0.5 mb-0.5">
                          <div className="w-10 text-[10px] font-bold text-slate-500 flex items-center">{day}</div>
                          {Array.from({ length: 24 }, (_, h) => {
                            const count = heatMap[`${realDow}-${h}`] || 0;
                            const intensity = maxCount > 0 ? count / maxCount : 0;
                            const bg = count === 0 ? 'bg-slate-50' :
                              intensity < 0.25 ? 'bg-emerald-100' :
                              intensity < 0.5 ? 'bg-emerald-200' :
                              intensity < 0.75 ? 'bg-emerald-400' : 'bg-emerald-600';
                            return (
                              <div
                                key={h}
                                className={`flex-1 aspect-square rounded-sm ${bg} cursor-default transition-colors`}
                                title={`${day} ${h}:00 — ${count} events`}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 mt-3 justify-end">
                      <span className="text-[9px] text-slate-400">Less</span>
                      {['bg-slate-50', 'bg-emerald-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600'].map((c) => (
                        <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
                      ))}
                      <span className="text-[9px] text-slate-400">More</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* User Activity Sessions */}
          {analytics?.userSessions?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">User Activity Sessions</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Active periods derived from event timestamps (1h gap = new session)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">User</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Sessions</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Active Hours</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Total Events</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">First Event</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Last Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.userSessions.map((u) => {
                      const firstSession = u.session_details?.[0];
                      const lastSession = u.session_details?.[u.session_details.length - 1];
                      return (
                        <tr key={u.user_id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-slate-900">{u.user_name}</div>
                            {u.user_team && <div className="text-[10px] text-slate-400 uppercase">{u.user_team}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-900">{u.sessions}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{u.active_hours}h</td>
                          <td className="px-4 py-2.5 text-center font-extrabold text-slate-900">{u.total_events}</td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                            {firstSession ? new Date(firstSession.start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                            {lastSession ? new Date(lastSession.end).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Session Details (expandable) */}
              {analytics.userSessions.map((u) => (
                u.session_details?.length > 0 && (
                  <details key={`detail-${u.user_id}`} className="border-t border-slate-100">
                    <summary className="px-6 py-3 text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-50">
                      {u.user_name} — Session Details ({u.sessions} sessions)
                    </summary>
                    <div className="px-6 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {u.session_details.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                            <span className="font-bold text-slate-400">#{i + 1}</span>
                            <span className="text-slate-600">
                              {new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              {' — '}
                              {new Date(s.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="ml-auto font-bold text-slate-500">{s.duration_min}m</span>
                            <span className="text-slate-400">({s.event_count} events)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )
              ))}
            </div>
          )}
        </>
      )}

      {/* By Users View */}
      {view === 'users' && (
        <>
          {userRows.length > 0 ? (
            <>
              {/* User Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {userRows.map((user) => {
                  const userSession = analytics?.userSessions?.find(s => s.user_id === user.id);
                  return (
                    <div key={user.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">{user.name}</h3>
                          {user.team && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.team}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-2xl font-extrabold text-slate-900">{user.total}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Events</p>
                          </div>
                          <button
                            onClick={() => deleteUserEvents(user.id, user.name)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={`Delete all events for ${user.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {eventTypes.map(({ key, label, color, global }) => {
                          const c = colorMap[color];
                          const count = global ? (summary[key] ?? 0) : (user[key] || 0);
                          return (
                            <button
                              key={key}
                              onClick={() => !global && count > 0 && deleteUserEventType(user.id, user.name, key)}
                              className={`p-2 rounded-lg ${c.bg} text-center ${!global && count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-red-300 transition-all' : ''}`}
                              title={!global && count > 0 ? `Delete ${label} events for ${user.name}` : ''}
                            >
                              <p className={`text-lg font-extrabold ${c.text}`}>{count}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight mt-0.5">{label.split(' ').pop()}</p>
                            </button>
                          );
                        })}
                      </div>
                      {/* Session Info */}
                      {userSession && (
                        <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Timer size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500">{userSession.sessions} session{userSession.sessions !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Activity size={12} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-500">{userSession.active_hours}h active</span>
                          </div>
                          {userSession.session_details?.[0] && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <Clock size={12} className="text-slate-400" />
                              <span className="text-[10px] text-slate-400">
                                {new Date(userSession.session_details[0].start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                {' — '}
                                {new Date(userSession.session_details[userSession.session_details.length - 1].end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* User Comparison Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700">User Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">User</th>
                        {eventTypes.map(({ key, label }) => (
                          <th key={key} className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">{label}</th>
                        ))}
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Total</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Sessions</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase">Active</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {userRows.map((user) => {
                        const userSession = analytics?.userSessions?.find(s => s.user_id === user.id);
                        return (
                          <tr key={user.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="font-bold text-slate-900">{user.name}</div>
                              {user.team && <div className="text-[10px] text-slate-400 uppercase">{user.team}</div>}
                            </td>
                            {eventTypes.map(({ key, color, global }) => (
                              <td key={key} className={`px-4 py-2.5 text-center font-bold ${colorMap[color].text}`}>
                                {global ? (summary[key] ?? '—') : (user[key] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-center font-bold text-slate-900">{user.total}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{userSession?.sessions || 0}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-blue-600">{userSession?.active_hours || 0}h</td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => deleteUserEvents(user.id, user.name)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title={`Delete all events for ${user.name}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </>
      )}
    </div>
  );
};

const EmptyState = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
    <TrendingUp size={40} className="text-slate-200 mx-auto mb-3" />
    <p className="text-sm font-bold text-slate-400">No activity recorded yet</p>
    <p className="text-xs text-slate-300 mt-1">Activity will appear here once the extension starts capturing events</p>
  </div>
);

export default OperationsAnalyticsPage;
