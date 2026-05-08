import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { 
  Users, 
  UserCheck, 
  ClipboardList, 
  Clock, 
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  Target,
  Trophy,
  ShoppingBag
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

const StatCard = ({ title, value, icon: Icon, colorClass, trend }) => (
  <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center justify-between mb-2 lg:mb-4">
      <div className={`p-2 lg:p-3 rounded-xl lg:rounded-2xl ${colorClass} transition-transform group-hover:scale-110`}>
        <Icon size={20} className="lg:w-6 lg:h-6" />
      </div>
      {trend && (
        <div className="flex flex-col items-end">
          <span className="text-[8px] lg:text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-0.5">
            <ArrowUpRight size={10} /> {trend}
          </span>
          <span className="text-[7px] lg:text-[9px] text-slate-400 font-bold">vs last month</span>
        </div>
      )}
    </div>
    <div>
      <p className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <h3 className="text-xl lg:text-3xl font-black text-slate-900 mt-1">{value}</h3>
    </div>
  </div>
);

import { API_URL } from '../config/api';

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const { token } = useSelector((state) => state.auth);

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
  }, [token]);

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Synchronizing Data...</p>
    </div>
  );

  const RED_GRADIENT = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

  return (
    <div className="space-y-6 lg:space-y-10 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Real-time Intelligence</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <Link 
            to="/bd-leaderboard" 
            className="flex-1 lg:flex-none px-3 lg:px-5 py-2 lg:py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-yellow-100 transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
          >
            <Trophy size={14} /> <span className="hidden lg:inline">BD Leaderboard</span>
          </Link>
          {stats.__userRole === 'super_admin' && (
            <Link 
              to="/nepalcan-sales" 
              className="flex-1 lg:flex-none px-3 lg:px-5 py-2 lg:py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              <ShoppingBag size={14} /> <span className="hidden lg:inline">Nepalcan Sales</span>
            </Link>
          )}
          <button className="flex-1 lg:flex-none px-3 lg:px-5 py-2 lg:py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
            <Clock size={14} /> {new Date().toLocaleDateString()}
          </button>
          <button className="flex-1 lg:flex-none px-3 lg:px-5 py-2 lg:py-2.5 bg-red-600 text-white rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 whitespace-nowrap">
            <Target size={14} /> Monthly Goals
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <StatCard title="Total Intelligence" value={stats.summary.totalLeads} icon={Users} colorClass="bg-red-50 text-red-600" trend="12.5%" />
        <StatCard title="Onboarded Scale" value={stats.summary.activeSellers} icon={UserCheck} colorClass="bg-emerald-50 text-emerald-600" trend="8.2%" />
        <StatCard title="Field Operations" value={stats.summary.pendingTasks} icon={ClipboardList} colorClass="bg-blue-50 text-blue-600" trend="24.1%" />
        <StatCard title="Pending Review" value={stats.summary.pendingFollowups} icon={Clock} colorClass="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-4 lg:p-8 rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6 lg:mb-10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <h3 className="text-lg lg:text-xl font-black text-slate-900">Intelligence Pipeline Velocity</h3>
            </div>
            <select className="bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase px-4 py-2 outline-none focus:ring-2 focus:ring-red-100">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="h-[250px] lg:h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.leadStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                  labelStyle={{fontWeight: 900, marginBottom: '4px', color: '#0f172a', fontSize: '10px', textTransform: 'uppercase'}}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                  {stats.leadStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RED_GRADIENT[index % RED_GRADIENT.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 p-4 lg:p-8 rounded-2xl lg:rounded-[2.5rem] shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-3 mb-6 lg:mb-10">
            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
            <h3 className="text-lg lg:text-xl font-black text-white">Segment Distribution</h3>
          </div>
          <div className="h-[250px] lg:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.onboardingStats}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="count"
                  nameKey="_id"
                >
                  {stats.onboardingStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RED_GRADIENT[index % RED_GRADIENT.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 lg:mt-8 space-y-3">
            {stats.onboardingStats.slice(0, 4).map((cat, idx) => (
              <div key={cat._id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: RED_GRADIENT[idx % RED_GRADIENT.length]}} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat._id}</span>
                </div>
                <span className="text-xs font-black text-white">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
