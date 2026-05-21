import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Trophy, Medal, Star, TrendingUp, Target, ArrowLeft,
  Users, Activity as ActivityIcon, DollarSign, Calendar,
  PieChart as PieChartIcon, Crown, Flame, Zap, Award, ChevronDown,
  Clock, BarChart3, Sparkles, Shield, Search, CheckCircle, X
} from 'lucide-react';
import { API_URL } from '../config/api';
import { fetchGoals } from '../store/goalSlice';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white px-4 py-3 rounded-xl shadow-xl border border-red-100">
      <p className="font-bold text-sm text-slate-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-slate-900">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const PodiumCard = ({ bd, rank, onClick }) => {
  const configs = {
    1: { label: 'CHAMPION', icon: <Crown size={24} className="text-white" /> },
    2: { label: '1ST RUNNER UP', icon: <Medal size={20} className="text-white" /> },
    3: { label: '2ND RUNNER UP', icon: <Medal size={20} className="text-white" /> },
  };
  const config = configs[rank];
  if (!bd || !config) return null;

  const sizes = rank === 1 ? 'w-20 h-20' : 'w-16 h-16';
  const ringSize = rank === 1 ? 'ring-4' : 'ring-2';

  return (
    <div className="flex flex-col items-center cursor-pointer group" onClick={() => onClick(bd._id)}>
      <div className={`${sizes} rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-200 ${ringSize} ring-red-200 mb-3 transition-all duration-300 group-hover:shadow-red-300 group-hover:scale-105`}>
        <span className="text-xl font-black text-white">{bd.bd_name?.charAt(0) || '?'}</span>
        <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center shadow-md border-2 border-white">
          {config.icon}
        </div>
      </div>
      <p className="font-bold text-slate-900 text-sm truncate max-w-[120px] text-center">{bd.bd_name || 'Unknown'}</p>
      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mt-0.5">{config.label}</p>
      <div className="mt-2 px-4 py-1 rounded-full bg-red-600 shadow-md shadow-red-200">
        <span className="text-white font-bold text-sm">{bd.overall_score || 0} pts</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-slate-400">
        <span className="flex items-center gap-1"><Target size={9} className="text-red-500" />{bd.conversion_rate?.toFixed(0) || 0}%</span>
        <span className="flex items-center gap-1"><DollarSign size={9} className="text-red-400" />{bd.total_sales ? `Rs. ${bd.total_sales.toLocaleString()}` : 'Rs. 0'}</span>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, subValue }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center gap-3 mb-2">
      <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">{icon}</div>
      <span className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl lg:text-3xl font-black text-slate-900">{value}</p>
    {subValue && <p className="text-[10px] font-medium text-slate-400 mt-1">{subValue}</p>}
  </div>
);

const RED_SHADES = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'];

const BDLeaderboardPage = ({ embedded }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('score');
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const token = useSelector((state) => state.auth.token);
  const goals = useSelector((state) => state.goals?.items || []);

  useEffect(() => { dispatch(fetchGoals()); }, [dispatch]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/bd-leaderboard-full?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
        setLeaderboard(res.data.data.leaderboard);
      } catch (err) {
        setError('Failed to load leaderboard data');
      } finally { setLoading(false); }
    };
    fetchLeaderboard();
  }, [period, token]);

  const handleBdClick = (bdId) => {
    navigate(`/analytics/leaderboard/${bdId}`);
  };

  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard];
    switch (sortBy) {
      case 'leads': return sorted.sort((a, b) => (b.total_leads || 0) - (a.total_leads || 0));
      case 'conversion': return sorted.sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0));
      case 'revenue': return sorted.sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0));
      default: return sorted.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
    }
  }, [leaderboard, sortBy]);

  const top3 = sortedLeaderboard.slice(0, 3);
  const filteredRest = useMemo(() => {
    const entries = sortedLeaderboard.slice(3);
    if (!searchTerm.trim()) return entries;
    return entries.filter(bd =>
      (bd.bd_name || '').toLowerCase().includes(searchTerm.trim().toLowerCase())
    );
  }, [sortedLeaderboard, searchTerm]);
  const restOfBoard = showAll ? filteredRest : filteredRest.slice(0, 12);

  const totalLeads = leaderboard.reduce((s, b) => s + (b.total_leads || 0), 0);
  const totalConverted = leaderboard.reduce((s, b) => s + (b.converted_leads || 0), 0);
  const totalSales = leaderboard.reduce((s, b) => s + (b.total_sales || 0), 0);
  const overallConversion = totalLeads > 0 ? ((totalConverted / totalLeads) * 100).toFixed(1) : 0;
  const avgScore = leaderboard.length > 0 ? (leaderboard.reduce((s, b) => s + (b.overall_score || 0), 0) / leaderboard.length).toFixed(0) : 0;

  // Goal vs Achievement
  const activeGoals = useMemo(() => {
    const now = new Date();
    return goals.filter(g => g.status === 'active' && new Date(g.end_date) >= now);
  }, [goals]);

  const goalSummary = useMemo(() => {
    if (activeGoals.length === 0) return null;
    const totalTarget = activeGoals.reduce((s, g) => s + (g.target_value || 0), 0);
    const totalCurrent = activeGoals.reduce((s, g) => s + (g.current_value || 0), 0);
    const pct = totalTarget > 0 ? ((totalCurrent / totalTarget) * 100).toFixed(0) : 0;
    return { totalTarget, totalCurrent, pct, count: activeGoals.length };
  }, [activeGoals]);

  const salesChartData = leaderboard.slice(0, 10).map(bd => ({ name: bd.bd_name?.split(' ')[0] || 'N/A', sales: bd.total_sales || 0 }));
  const conversionChartData = leaderboard.slice(0, 10).map(bd => ({ name: bd.bd_name?.split(' ')[0] || 'N/A', rate: bd.conversion_rate || 0 }));
  const radarData = top3[0] ? [
    { metric: 'Conversion', value: top3[0].conversion_rate || 0 },
    { metric: 'Activity', value: Math.min(100, (top3[0].activities || 0) * 2) },
    { metric: 'Revenue', value: Math.min(100, ((top3[0].total_sales || 0) / Math.max(1, totalSales)) * 100 * leaderboard.length) },
    { metric: 'Vendors', value: Math.min(100, (top3[0].active_sellers || 0) * 5) },
    { metric: 'Leads', value: Math.min(100, (top3[0].total_leads || 0) * 2) },
  ] : [];

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50';
    if (score >= 60) return 'text-red-700 bg-red-50';
    if (score >= 40) return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  };
  const getScoreBarColor = () => 'bg-gradient-to-r from-red-400 to-red-600';

  const getRankIcon = (rank) => {
    if (rank === 1) return <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-md"><Crown size={14} className="text-white" /></div>;
    if (rank === 2) return <div className="w-8 h-8 rounded-lg bg-red-400 flex items-center justify-center shadow-md"><Medal size={14} className="text-white" /></div>;
    if (rank === 3) return <div className="w-8 h-8 rounded-lg bg-red-300 flex items-center justify-center shadow-md"><Medal size={14} className="text-white" /></div>;
    return <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center"><span className="font-bold text-xs text-slate-500">#{rank}</span></div>;
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-red-100 rounded-full" />
          <div className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <Trophy size={22} className="absolute inset-0 m-auto text-red-600" />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Leaderboard</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm border border-red-100">
        <Shield size={28} className="text-red-400 mx-auto mb-3" />
        <p className="font-bold text-slate-900 mb-1">Something went wrong</p>
        <p className="text-sm text-slate-400">{error}</p>
      </div>
    </div>
  );

  const periodButtons = [
    { key: 'today', label: 'Today', icon: <Clock size={11} /> },
    { key: 'week', label: 'Week', icon: <Calendar size={11} /> },
    { key: 'month', label: 'Month', icon: <BarChart3 size={11} /> },
    { key: 'quarter', label: 'Quarter', icon: <PieChartIcon size={11} /> },
    { key: 'year', label: 'Year', icon: <Sparkles size={11} /> },
  ];

  return (
    <div className={embedded ? 'space-y-4 lg:space-y-6' : 'space-y-4 lg:space-y-6 max-w-[1600px] mx-auto'}>
      {/* Header — full hero when standalone, compact when embedded */}
      {!embedded ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8">
          <div className="absolute inset-0 hero-pattern opacity-30" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-xs font-bold mb-3 transition-colors">
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">BD Leaderboard</h1>
              <p className="text-xs text-white/60 font-medium mt-1">Performance rankings and conversion analytics</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {periodButtons.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all
                    ${period === p.key ? 'bg-white text-red-700 shadow-lg' : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white border border-white/20'}`}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {periodButtons.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all
                ${period === p.key ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300'}`}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}

      {leaderboard.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-red-100">
          <Trophy size={36} className="text-red-200 mx-auto mb-3" />
          <p className="font-bold text-slate-900 mb-1">No Data Yet</p>
          <p className="text-sm text-slate-400">No performance data for this period</p>
        </div>
      ) : (
        <div className="space-y-4 lg:space-y-6">
          {/* Stat Cards */}
          <div className={`grid grid-cols-2 gap-3 ${goalSummary ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
            <StatCard icon={<Users size={18} className="text-red-600" />} label="Total BDs" value={leaderboard.length} />
            <StatCard icon={<Target size={18} className="text-red-600" />} label="Total Leads" value={totalLeads.toLocaleString()} subValue={`${totalConverted} converted`} />
            <StatCard icon={<TrendingUp size={18} className="text-red-600" />} label="Conv. Rate" value={`${overallConversion}%`} />
            <StatCard icon={<DollarSign size={18} className="text-red-600" />} label="Revenue" value={`Rs. ${totalSales.toLocaleString()}`} />
            <StatCard icon={<Flame size={18} className="text-red-600" />} label="Avg Score" value={avgScore} subValue="pts per BD" />
            {goalSummary && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 rounded-xl"><CheckCircle size={18} className="text-emerald-600" /></div>
                  <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider">Goal vs Achievement</span>
                </div>
                <p className="text-2xl lg:text-3xl font-black text-slate-900">{goalSummary.pct}%</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1">{goalSummary.totalCurrent} of {goalSummary.totalTarget} ({goalSummary.count} active goal{goalSummary.count > 1 ? 's' : ''})</p>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${Math.min(100, goalSummary.pct)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Podium */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-50 rounded-lg"><Award size={18} className="text-red-600" /></div>
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Top Performers</h2>
                  <p className="text-[10px] text-slate-400">Click to view details</p>
                </div>
              </div>
            </div>
            <div className="p-6 lg:p-8">
              <div className="flex items-end justify-center gap-8 lg:gap-14">
                {top3[1] && <PodiumCard bd={top3[1]} rank={2} onClick={handleBdClick} />}
                {top3[0] && <PodiumCard bd={top3[0]} rank={1} onClick={handleBdClick} />}
                {top3[2] && <PodiumCard bd={top3[2]} rank={3} onClick={handleBdClick} />}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-red-600 rounded-full" />
                <h3 className="text-sm font-bold text-slate-900">Revenue by BD</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData}>
                    <defs>
                      <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="sales" name="Revenue" stroke="#DC2626" strokeWidth={2} fill="url(#redGrad)" dot={{ fill: '#DC2626', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-red-600 rounded-full" />
                <h3 className="text-sm font-bold text-slate-900">Conversion Rates</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={conversionChartData} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rate" name="Conv. %" radius={[6, 6, 0, 0]}>
                      {conversionChartData.map((_, i) => <Cell key={i} fill={RED_SHADES[i % RED_SHADES.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-red-600 rounded-full" />
                <h3 className="text-sm font-bold text-slate-900">Top BD Profile</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="65%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke="#DC2626" fill="#DC2626" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: '#DC2626' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-red-600 rounded-full" />
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Full Rankings</h2>
                  <p className="text-[10px] text-slate-400">{sortedLeaderboard.length} members</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Sort:</span>
                {[{ key: 'score', label: 'Score' }, { key: 'leads', label: 'Leads' }, { key: 'conversion', label: 'Conv' }, { key: 'revenue', label: 'Revenue' }].map((s) => (
                  <button key={s.key} onClick={() => setSortBy(s.key)}
                    className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all
                      ${sortBy === s.key ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="px-5 py-3 border-b border-slate-100">
              <div className="relative group max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name..."
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  className="w-full py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Table Header */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-2.5 bg-red-50/50 border-b border-red-100">
              <div className="col-span-1 text-[9px] font-bold text-red-700/60 uppercase tracking-wider">Rank</div>
              <div className="col-span-3 text-[9px] font-bold text-red-700/60 uppercase tracking-wider">Member</div>
              <div className="col-span-1 text-[9px] font-bold text-red-700/60 uppercase tracking-wider text-center">Leads</div>
              <div className="col-span-1 text-[9px] font-bold text-red-700/60 uppercase tracking-wider text-center">Conv</div>
              <div className="col-span-2 text-[9px] font-bold text-red-700/60 uppercase tracking-wider">Rate</div>
              <div className="col-span-1 text-[9px] font-bold text-red-700/60 uppercase tracking-wider text-center">Vendors</div>
              <div className="col-span-1 text-[9px] font-bold text-red-700/60 uppercase tracking-wider text-center">Revenue</div>
              <div className="col-span-2 text-[9px] font-bold text-red-700/60 uppercase tracking-wider text-right">Score</div>
            </div>

            <div className="divide-y divide-slate-100">
              {restOfBoard.length === 0 ? (
                <div className="text-center py-12">
                  {searchTerm.trim() ? (
                    <>
                      <Search size={28} className="text-red-200 mx-auto mb-2" />
                      <p className="font-bold text-sm text-slate-400">No results found</p>
                      <p className="text-xs text-slate-300 mt-1">No members match "{searchTerm.trim()}"</p>
                    </>
                  ) : sortedLeaderboard.length <= 3 ? (
                    <>
                      <Trophy size={28} className="text-red-200 mx-auto mb-2" />
                      <p className="font-bold text-sm text-slate-400">All {sortedLeaderboard.length} member{sortedLeaderboard.length !== 1 ? 's' : ''} shown in podium above</p>
                    </>
                  ) : null}
                </div>
              ) : restOfBoard.map((bd, index) => {
                const rank = index + 4;
                return (
                  <div key={bd._id} className="group hover:bg-red-50/40 cursor-pointer transition-all" onClick={() => handleBdClick(bd._id)}>
                    <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center px-5 py-3">
                      <div className="col-span-1">{getRankIcon(rank)}</div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                            <span className="font-bold text-sm text-red-600">{bd.bd_name?.charAt(0) || '?'}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 group-hover:text-red-700 transition-colors">{bd.bd_name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400">{bd.activities || 0} activities</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-1 text-center"><span className="font-bold text-sm text-slate-700">{bd.total_leads || 0}</span></div>
                      <div className="col-span-1 text-center"><span className="font-bold text-sm text-emerald-600">{bd.converted_leads || 0}</span></div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreBarColor()}`} style={{ width: `${Math.min(100, bd.conversion_rate || 0)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-10 text-right">{bd.conversion_rate?.toFixed(1) || 0}%</span>
                        </div>
                      </div>
                      <div className="col-span-1 text-center"><span className="font-bold text-sm text-red-600">{bd.active_sellers || 0}</span></div>
                      <div className="col-span-1 text-center"><span className="font-bold text-xs text-red-600">{bd.total_sales ? `Rs. ${bd.total_sales.toLocaleString()}` : 'Rs. 0'}</span></div>
                      <div className="col-span-2 text-right">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${getScoreColor(bd.overall_score || 0)}`}>
                          <Flame size={12} /> {bd.overall_score || 0}
                        </span>
                      </div>
                    </div>
                    {/* Mobile */}
                    <div className="lg:hidden p-4">
                      <div className="flex items-start gap-3">
                        {getRankIcon(rank)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-sm text-slate-900 truncate">{bd.bd_name || 'Unknown'}</p>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getScoreColor(bd.overall_score || 0)}`}>{bd.overall_score || 0}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="text-center p-1.5 bg-red-50 rounded-lg"><p className="text-[9px] text-red-500 font-bold">Leads</p><p className="font-bold text-xs text-red-700">{bd.total_leads || 0}</p></div>
                            <div className="text-center p-1.5 bg-emerald-50 rounded-lg"><p className="text-[9px] text-emerald-500 font-bold">Conv</p><p className="font-bold text-xs text-emerald-700">{bd.converted_leads || 0}</p></div>
                            <div className="text-center p-1.5 bg-red-50 rounded-lg"><p className="text-[9px] text-red-500 font-bold">Vendors</p><p className="font-bold text-xs text-red-700">{bd.active_sellers || 0}</p></div>
                            <div className="text-center p-1.5 bg-red-50 rounded-lg"><p className="text-[9px] text-red-500 font-bold">Rev</p><p className="font-bold text-xs text-red-700">{bd.total_sales ? `Rs. ${bd.total_sales.toLocaleString()}` : 'Rs. 0'}</p></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredRest.length > 12 && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button onClick={() => setShowAll(!showAll)} className="px-5 py-2 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-red-100 transition-colors">
                  {showAll ? 'Show Less' : `Show All ${filteredRest.length}`} <ChevronDown size={14} className={`inline ml-1 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default BDLeaderboardPage;
