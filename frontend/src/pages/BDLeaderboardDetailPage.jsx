import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Users, ShoppingCart, Target, Activity as ActivityIcon,
  Trophy, DollarSign, TrendingUp, Flame, Calendar, Clock, Shield
} from 'lucide-react';
import { API_URL } from '../config/api';

const EmptyState = ({ icon, text }) => (
  <div className="text-center py-12 text-slate-400">
    <div className="mx-auto mb-2 text-red-200">{icon}</div>
    <p className="text-xs font-bold uppercase tracking-wider">{text}</p>
  </div>
);

const BDLeaderboardDetailPage = () => {
  const { bdId } = useParams();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const [data, setData] = useState(null);
  const [bdInfo, setBdInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vendors');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [drillRes, leaderboardRes] = await Promise.all([
          axios.get(`${API_URL}/dashboard/bd-leaderboard/${bdId}/drill-down?period=month`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/dashboard/bd-leaderboard-full?period=month`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setData(drillRes.data.data);
        const bd = leaderboardRes.data.data.leaderboard.find(b => b._id === bdId);
        setBdInfo(bd);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bdId, token]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm border border-red-100">
        <Shield size={28} className="text-red-400 mx-auto mb-3" />
        <p className="font-bold text-slate-900 mb-1">No data found</p>
        <button onClick={() => navigate('/analytics#leaderboard')} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Go Back</button>
      </div>
    </div>
  );

  const tabs = [
    { key: 'vendors', label: 'Vendors', icon: <Users size={13} />, count: data.vendors?.length || 0 },
    { key: 'orders', label: 'Orders', icon: <ShoppingCart size={13} />, count: data.orders?.length || 0 },
    { key: 'leads', label: 'Leads', icon: <Target size={13} />, count: data.leads?.length || 0 },
    { key: 'activities', label: 'Activities', icon: <ActivityIcon size={13} />, count: data.activities?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative">
          <button onClick={() => navigate('/analytics#leaderboard')}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-xs font-bold mb-3 transition-colors">
            <ArrowLeft size={14} /> Back to Leaderboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl font-black text-white">{bdInfo?.bd_name?.charAt(0) || '?'}</span>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">{bdInfo?.bd_name || 'BD Details'}</h1>
              <p className="text-xs text-white/60 font-medium mt-1">Monthly performance detail</p>
            </div>
          </div>
          {bdInfo && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
              {[
                { icon: <Target size={14} />, label: 'Leads', value: bdInfo.total_leads || 0 },
                { icon: <TrendingUp size={14} />, label: 'Conv. Rate', value: `${bdInfo.conversion_rate?.toFixed(1) || 0}%` },
                { icon: <DollarSign size={14} />, label: 'Revenue', value: `Rs. ${(bdInfo.total_sales || 0).toLocaleString()}` },
                { icon: <Users size={14} />, label: 'Vendors', value: bdInfo.active_sellers || 0 },
                { icon: <Flame size={14} />, label: 'Score', value: `${bdInfo.overall_score || 0} pts` },
              ].map((stat, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-white/60 mb-1">{stat.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span></div>
                  <p className="text-lg font-extrabold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                ${activeTab === tab.key ? 'text-red-700 border-b-2 border-red-600 bg-red-50/50' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.icon} {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${activeTab === tab.key ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'vendors' && (
            data.vendors?.length > 0 ? (
              <div className="space-y-2">
                {data.vendors.map((v) => (
                  <div key={v._id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-sm"><span className="font-bold text-sm text-white">{v.business_name?.charAt(0) || '?'}</span></div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-slate-900 truncate">{v.business_name}</p><p className="text-[10px] text-slate-400">{v.lead_status}</p></div>
                    <div className="text-right"><p className="font-bold text-sm text-red-700">Rs. {(v.total_revenue || 0).toLocaleString()}</p><p className="text-[10px] text-slate-400">{v.delivered_order_count || 0} orders</p></div>
                  </div>
                ))}
                <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm font-bold text-red-700">Total: <span className="font-black">Rs. {data.vendors.reduce((s, v) => s + (v.total_revenue || 0), 0).toLocaleString()}</span></p>
                </div>
              </div>
            ) : <EmptyState icon={<Users size={28} />} text="No vendors" />
          )}
          {activeTab === 'orders' && (
            data.orders?.length > 0 ? (
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <div key={o._id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><ShoppingCart size={14} className="text-red-600" /></div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-slate-900">{o.orderId}</p><p className="text-[10px] text-slate-400">{o.vendor || 'N/A'}</p></div>
                    <div className="text-right"><p className="font-bold text-sm text-red-700">Rs. {(o.totalAmount || 0).toLocaleString()}</p><p className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</p></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<ShoppingCart size={28} />} text="No orders" />
          )}
          {activeTab === 'leads' && (
            data.leads?.length > 0 ? (
              <div className="space-y-2">
                {data.leads.map((l) => (
                  <div key={l._id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-sm"><span className="font-bold text-sm text-white">{l.business_name?.charAt(0) || '?'}</span></div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-slate-900 truncate">{l.business_name}</p><p className="text-[10px] text-slate-400">{l.lead_status}</p></div>
                    <div className="text-right"><p className="text-[10px] text-slate-400">{new Date(l.created_at).toLocaleDateString()}</p></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<Target size={28} />} text="No leads" />
          )}
          {activeTab === 'activities' && (
            data.activities?.length > 0 ? (
              <div className="space-y-2">
                {data.activities.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><ActivityIcon size={14} className="text-red-600" /></div>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-sm text-slate-900 capitalize">{a.activity_type?.replace('_', ' ')}</p><p className="text-[10px] text-slate-400 truncate">{a.lead_id?.business_name || 'N/A'}</p></div>
                    <div className="text-right"><p className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</p></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={<ActivityIcon size={28} />} text="No activities" />
          )}
        </div>
      </div>
    </div>
  );
};

export default BDLeaderboardDetailPage;
