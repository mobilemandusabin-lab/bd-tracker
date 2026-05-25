import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import {
  Phone, MessageSquare, Mail, CalendarDays, Monitor, Clock, StickyNote,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Minus,
  Users, Target, TrendingUp, TrendingDown, Activity, GitCompareArrows,
  X, BarChart3, ArrowLeft, Calendar, Loader2, AlertCircle, FileText,
  ShieldCheck, Zap, GitBranch
} from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';
import { formatNepaliDate, formatNepaliDateLong } from '../utils/nepaliDate';

const ACTIVITY_ICONS = {
  call: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  meeting: CalendarDays,
  demo: Monitor,
  follow_up: Clock,
  note: StickyNote,
  status_change: GitBranch
};

const ACTIVITY_COLORS = {
  call: '#DC2626',
  whatsapp: '#16a34a',
  email: '#2563eb',
  meeting: '#7c3aed',
  demo: '#ea580c',
  follow_up: '#0891b2',
  note: '#64748b',
  status_change: '#9333ea'
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  return days;
}

const StatCard = ({ icon: Icon, label, value, color = 'text-red-600', iconBg = 'bg-red-50' }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2.5 mb-2">
      <div className={`${iconBg} p-2 rounded-lg`}>
        <Icon size={16} className={color} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900">{value ?? 0}</p>
  </div>
);

const DeltaBadge = ({ delta, pct, invertColors = false }) => {
  if (delta === 0 || delta == null) return <span className="text-xs text-slate-400 font-semibold">-</span>;
  const isPositive = delta > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isPositive ? '+' : ''}{delta}
      {pct != null && <span className="text-[10px]">({isPositive ? '+' : ''}{pct}%)</span>}
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

export default function DailyReportPage({ embedded }) {
  const { token } = useSelector((state) => state.auth);
  const headers = { Authorization: `Bearer ${token}` };

  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compareDate, setCompareDate] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [weekCompareData, setWeekCompareData] = useState(null);
  const [weekCompareLoading, setWeekCompareLoading] = useState(false);
  const [compareMode, setCompareMode] = useState('day'); // 'day' or 'week'
  const [expandedSections, setExpandedSections] = useState({ converted: true, created: false, lost: false, activated: false, activeSellers: false });
  const [selectedUser, setSelectedUser] = useState(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const calendarDays = useMemo(
    () => getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleDateClick = async (day) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setView('detail');
    setDetailLoading(true);
    setCompareData(null);
    setShowComparePicker(false);
    try {
      const res = await axios.get(`${API_URL}/dashboard/day-detail?date=${dateStr}`, { headers });
      setDayDetail(res.data.data);
    } catch (err) {
      console.error('Error fetching day detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCompare = async () => {
    if (compareMode === 'week') {
      setWeekCompareLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/week-compare?date=${selectedDate}`, { headers });
        setWeekCompareData(res.data.data);
      } catch (err) {
        console.error('Error fetching week comparison:', err);
      } finally {
        setWeekCompareLoading(false);
      }
    } else {
      if (!compareDate) return;
      setCompareLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/day-compare?date1=${selectedDate}&date2=${compareDate}`, { headers });
        setCompareData(res.data.data);
      } catch (err) {
        console.error('Error fetching comparison:', err);
      } finally {
        setCompareLoading(false);
      }
    }
  };

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const typeChartData = useMemo(() => {
    if (!dayDetail?.summary?.by_type) return [];
    return Object.entries(dayDetail.summary.by_type).map(([type, count]) => ({
      name: type.replace('_', ' '),
      count,
      fill: ACTIVITY_COLORS[type] || '#94a3b8'
    }));
  }, [dayDetail]);

  const compareChartData = useMemo(() => {
    if (!compareData) return [];
    const s1 = compareData.date1.summary;
    const s2 = compareData.date2.summary;
    return [
      { name: 'Activities', [compareData.date1.date]: s1.total_activities, [compareData.date2.date]: s2.total_activities },
      { name: 'Calls', [compareData.date1.date]: s1.by_type.call || 0, [compareData.date2.date]: s2.by_type.call || 0 },
      { name: 'Converted', [compareData.date1.date]: s1.leads_converted, [compareData.date2.date]: s2.leads_converted },
      { name: 'Created', [compareData.date1.date]: s1.leads_created, [compareData.date2.date]: s2.leads_created },
      { name: 'Lost', [compareData.date1.date]: s1.leads_lost, [compareData.date2.date]: s2.leads_lost },
      { name: 'Contacted', [compareData.date1.date]: s1.leads_contacted, [compareData.date2.date]: s2.leads_contacted }
    ];
  }, [compareData]);

  const LeadList = ({ leads, emptyIcon: EmptyIcon, emptyText, renderItem }) => (
    leads.length === 0 ? (
      <div className="p-6 text-center">
        <EmptyIcon size={28} className="text-slate-200 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-400">{emptyText}</p>
      </div>
    ) : (
      <div className="divide-y divide-slate-50">
        {leads.map(lead => renderItem(lead))}
      </div>
    )
  );

  // ─── CALENDAR VIEW ───
  if (view === 'calendar') {
    return (
      <div className="space-y-6">
        {!embedded && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 bg-red-600 rounded-full" />
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Daily Report</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Calendar</h1>
            <p className="text-sm text-slate-500 mt-1">Click any date to view its detailed report</p>
          </div>
        )}

        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4">
                <div className="flex items-center justify-between">
                  <button onClick={prevMonth} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                    <ChevronLeft size={18} className="text-white" />
                  </button>
                  <div className="text-center">
                    <h2 className="text-white font-extrabold text-base">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                  </div>
                  <button onClick={nextMonth} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                    <ChevronRight size={18} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 px-3 pt-3 pb-1">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
                    {d.charAt(0)}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} />;
                  const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  return (
                    <div key={day} className="flex items-center justify-center">
                      <button
                        onClick={() => handleDateClick(day)}
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                          isToday
                            ? "bg-red-600 text-white shadow-md shadow-red-200"
                            : "text-slate-600 hover:bg-red-50 hover:text-red-600"
                        )}
                      >
                        {day}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (view === 'detail') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 bg-red-600 rounded-full" />
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Day Detail</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {selectedDate && formatNepaliDate(selectedDate)}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComparePicker(!showComparePicker)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <GitCompareArrows size={14} />
              Compare
            </button>
            <button
              onClick={() => { setView('calendar'); setDayDetail(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <ArrowLeft size={14} />
              Calendar
            </button>
          </div>
        </div>

        {/* Compare Picker */}
        {showComparePicker && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700">Compare mode:</span>
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setCompareMode('day')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${compareMode === 'day' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Day vs Day
                </button>
                <button
                  onClick={() => setCompareMode('week')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${compareMode === 'week' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Week to Date
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {compareMode === 'day' ? (
                <>
                  <input
                    type="date"
                    value={compareDate}
                    onChange={(e) => setCompareDate(e.target.value)}
                    max={todayStr}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <button
                    onClick={handleCompare}
                    disabled={!compareDate || compareLoading}
                    className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {compareLoading ? <Loader2 size={14} className="animate-spin" /> : 'Compare'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleCompare}
                  disabled={weekCompareLoading}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {weekCompareLoading ? <Loader2 size={14} className="animate-spin" /> : 'Compare This Week vs Last Week'}
                </button>
              )}
              {(compareData || weekCompareData) && (
                <button
                  onClick={() => { setCompareData(null); setWeekCompareData(null); setCompareDate(''); }}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Week Comparison */}
        {weekCompareData && (
          <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GitCompareArrows size={16} className="text-red-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {weekCompareData.current_week.label} vs {weekCompareData.previous_week.label}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Activities', delta: weekCompareData.delta.total_activities, pct: weekCompareData.delta.total_activities_pct },
                { label: 'Calls', delta: weekCompareData.delta.calls, pct: weekCompareData.delta.calls_pct },
                { label: 'Converted', delta: weekCompareData.delta.leads_converted, pct: weekCompareData.delta.leads_converted_pct },
                { label: 'Created', delta: weekCompareData.delta.leads_created, pct: weekCompareData.delta.leads_created_pct },
                { label: 'Lost', delta: weekCompareData.delta.leads_lost, pct: weekCompareData.delta.leads_lost_pct, invert: true },
                { label: 'Contacted', delta: weekCompareData.delta.leads_contacted, pct: weekCompareData.delta.leads_contacted_pct },
                { label: 'Activated', delta: weekCompareData.delta.activated, pct: weekCompareData.delta.activated_pct },
                { label: 'Active Sellers', delta: weekCompareData.delta.active_sellers, pct: weekCompareData.delta.active_sellers_pct }
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                  <DeltaBadge delta={item.delta} pct={item.pct} invertColors={item.invert} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline Comparison */}
        {compareData && (
          <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GitCompareArrows size={16} className="text-red-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {formatNepaliDate(compareData.date1.date)} vs {formatNepaliDate(compareData.date2.date)}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: 'Total Activities', delta: compareData.delta.total_activities, pct: compareData.delta.total_activities_pct },
                { label: 'Calls', delta: compareData.delta.calls, pct: compareData.delta.calls_pct },
                { label: 'Converted', delta: compareData.delta.leads_converted, pct: compareData.delta.leads_converted_pct },
                { label: 'Created', delta: compareData.delta.leads_created, pct: compareData.delta.leads_created_pct },
                { label: 'Lost', delta: compareData.delta.leads_lost, pct: compareData.delta.leads_lost_pct, invert: true },
                { label: 'Contacted', delta: compareData.delta.leads_contacted, pct: compareData.delta.leads_contacted_pct }
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                  <DeltaBadge delta={item.delta} pct={item.pct} invertColors={item.invert} />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compareChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span className="text-xs font-semibold text-slate-700">{v}</span>} />
                  <Bar dataKey={compareData.date1.date} fill="#DC2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={compareData.date2.date} fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {detailLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 size={32} className="text-red-600 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading day data...</span>
          </div>
        ) : !dayDetail ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <AlertCircle size={32} className="text-slate-300" />
            <span className="text-sm text-slate-400">No data available</span>
          </div>
        ) : (
          <>
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Activity} label="Total Activities" value={dayDetail.summary.total_activities} />
              <StatCard icon={Phone} label="Calls Made" value={dayDetail.summary.by_type.call || 0} />
              <StatCard icon={Target} label="Leads Converted" value={dayDetail.summary.leads_converted} color="text-emerald-600" iconBg="bg-emerald-50" />
              <StatCard icon={TrendingUp} label="Leads Created" value={dayDetail.summary.leads_created} color="text-blue-600" iconBg="bg-blue-50" />
              <StatCard icon={TrendingDown} label="Leads Lost" value={dayDetail.summary.leads_lost} color="text-red-600" iconBg="bg-red-50" />
              <StatCard icon={Users} label="Leads Contacted" value={dayDetail.summary.leads_contacted} color="text-violet-600" iconBg="bg-violet-50" />
              <StatCard icon={ShieldCheck} label="Vendors Activated" value={dayDetail.activated_vendors?.length || 0} color="text-emerald-600" iconBg="bg-emerald-50" />
              <StatCard icon={Zap} label="New Active Sellers" value={dayDetail.active_sellers?.length || 0} color="text-amber-600" iconBg="bg-amber-50" />
            </div>

            {/* Activity Type Chart + User Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity Type Bar Chart */}
              {typeChartData.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Activity Breakdown</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={typeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {typeChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-User Breakdown */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">User Performance</h3>
                  {selectedUser && (
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700"
                    >
                      ← Back to all
                    </button>
                  )}
                </div>
                {selectedUser ? (
                  // User drill-down: show all activities for this user
                  <div className="max-h-[400px] overflow-y-auto">
                    {(() => {
                      const userActivities = dayDetail.activities.filter(a => a.user_id?._id === selectedUser._id || a.user_id === selectedUser._id);
                      if (userActivities.length === 0) {
                        return (
                          <div className="p-6 text-center">
                            <Activity size={28} className="text-slate-200 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-400">No activities for this user</p>
                          </div>
                        );
                      }
                      return (
                        <div className="divide-y divide-slate-50">
                          {userActivities.map(act => {
                            const Icon = ACTIVITY_ICONS[act.activity_type] || Activity;
                            return (
                              <div key={act._id} className="px-4 py-3 hover:bg-red-50/30 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${ACTIVITY_COLORS[act.activity_type]}15` }}>
                                    <Icon size={14} style={{ color: ACTIVITY_COLORS[act.activity_type] }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-bold text-slate-900 capitalize">{act.activity_type?.replace('_', ' ')}</span>
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(act.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600">{act.description}</p>
                                    {act.lead_id && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400">Vendor:</span>
                                        <span className="text-[10px] font-semibold text-red-600">{act.lead_id.business_name || 'Unknown'}</span>
                                        {act.lead_id.lead_status && (
                                          <span className="text-[10px] text-slate-400">({act.lead_id.lead_status})</span>
                                        )}
                                      </div>
                                    )}
                                    {act.follow_up_required && (
                                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded">
                                        Follow-up: {act.follow_up_date ? new Date(act.follow_up_date).toLocaleDateString() : 'Required'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // User list
                  <>
                    {dayDetail.user_breakdown.length === 0 ? (
                      <div className="p-6 text-center">
                        <Users size={28} className="text-slate-200 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400">No user activity</p>
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50">
                        {dayDetail.user_breakdown.map(user => {
                          const typeMap = {};
                          user.types.forEach(t => { typeMap[t.type] = t.count; });
                          return (
                            <div
                              key={user._id}
                              className="px-4 py-3 hover:bg-red-50/30 transition-colors cursor-pointer"
                              onClick={() => setSelectedUser(user)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs font-extrabold">
                                    {user.user?.name?.[0] || 'U'}
                                  </div>
                                  <span className="text-sm font-bold text-slate-900">{user.user?.name}</span>
                                </div>
                                <span className="text-sm font-extrabold text-red-600">{user.total_activities}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(typeMap).map(([type, count]) => {
                                  const Icon = ACTIVITY_ICONS[type] || Activity;
                                  return (
                                    <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 rounded-md text-[10px] font-bold text-slate-600">
                                      <Icon size={10} style={{ color: ACTIVITY_COLORS[type] }} />
                                      {count}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Clock size={16} className="text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">Activity Timeline</h3>
                <span className="ml-auto text-xs font-bold text-slate-400">{dayDetail.activities.length} activities</span>
              </div>
              {dayDetail.activities.length === 0 ? (
                <div className="p-6 text-center">
                  <Activity size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">No activities recorded</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="relative pl-8 pr-4 py-4">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100" />
                    {dayDetail.activities.slice(0, 50).map((act, i) => {
                      const Icon = ACTIVITY_ICONS[act.activity_type] || Activity;
                      return (
                        <div key={act._id} className="relative mb-4 last:mb-0">
                          <div className="absolute -left-4 top-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ACTIVITY_COLORS[act.activity_type]}15` }}>
                            <Icon size={12} style={{ color: ACTIVITY_COLORS[act.activity_type] }} />
                          </div>
                          <div className="bg-slate-50/50 rounded-xl p-3 hover:bg-red-50/30 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{act.lead_id?.business_name || 'Unknown Lead'}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase" style={{ backgroundColor: `${ACTIVITY_COLORS[act.activity_type]}15`, color: ACTIVITY_COLORS[act.activity_type] }}>
                                  {act.activity_type}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">{act.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1">by {act.user_id?.name || 'Unknown'}</p>
                          </div>
                        </div>
                      );
                    })}
                    {dayDetail.activities.length > 50 && (
                      <p className="text-xs text-slate-400 text-center mt-3">Showing 50 of {dayDetail.activities.length} activities</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Converted / Created / Lost Leads */}
            {[
              { key: 'converted', label: 'Converted Leads', icon: Target, leads: dayDetail.converted_leads, emptyText: 'No conversions today', color: 'text-emerald-600',
                render: (lead) => (
                  <div key={lead._id} className="px-4 py-3 hover:bg-emerald-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-900">{lead.business_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{lead.assigned_user?.name || 'Unassigned'}</span>
                      <span className="text-[10px] text-emerald-600 font-bold">{lead.lead_status}</span>
                    </div>
                  </div>
                )
              },
              { key: 'activated', label: 'Vendors Activated', icon: ShieldCheck, leads: dayDetail.activated_vendors || [], emptyText: 'No vendors activated today', color: 'text-emerald-600',
                render: (lead) => (
                  <div key={lead._id} className="px-4 py-3 hover:bg-emerald-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-900">{lead.business_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{lead.assigned_user?.name || 'Unassigned'}</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Activated</span>
                    </div>
                  </div>
                )
              },
              { key: 'activeSellers', label: 'New Active Sellers', icon: Zap, leads: dayDetail.active_sellers || [], emptyText: 'No new active sellers today', color: 'text-amber-600',
                render: (lead) => (
                  <div key={lead._id} className="px-4 py-3 hover:bg-amber-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-900">{lead.business_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{lead.assigned_user?.name || 'Unassigned'}</span>
                      <span className="text-[10px] text-amber-600 font-bold">Active Seller</span>
                    </div>
                  </div>
                )
              },
              { key: 'created', label: 'Created Leads', icon: TrendingUp, leads: dayDetail.created_leads, emptyText: 'No leads created today', color: 'text-blue-600',
                render: (lead) => (
                  <div key={lead._id} className="px-4 py-3 hover:bg-blue-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-900">{lead.business_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{lead.lead_source || 'Unknown source'}</span>
                      <span className="text-xs text-slate-400">{lead.assigned_user?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                )
              },
              { key: 'lost', label: 'Lost Leads', icon: TrendingDown, leads: dayDetail.lost_leads, emptyText: 'No leads lost today', color: 'text-red-600',
                render: (lead) => (
                  <div key={lead._id} className="px-4 py-3 hover:bg-red-50/30 transition-colors">
                    <p className="text-sm font-bold text-slate-900">{lead.business_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-red-500 font-semibold">{lead.drop_reason || 'No reason'}</span>
                      <span className="text-xs text-slate-400">{lead.assigned_user?.name || 'Unassigned'}</span>
                    </div>
                  </div>
                )
              }
            ].map(section => (
              <div key={section.key} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full px-4 py-3 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <section.icon size={16} className={section.color} />
                  <span className="text-sm font-bold text-slate-900">{section.label}</span>
                  <span className="ml-2 text-xs font-bold text-slate-400">{section.leads.length}</span>
                  <ChevronRight size={14} className={`ml-auto text-slate-400 transition-transform ${expandedSections[section.key] ? 'rotate-90' : ''}`} />
                </button>
                {expandedSections[section.key] && (
                  <div className="border-t border-slate-100 max-h-[300px] overflow-y-auto divide-y divide-slate-50">
                    <LeadList leads={section.leads} emptyIcon={FileText} emptyText={section.emptyText} renderItem={section.render} />
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return null;
}
