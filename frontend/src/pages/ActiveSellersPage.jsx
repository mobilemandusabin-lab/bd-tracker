import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, X, ExternalLink, MoreVertical, MapPin, Briefcase, Phone, MessageCircle, Package, TrendingUp, Award, Sparkles, DollarSign, BarChart3 } from 'lucide-react';
import { fetchActiveSellers, resetLeads } from '../store/leadSlice';
import VendorDetailModal from '../components/VendorDetailModal';
import LeadActionModal from '../components/LeadActionModal';
import { cn } from '../utils/cn';
import { PieChart, Pie, Cell as PieCell, Tooltip as ReTooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const StatusBadge = ({ status }) => {
  const getColors = (s) => {
    switch(s) {
      case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Contacted': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Interested': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Meeting Scheduled': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Negotiation': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Document Pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Activated': return 'bg-red-600 text-white border-red-700';
      case 'Active Seller': return 'bg-emerald-600 text-white border-emerald-700';
      case 'Lost': return 'bg-slate-600 text-white border-slate-700';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };
  return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getColors(status)}`}>{status}</span>;
};

const PerformanceBadge = ({ orderCount }) => {
  if (orderCount >= 50) return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded-md text-[9px] font-bold uppercase tracking-wider"><Award size={9} /> Top</span>;
  if (orderCount >= 20) return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[9px] font-bold uppercase tracking-wider"><TrendingUp size={9} /> Rising</span>;
  if (orderCount >= 5) return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[9px] font-bold uppercase tracking-wider"><Sparkles size={9} /> Consistent</span>;
  return null;
};

const StatCard = ({ icon: Icon, label, value, subValue, delay }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors">
        <Icon size={18} className="text-red-600" />
      </div>
      <span className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl lg:text-3xl font-black text-slate-900">{value}</p>
    {subValue && <p className="text-[10px] font-medium text-slate-400 mt-1">{subValue}</p>}
  </div>
);

const RED_SHADES = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#DC2626', '#EF4444', '#F87171', '#FCA5A5'];

const ActiveSellersPage = () => {
  const dispatch = useDispatch();
  const { items: allSellers, loading, loadingMore: reduxLoadingMore, hasMore, currentPage, pagination, totalRevenue: apiTotalRevenue, totalOrders: apiTotalOrders } = useSelector((state) => state.leads);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState('last_order');
  const sellersContainerRef = useRef(null);
  const desktopSentinelRef = useRef(null);
  const mobileSentinelRef = useRef(null);

  const refetchSellers = useCallback(() => {
    const params = { page: 1, limit: 25 };
    if (searchQuery) params.search = searchQuery;
    dispatch(fetchActiveSellers(params));
  }, [dispatch, searchQuery]);

  useEffect(() => { setSearchTerm(''); setSearchQuery(''); dispatch(resetLeads()); }, [dispatch]);
  useEffect(() => { refetchSellers(); }, [refetchSellers]);

  const handleSearch = useCallback(() => { dispatch(resetLeads()); setSearchQuery(searchTerm); }, [dispatch, searchTerm]);
  const handleClearSearch = useCallback(() => { setSearchTerm(''); setSearchQuery(''); dispatch(resetLeads()); }, [dispatch]);

  const loadMoreSellers = useCallback(() => {
    if (reduxLoadingMore || !hasMore) return;
    const params = { page: currentPage + 1, limit: 25 };
    if (searchQuery) params.search = searchQuery;
    dispatch(fetchActiveSellers(params));
  }, [reduxLoadingMore, hasMore, currentPage, dispatch, searchQuery]);

  // Infinite scroll — two observers: desktop (overflow container) + mobile (viewport)
  useEffect(() => {
    const trigger = () => { if (!loading && !reduxLoadingMore && hasMore) loadMoreSellers(); };
    const observers = [];
    const desktopSentinel = desktopSentinelRef.current;
    const mobileSentinel = mobileSentinelRef.current;
    const scrollContainer = sellersContainerRef.current;
    if (desktopSentinel && scrollContainer) {
      const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) trigger(); }, { root: scrollContainer, rootMargin: '200px' });
      obs.observe(desktopSentinel);
      observers.push(obs);
    }
    if (mobileSentinel) {
      const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) trigger(); }, { root: null, rootMargin: '200px' });
      obs.observe(mobileSentinel);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, [loading, reduxLoadingMore, hasMore, loadMoreSellers]);

  const handleDetail = (seller) => { setSelectedSeller(seller); setIsDetailModalOpen(true); };
  const handleAction = (seller) => { setSelectedSeller(seller); setIsActionModalOpen(true); };

  const filteredSellers = [...allSellers].sort((a, b) => {
    if (sortOption === 'last_order') return new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const totalSellers = filteredSellers.length;
  // Use API totals (fresh from NepalcanOrder aggregation)
  const totalOrders = apiTotalOrders || filteredSellers.reduce((sum, s) => sum + (s.delivered_order_count || 0), 0);
  const totalRevenue = apiTotalRevenue || filteredSellers.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const avgOrdersPerSeller = totalSellers > 0 ? (totalOrders / totalSellers).toFixed(1) : 0;

  const topPerformers = filteredSellers.filter(s => (s.delivered_order_count || 0) >= 50);
  const risingStars = filteredSellers.filter(s => (s.delivered_order_count || 0) >= 20 && (s.delivered_order_count || 0) < 50);
  const consistentSellers = filteredSellers.filter(s => (s.delivered_order_count || 0) >= 5 && (s.delivered_order_count || 0) < 20);

  const chartData = filteredSellers.slice(0, 10).map(s => ({
    name: s.business_name.substring(0, 12) + (s.business_name.length > 12 ? '..' : ''),
    fullName: s.business_name,
    orders: s.delivered_order_count || 0,
    revenue: s.total_revenue || 0,
    seller: s
  }));

  const [chartDrillDown, setChartDrillDown] = useState(null);

  const handleChartClick = (data) => {
    if (data?.seller) {
      setChartDrillDown(data.seller);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6 max-w-[1600px] mx-auto">
      <VendorDetailModal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedSeller(null); }} vendor={selectedSeller} token={token} user={user} onSuccess={refetchSellers} />
      <LeadActionModal isOpen={isActionModalOpen} onClose={() => { setIsActionModalOpen(false); setSelectedSeller(null); }} lead={selectedSeller} token={token} onSuccess={refetchSellers} />

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-1 w-6 bg-white/60 rounded-full" />
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Active Sellers</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Active Sellers Repository</h1>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Total Sellers" value={totalSellers} />
        <StatCard icon={BarChart3} label="Delivered Orders" value={totalOrders.toLocaleString()} />
        <StatCard icon={DollarSign} label="Total Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} />
        <StatCard icon={TrendingUp} label="Avg Orders/Seller" value={avgOrdersPerSeller} />
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-red-600 rounded-full" />
              <h3 className="text-sm font-bold text-slate-900">Top Sellers by Orders</h3>
            </div>
            <div className="h-[220px] lg:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#fef2f2' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(220 38 38 / 0.1)', padding: '10px' }} />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]} barSize={28} onClick={(data) => handleChartClick(data)}>
                    {chartData.map((entry, i) => <Cell key={i} fill={RED_SHADES[i % RED_SHADES.length]} cursor="pointer" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-red-600 rounded-full" />
              <h3 className="text-sm font-bold text-slate-900">Revenue Distribution</h3>
            </div>
            <div className="h-[220px] lg:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="revenue" onClick={(data) => handleChartClick(data)}>
                    {chartData.map((entry, i) => <PieCell key={i} fill={RED_SHADES[i % RED_SHADES.length]} cursor="pointer" />)}
                  </Pie>
                  <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} formatter={(v) => [`Rs. ${v.toLocaleString()}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Performance Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-red-100 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-2"><Award size={16} className="text-white" /></div>
          <p className="text-xl font-black text-slate-900">{topPerformers.length}</p>
          <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">Top (50+)</p>
        </div>
        <div className="bg-white border border-red-100 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2"><TrendingUp size={16} className="text-red-600" /></div>
          <p className="text-xl font-black text-slate-900">{risingStars.length}</p>
          <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">Rising (20-49)</p>
        </div>
        <div className="bg-white border border-red-100 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2"><Sparkles size={16} className="text-red-500" /></div>
          <p className="text-xl font-black text-slate-900">{consistentSellers.length}</p>
          <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">Consistent (5-19)</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors z-10 pointer-events-none" size={16} />
          <input type="text" placeholder="Search sellers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ paddingLeft: '2.75rem' }}
            className="w-full pr-24 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all font-medium text-sm text-slate-800" />
          {searchTerm && <button onClick={handleClearSearch} className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 z-10"><X size={14} /></button>}
          <button onClick={handleSearch} disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 z-10">Search</button>
        </div>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400">
          <option value="last_order">Last Order Date</option>
          <option value="newest">Newest First</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="hidden lg:block overflow-x-auto overflow-y-auto" ref={sellersContainerRef} style={{ maxHeight: 'calc(100dvh - 400px)' }}>
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-red-50/50 border-b border-red-100">
                <th className="w-[18%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Enterprise</th>
                <th className="w-[15%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Contact</th>
                <th className="w-[10%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Orders</th>
                <th className="w-[12%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Revenue</th>
                <th className="w-[10%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Products</th>
                <th className="w-[13%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Pipeline</th>
                <th className="w-[12%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Manager</th>
                <th className="w-[10%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-16 text-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading sellers...</span></td></tr>
              ) : filteredSellers.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-16 text-center"><Package size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">No active sellers found</span></td></tr>
              ) : filteredSellers.map((seller) => (
                <tr key={seller._id} className="hover:bg-red-50/40 transition-colors group cursor-pointer" onClick={() => handleDetail(seller)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 text-sm truncate group-hover:text-red-700 transition-colors">{seller.business_name}</div>
                      <PerformanceBadge orderCount={seller.delivered_order_count || 0} />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"><MapPin size={9} className="text-red-400" /> {seller.location}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs font-semibold text-slate-700 truncate">{seller.contact_person}</div>
                    <a href={`tel:${seller.phone}`} className="text-[10px] text-slate-400 hover:text-red-600">{seller.phone}</a>
                  </td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">{seller.delivered_order_count || 0}</span></td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">Rs. {(seller.total_revenue || 0).toLocaleString()}</span></td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{seller.total_products_listed ?? seller.expected_product_count ?? 0}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={seller.lead_status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-[9px] font-bold text-white">{seller.assigned_user?.name?.[0] || 'U'}</div>
                      <span className="text-[10px] font-semibold text-slate-700 truncate">{seller.assigned_user?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${seller.phone}`} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Phone size={14} /></a>
                      <a href={`https://wa.me/${seller.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><MessageCircle size={14} /></a>
                      <button onClick={() => handleAction(seller)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><MoreVertical size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {reduxLoadingMore && <tr><td colSpan="8" className="px-6 py-4 text-center"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
              {hasMore && !loading && <tr ref={desktopSentinelRef}><td colSpan="8" className="h-1" /></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="block lg:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><span className="text-xs font-bold text-slate-400">Loading...</span></div>
          ) : filteredSellers.length === 0 ? (
            <div className="px-4 py-12 text-center"><Package size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-xs font-bold text-slate-400">No sellers found</span></div>
          ) : filteredSellers.map((seller) => (
            <div key={seller._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-red-50 cursor-pointer" onClick={() => handleDetail(seller)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-slate-900 text-sm truncate">{seller.business_name}</div>
                    <PerformanceBadge orderCount={seller.delivered_order_count || 0} />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"><MapPin size={9} className="text-red-400 shrink-0" /><span className="truncate">{seller.location}</span></div>
                </div>
                <div className="ml-2 shrink-0"><StatusBadge status={seller.lead_status} /></div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0">{seller.assigned_user?.name?.[0] || 'U'}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-700 truncate">{seller.contact_person}</div>
                  <div className="text-[10px] text-slate-400">{seller.phone}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">{seller.delivered_order_count || 0} orders</span>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">Rs. {(seller.total_revenue || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{seller.total_products_listed ?? seller.expected_product_count ?? 0} products</span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleDetail(seller)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><ExternalLink size={14} /></button>
                  <button onClick={() => handleAction(seller)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><MoreVertical size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {reduxLoadingMore && <div className="p-4 text-center"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
          {hasMore && !loading && filteredSellers.length > 0 && <div ref={mobileSentinelRef} className="h-1" />}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{filteredSellers.length} of {pagination?.total || allSellers.length} sellers</span>
      </div>

      {/* Chart Drill-Down Modal */}
      {chartDrillDown && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setChartDrillDown(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center font-extrabold text-xl border border-white/20">
                    {chartDrillDown.business_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg">{chartDrillDown.business_name}</h3>
                    <p className="text-xs text-red-200">{chartDrillDown.contact_person} · {chartDrillDown.phone}</p>
                  </div>
                </div>
                <button onClick={() => setChartDrillDown(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-red-600">{chartDrillDown.delivered_order_count || 0}</p>
                  <p className="text-[10px] font-bold text-red-400 uppercase">Orders</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-red-700">Rs. {(chartDrillDown.total_revenue || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-red-400 uppercase">Revenue</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-extrabold text-red-800">{chartDrillDown.total_products_listed || chartDrillDown.expected_product_count || 0}</p>
                  <p className="text-[10px] font-bold text-red-400 uppercase">Products</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400">Category</span>
                  <span className="text-xs font-bold text-slate-700">{chartDrillDown.category || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400">Location</span>
                  <span className="text-xs font-bold text-slate-700">{chartDrillDown.location || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400">Pipeline</span>
                  <StatusBadge status={chartDrillDown.lead_status} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400">Last Order</span>
                  <span className="text-xs font-bold text-slate-700">{chartDrillDown.last_order_date ? new Date(chartDrillDown.last_order_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-bold text-slate-400">Manager</span>
                  <span className="text-xs font-bold text-slate-700">{chartDrillDown.assigned_user?.name || 'Unassigned'}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setChartDrillDown(null); handleDetail(chartDrillDown); }} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-red-700 transition-all">View Full Details</button>
                <a href={`tel:${chartDrillDown.phone}`} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all"><Phone size={16} /></a>
                <a href={`https://wa.me/${chartDrillDown.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all"><MessageCircle size={16} /></a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveSellersPage;
