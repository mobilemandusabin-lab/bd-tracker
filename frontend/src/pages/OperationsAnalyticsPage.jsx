import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3, Package, ShieldCheck, ShieldX, Clock, FileText,
  TrendingUp, Users, ChevronLeft, RefreshCw, Calendar, Trash2
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

          {/* Vendor Conversions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-emerald-50 text-emerald-600">
                <ShieldCheck size={18} />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{analytics?.vendorConversions?.activated ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Vendors Activated</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-amber-50 text-amber-600">
                <TrendingUp size={18} />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{analytics?.vendorConversions?.active_sellers ?? 0}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">New Active Sellers</p>
            </div>
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
        </>
      )}

      {/* By Users View */}
      {view === 'users' && (
        <>
          {userRows.length > 0 ? (
            <>
              {/* User Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {userRows.map((user) => (
                  <div key={user.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{user.name}</h3>
                        {user.team && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.team}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-slate-900">{user.total}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total Events</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {eventTypes.map(({ key, label, color, global }) => {
                        const c = colorMap[color];
                        return (
                          <div key={key} className={`p-2 rounded-lg ${c.bg} text-center`}>
                            <p className={`text-lg font-extrabold ${c.text}`}>{global ? (summary[key] ?? '—') : (user[key] || 0)}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight mt-0.5">{label.split(' ').pop()}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {userRows.map((user) => (
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
                        </tr>
                      ))}
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
