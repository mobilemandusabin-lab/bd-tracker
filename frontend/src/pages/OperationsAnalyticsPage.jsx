import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3, Package, ShieldCheck, ShieldX, Clock, FileText,
  TrendingUp, TrendingDown, Users, ChevronLeft, RefreshCw, Calendar, Trash2,
  Trophy, AlertTriangle, Timer, Activity, ArrowUp, ArrowDown, Flame, Target, Store, User,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, AreaChart, Area } from 'recharts';
import { API_URL } from '../config/api';

const OperationsAnalyticsPage = () => {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [view, setView] = useState('total');
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || (user?.permissions || []).includes('extension.admin');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [teamPerf, setTeamPerf] = useState(null);
  const [teamPerfLoading, setTeamPerfLoading] = useState(false);
  const [teamFilter, setTeamFilter] = useState(user?.team || 'listing');
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetValues, setTargetValues] = useState({ listing: 30, qc: 50 });
  const [savingTarget, setSavingTarget] = useState(false);
  const [totalMarketplaceProducts, setTotalMarketplaceProducts] = useState(null);
  const [mpLoading, setMpLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [period, startDate, endDate]);

  useEffect(() => {
    if (view === 'team') fetchTeamPerformance();
  }, [view, teamFilter]);

  useEffect(() => {
    const fetchMpProducts = async () => {
      setMpLoading(true);
      try {
        const res = await axios.get(`${API_URL}/nepalcan/total-marketplace-products`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTotalMarketplaceProducts(res.data.data?.totalMarketplaceProducts ?? null);
      } catch {
        setTotalMarketplaceProducts(null);
      } finally {
        setMpLoading(false);
      }
    };
    fetchMpProducts();
  }, []);

  const buildDateParams = () => {
    if (startDate && endDate) return { start_date: startDate, end_date: endDate };
    if (startDate) return { start_date: startDate, end_date: new Date().toISOString().split('T')[0] };
    if (endDate) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - 30);
      return { start_date: d.toISOString().split('T')[0], end_date };
    }
    return null;
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/extension/analytics`;
      const dateParams = buildDateParams();
      if (dateParams) {
        url += `?start_date=${dateParams.start_date}&end_date=${dateParams.end_date}`;
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

  const fetchTeamPerformance = async () => {
    setTeamPerfLoading(true);
    try {
      const teamParam = isAdmin ? `?team=${teamFilter}` : '';
      const res = await axios.get(`${API_URL}/extension/team-performance${teamParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data;
      setTeamPerf(data);
      // Update targetValues from response
      if (data.listing) setTargetValues(prev => ({ ...prev, listing: data.listing.target }));
      if (data.qc) setTargetValues(prev => ({ ...prev, qc: data.qc.target }));
    } catch (err) {
      console.error('Error fetching team performance:', err);
    } finally {
      setTeamPerfLoading(false);
    }
  };

  const fetchUserDetail = useCallback(async (userId) => {
    setUserDetailLoading(true);
    setSelectedUserId(userId);
    try {
      const dateParams = {};
      if (startDate) dateParams.start_date = startDate;
      if (endDate) dateParams.end_date = endDate;
      if (!startDate && !endDate) dateParams.period = period === 'today' ? '7d' : period;
      const params = new URLSearchParams(dateParams).toString();
      const res = await axios.get(`${API_URL}/extension/user/${userId}/detail${params ? `?${params}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserDetail(res.data.data);
    } catch (err) {
      console.error('Error fetching user detail:', err);
      setUserDetail(null);
    } finally {
      setUserDetailLoading(false);
    }
  }, [startDate, endDate, period, token]);

  useEffect(() => {
    if (selectedUserId) fetchUserDetail(selectedUserId);
  }, [period, startDate, endDate]);

  const saveTarget = async (team) => {
    setSavingTarget(true);
    try {
      await axios.put(`${API_URL}/team-targets/${team}`, { daily_target: targetValues[team] }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTeamPerformance();
    } catch (err) {
      console.error('Error saving target:', err);
    } finally {
      setSavingTarget(false);
    }
  };

  const handleStartDate = (e) => {
    setStartDate(e.target.value);
  };

  const handleEndDate = (e) => {
    setEndDate(e.target.value);
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

  const openEventDetails = async (eventType, label, userId) => {
    setDetailModal({ eventType, label, events: [], loading: true });
    try {
      let url = `${API_URL}/extension/analytics/details?event_type=${eventType}`;
      const dateParams = buildDateParams();
      if (dateParams) {
        url += `&start_date=${dateParams.start_date}&end_date=${dateParams.end_date}`;
      } else {
        url += `&period=${period}`;
      }
      if (userId) url += `&user_id=${userId}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setDetailModal(prev => ({ ...prev, events: res.data.data.events, loading: false }));
    } catch (err) {
      console.error('Error fetching event details:', err);
      setDetailModal(prev => ({ ...prev, events: [], loading: false }));
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
          {!isAdmin && (
            <p className="text-xs text-slate-400 mt-1">Showing your own activity only</p>
          )}
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
              { key: 'team', label: 'Team Performance', icon: Trophy },
              ...(isAdmin ? [{ key: 'users', label: 'By Users', icon: Users }] : []),
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setView(key); setSelectedUserId(null); setUserDetail(null); }}
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
            onChange={handleEndDate}
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
          {/* Total Marketplace Products */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Store size={20} className="text-white" />
              </div>
              <div>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest">Total marketplace products till now</p>
                <p className="text-3xl font-extrabold text-white">
                  {mpLoading ? <span className="text-white/50">...</span> : totalMarketplaceProducts?.toLocaleString() ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Team Weekly Chart */}
          {comparisonRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">
                  {startDate || period !== 'today' ? 'Team Performance' : 'Team Performance — Today'}
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{comparisonRows.length} days</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonRows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, fontWeight: 600 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="listed" name="Listings" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="specs" name="Specs" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="approved" name="QC Approved" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="rejected" name="QC Rejected" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {eventTypes.map(({ key, label, icon: Icon, color, global }) => {
              const c = colorMap[color];
              const count = summary[key] ?? '—';
              const isClickable = !global && count > 0;
              return (
                <div
                  key={key}
                  onClick={() => isClickable && openEventDetails(key, label, isAdmin ? null : user?._id)}
                  className={`p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-center relative ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-red-300 hover:shadow-md transition-all' : ''}`}
                >
                  {key === 'qc_pending' && isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteQcPending(); }}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete QC Pending data (allows re-sync)"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${c.bg} ${c.text}`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">{count}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
                  {isClickable && (
                    <p className="text-[9px] text-slate-300 mt-1">Click to view</p>
                  )}
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
          {selectedUserId ? (
            /* User Detail View */
            <UserDetailView
              userId={selectedUserId}
              userDetail={userDetail}
              loading={userDetailLoading}
              onBack={() => { setSelectedUserId(null); setUserDetail(null); }}
              period={period}
              startDate={startDate}
              endDate={endDate}
              fetchUserDetail={fetchUserDetail}
            />
          ) : userRows.length > 0 ? (
            <>
              {/* User Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {userRows.map((user) => {
                  const userSession = analytics?.userSessions?.find(s => s.user_id === user.id);
                  return (
                    <div
                      key={user.id}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all"
                    >
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
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteUserEvents(user.id, user.name); }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title={`Delete all events for ${user.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {eventTypes.map(({ key, label, color, global }) => {
                          const c = colorMap[color];
                          const count = global ? (summary[key] ?? 0) : (user[key] || 0);
                          return (
                            <button
                              key={key}
                              onClick={() => !global && count > 0 && openEventDetails(key, `${user.name} — ${label}`, user.id)}
                              className={`p-2 rounded-lg ${c.bg} text-center ${!global && count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all' : ''}`}
                              title={!global && count > 0 ? `View ${label} for ${user.name}` : ''}
                            >
                              <p className={`text-lg font-extrabold ${c.text}`}>{count}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight mt-0.5">{label.split(' ').pop()}</p>
                            </button>
                          );
                        })}
                      </div>
                      {/* Session Info + Details */}
                      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => fetchUserDetail(user.id)}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:underline shrink-0 min-w-[52px]"
                        >
                          Details →
                        </button>
                        {userSession && (
                          <>
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
                          </>
                        )}
                      </div>
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
                        {isAdmin && <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {userRows.map((user) => {
                        const userSession = analytics?.userSessions?.find(s => s.user_id === user.id);
                        return (
                          <tr key={user.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-bold text-slate-900">{user.name}</div>
                                  {user.team && <div className="text-[10px] text-slate-400 uppercase">{user.team}</div>}
                                </div>
                                <button
                                  onClick={() => fetchUserDetail(user.id)}
                                  className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:underline ml-2 shrink-0"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                            {eventTypes.map(({ key, label, color, global }) => (
                              <td
                                key={key}
                                className={`px-4 py-2.5 text-center font-bold ${colorMap[color].text} cursor-pointer hover:underline`}
                                onClick={(e) => { e.stopPropagation(); if (!global) openEventDetails(key, `${user.name} — ${label}`, user.id); }}
                              >
                                {global ? (summary[key] ?? '—') : (user[key] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-center font-bold text-slate-900">{user.total}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{userSession?.sessions || 0}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-blue-600">{userSession?.active_hours || 0}h</td>
                            {isAdmin && (
                              <td className="px-4 py-2.5 text-center">
                                <button
                                  onClick={() => deleteUserEvents(user.id, user.name)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                  title={`Delete all events for ${user.name}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            )}
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

      {/* Team Performance View */}
      {view === 'team' && (
        <div className="space-y-4">
          {/* Team Selector (admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team:</span>
              {['listing', 'qc'].map(t => (
                <button
                  key={t}
                  onClick={() => setTeamFilter(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    teamFilter === t
                      ? t === 'listing' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {t === 'listing' ? 'Listing Team' : 'QC Team'}
                </button>
              ))}
            </div>
          )}

          {/* Daily Targets Settings (admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setEditingTargets(!editingTargets)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">Daily Targets</span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-400 transition-transform ${editingTargets ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {editingTargets && (
                <div className="px-5 pb-4 border-t border-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {['listing', 'qc'].map(team => {
                      const isListing = team === 'listing';
                      return (
                        <div key={team} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isListing ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <span className="text-xs font-bold text-slate-700 w-20">{isListing ? 'Listing' : 'QC'}</span>
                          <input
                            type="number"
                            min="1"
                            value={targetValues[team]}
                            onChange={e => setTargetValues(prev => ({ ...prev, [team]: parseInt(e.target.value) || 1 }))}
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => saveTarget(team)}
                            disabled={savingTarget}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {savingTarget ? '...' : 'Save'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {teamPerfLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : teamPerf && (() => {
            const data = teamPerf[teamFilter] || teamPerf[user?.team];
            if (!data) return <EmptyState />;
            const lb = data.leaderboard || [];
            const isListing = teamFilter === 'listing' || user?.team === 'listing';
            const teamColor = isListing ? 'emerald' : 'blue';
            const metricLabel = isListing ? 'Listings + Specs' : 'Approved + Rejected';

            return (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Team Avg Today', value: data.team_today_avg, sub: `Target: ${data.target}`, icon: Target },
                    { label: 'Team Total Today', value: data.team_today_total, sub: `${lb.length} members`, icon: Users },
                    { label: 'Team Weekly Total', value: data.team_week_total, sub: metricLabel, icon: BarChart3 },
                    { label: 'Active Streaks', value: lb.filter(u => u.streak >= 3).length, sub: `of ${lb.length} members`, icon: Flame },
                  ].map(({ label, value, sub, icon: Icon }, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg bg-${teamColor}-50`}>
                          <Icon size={14} className={`text-${teamColor}-600`} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Today's Leaderboard */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-50">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isListing ? 'Listing' : 'QC'} Team Leaderboard — Today
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ranked by {metricLabel.toLowerCase()}</p>
                  </div>
                  {lb.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-slate-400">No team members found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-4 py-2.5 text-left font-bold text-slate-500 w-16">Rank</th>
                            <th className="px-4 py-2.5 text-left font-bold text-slate-500">Member</th>
                            <th className="px-4 py-2.5 text-center font-bold text-slate-500">Today</th>
                            <th className="px-4 py-2.5 text-center font-bold text-slate-500">Progress</th>
                            <th className="px-4 py-2.5 text-center font-bold text-slate-500">Streak</th>
                            <th className="px-4 py-2.5 text-center font-bold text-slate-500">Weekly</th>
                            <th className="px-4 py-2.5 text-center font-bold text-slate-500">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lb.map((member, i) => {
                            const isCurrentUser = member.user_id === user?._id;
                            const pct = Math.min(member.target_pct, 100);
                            const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                            const barBg = pct >= 90 ? 'bg-emerald-50' : pct >= 50 ? 'bg-amber-50' : 'bg-red-50';
                            return (
                              <tr
                                key={member.user_id}
                                className={`border-t border-slate-50 ${isCurrentUser ? `bg-${teamColor}-50/50` : ''} ${i === 0 ? 'bg-amber-50/30' : ''}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                      i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {member.rank}
                                    </span>
                                    {member.rank_change > 0 && (
                                      <ArrowUp size={10} className="text-emerald-500" />
                                    )}
                                    {member.rank_change < 0 && (
                                      <ArrowDown size={10} className="text-red-500" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold text-slate-900 ${isCurrentUser ? `text-${teamColor}-700` : ''}`}>
                                      {member.name}
                                    </span>
                                    {isCurrentUser && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold bg-${teamColor}-100 text-${teamColor}-600`}>You</span>
                                    )}
                                    {i === 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-600">#1</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-base font-extrabold ${member.met_today ? 'text-emerald-600' : 'text-slate-900'}`}>
                                    {member.today_count}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`flex-1 h-2 rounded-full ${barBg} overflow-hidden`}>
                                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`text-[10px] font-bold ${pct >= 90 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                      {member.target_pct}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {member.streak > 0 ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Flame size={12} className={member.streak >= 3 ? 'text-orange-500' : 'text-slate-300'} />
                                      <span className={`font-bold ${member.streak >= 3 ? 'text-orange-600' : 'text-slate-500'}`}>
                                        {member.streak}d
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-slate-700">
                                  {member.weekly_total}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {member.weekly_change_pct > 0 ? (
                                      <ArrowUp size={10} className="text-emerald-500" />
                                    ) : member.weekly_change_pct < 0 ? (
                                      <ArrowDown size={10} className="text-red-500" />
                                    ) : null}
                                    <span className={`font-bold ${
                                      member.weekly_change_pct > 0 ? 'text-emerald-600' : member.weekly_change_pct < 0 ? 'text-red-500' : 'text-slate-400'
                                    }`}>
                                      {member.weekly_change_pct > 0 ? '+' : ''}{member.weekly_change_pct}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Weekly Trend - 7-day bar chart per user */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-extrabold text-slate-900 mb-4">7-Day Trend</h3>
                  <div className="space-y-3">
                    {lb.map((member) => {
                      const maxVal = Math.max(...member.daily_counts, 1);
                      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      // Get last 7 day labels
                      const today = new Date();
                      const labels = [];
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date(today - i * 86400000);
                        labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
                      }
                      return (
                        <div key={member.user_id} className="flex items-center gap-3">
                          <span className="w-24 text-xs font-bold text-slate-700 truncate">{member.name}</span>
                          <div className="flex-1 flex items-end gap-1 h-8">
                            {member.daily_counts.map((count, j) => (
                              <div key={j} className="flex-1 flex flex-col items-center gap-0.5">
                                <div
                                  className={`w-full rounded-sm transition-all ${count >= data.target ? `bg-${teamColor}-500` : `bg-${teamColor}-200`}`}
                                  style={{ height: `${Math.max((count / maxVal) * 100, count > 0 ? 15 : 0)}%` }}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="text-right w-20">
                            <span className="text-xs font-extrabold text-slate-900">{member.weekly_total}</span>
                            <span className={`text-[10px] font-bold ml-1 ${
                              member.weekly_change_pct > 0 ? 'text-emerald-600' : member.weekly_change_pct < 0 ? 'text-red-500' : 'text-slate-400'
                            }`}>
                              {member.weekly_change_pct > 0 ? '+' : ''}{member.weekly_change_pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Day labels */}
                  <div className="flex items-center gap-1 mt-2 pl-27">
                    {(() => {
                      const labels = [];
                      for (let i = 6; i >= 0; i--) {
                        const d = new Date(Date.now() - i * 86400000);
                        labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
                      }
                      return labels.map((l, i) => (
                        <span key={i} className="flex-1 text-center text-[9px] text-slate-400">{l}</span>
                      ));
                    })()}
                  </div>
                </div>
              </>
            );
          })() || <EmptyState />}
        </div>
      )}

      {/* Event Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{detailModal.label}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{detailModal.events.length} events</p>
              </div>
              <button onClick={() => setDetailModal(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detailModal.events.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No events found</p>
              ) : (
                <div className="space-y-2">
                  {detailModal.events.map((ev, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-100">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{ev.product_name || 'Unknown Product'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(ev.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {ev.qc_status && <span className="ml-2 capitalize">QC: {ev.qc_status}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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

const UserDetailView = ({ userId, userDetail, loading, onBack, period, startDate, endDate, fetchUserDetail }) => {
  const detailTypes = [
    { key: 'listing_created', label: 'Listings', color: 'blue' },
    { key: 'spec_added', label: 'Specs', color: 'violet' },
    { key: 'product_updated', label: 'Updates', color: 'slate' },
    { key: 'qc_approved', label: 'QC Pass', color: 'emerald' },
    { key: 'qc_rejected', label: 'QC Fail', color: 'red' },
  ];

  const detailColorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  const periodLabel = startDate && endDate
    ? `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : period === '7d' ? 'Last 7 days'
    : period === '30d' ? 'Last 30 days'
    : period === '90d' ? 'Last 90 days'
    : 'Today';

  const eventDates = userDetail?.recentEvents?.length
    ? userDetail.recentEvents.reduce((acc, ev) => {
        const d = new Date(ev.created_at);
        if (!acc.min || d < acc.min) acc.min = d;
        if (!acc.max || d > acc.max) acc.max = d;
        return acc;
      }, {})
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">
            <ChevronLeft size={14} />
            Back to Users
          </button>
        </div>
        <EmptyState />
      </div>
    );
  }

  const { user, summary, dailyBreakdown, sessions, totalSessions, totalActiveMinutes, bestWorst, recentEvents } = userDetail;

  return (
    <div className="space-y-4">
      {/* Back + User Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronLeft size={14} />
          Back to Users
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <h3 className="text-lg font-extrabold text-slate-900">{user.name}</h3>
            <div className="flex items-center gap-2 justify-end mt-0.5">
              {user.team && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.team}</span>}
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{periodLabel}</span>
          {eventDates && (
            <span className="text-[10px] text-slate-400 ml-1">
              {eventDates.min.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {eventDates.max.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <User size={18} className="text-red-600" />
          </div>
          <button
            onClick={() => fetchUserDetail(userId)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {detailTypes.map(({ key, label, color }) => {
          const c = detailColorMap[color];
          const count = summary[key] || 0;
          return (
            <div key={key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
              <p className={`text-2xl font-extrabold ${c.text}`}>{count}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Session Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sessions</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{totalSessions}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Time</p>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{Math.round(totalActiveMinutes / 60)}h {totalActiveMinutes % 60}m</p>
        </div>
      </div>

      {/* No Data Message */}
      {summary.total === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-700">No activity in this period</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Try a wider date range. Currently showing <span className="font-bold">{periodLabel}</span>.</p>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {dailyBreakdown && dailyBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Daily Performance</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyBreakdown} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                />
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 600 }} iconType="circle" iconSize={8} />
                <Bar dataKey="listing_created" name="Listings" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spec_added" name="Specs" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="product_updated" name="Updates" fill="#64748b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="qc_approved" name="QC Approved" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="qc_rejected" name="QC Rejected" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">
              Sessions <span className="text-slate-400 font-normal">({sessions.length} total, {Math.round(totalActiveMinutes / 60)}h {totalActiveMinutes % 60}m active)</span>
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {sessions.map((s) => (
              <div key={s.session_id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-extrabold text-slate-500">
                  {s.session_id}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">
                      {new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {' — '}
                      {new Date(s.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {s.duration_min}m
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {s.event_count} events
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[...new Set(s.events.map(e => e.event_type))].slice(0, 5).map(type => (
                      <span key={type} className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best & Worst Dates */}
      {bestWorst && Object.values(bestWorst).some(bw => bw?.best) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Best & Lowest Days</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {detailTypes.map(({ key, label, color }) => {
              const bw = bestWorst[key];
              if (!bw?.best) return null;
              const c = detailColorMap[color];
              return (
                <div key={key} className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowUp size={12} className="text-emerald-500 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-600">Best</span>
                      <span className="text-xs font-bold text-slate-900">{bw.best.date}</span>
                      <span className={`ml-auto text-sm font-extrabold ${c.text}`}>{bw.best.count}</span>
                    </div>
                    {bw.best.sessions?.length > 0 && (
                      <div className="ml-5 text-[9px] text-slate-400">
                        {bw.best.sessions.map(s => (
                          <div key={s.session_id}>
                            Session #{s.session_id}: {new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {' — '} {new Date(s.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({s.duration_min}m)
                          </div>
                        ))}
                      </div>
                    )}
                    {bw.worst && bw.worst.date !== bw.best.date && (
                      <div className="flex items-center gap-2">
                        <ArrowDown size={12} className="text-red-500 shrink-0" />
                        <span className="text-[10px] font-bold text-red-500">Lowest</span>
                        <span className="text-xs font-bold text-slate-900">{bw.worst.date}</span>
                        <span className="ml-auto text-sm font-extrabold text-slate-400">{bw.worst.count}</span>
                      </div>
                    )}
                    {bw.worst?.sessions?.length > 0 && bw.worst.date !== bw.best.date && (
                      <div className="ml-5 text-[9px] text-slate-400">
                        {bw.worst.sessions.map(s => (
                          <div key={s.session_id}>
                            Session #{s.session_id}: {new Date(s.start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {' — '} {new Date(s.end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} ({s.duration_min}m)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {recentEvents && recentEvents.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">
              Recent Events <span className="text-slate-400 font-normal">({recentEvents.length})</span>
            </h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {recentEvents.map((ev, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">
                  {new Date(ev.created_at).toLocaleTimeString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ev.event_type === 'listing_created' ? 'bg-blue-50 text-blue-600' :
                  ev.event_type === 'spec_added' ? 'bg-violet-50 text-violet-600' :
                  ev.event_type === 'qc_approved' ? 'bg-emerald-50 text-emerald-600' :
                  ev.event_type === 'qc_rejected' ? 'bg-red-50 text-red-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {ev.event_type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-bold text-slate-700 truncate flex-1">{ev.product_name || 'Unknown'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsAnalyticsPage;
