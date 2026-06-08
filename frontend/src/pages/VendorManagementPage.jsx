import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { Plus, Search, X, ExternalLink, MoreVertical, MapPin, Phone, MessageCircle, RefreshCw, History, ShieldCheck, AlertCircle, Store, Clock, CheckCircle, CalendarCheck, UserMinus } from 'lucide-react';
import { fetchVendors, resetVendors } from '../store/vendorSlice';
import { fetchActiveSellers } from '../store/leadSlice';
import VendorModal from '../components/VendorModal';
import VendorDetailModal from '../components/VendorDetailModal';
import LeadActionModal from '../components/LeadActionModal';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';
import toast from 'react-hot-toast';

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
      case 'Self Registered': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Active Seller': return 'bg-emerald-600 text-white border-emerald-700';
      case 'Lost': return 'bg-slate-600 text-white border-slate-700';
      case 'Verification': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Onboarding': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Proposal Dropped': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getColors(status)}`}>
      {status}
    </span>
  );
};

const VendorManagementPage = () => {
  const dispatch = useDispatch();
  const { items: allVendors, loading, loadingMore: reduxLoadingMore, hasMore, currentPage, pagination } = useSelector((state) => state.vendors);
  const { items: activeSellerItems, loading: activeSellersLoading, pagination: activeSellersPagination } = useSelector((state) => state.leads);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [autoFollowups, setAutoFollowups] = useState([]);
  const [autoFollowupLoading, setAutoFollowupLoading] = useState(false);
  const [followupLoading, setFollowupLoading] = useState(false);
  const vendorsContainerRef = useRef(null);
  const desktopSentinelRef = useRef(null);
  const mobileSentinelRef = useRef(null);

  const VENDOR_STATUSES = ['Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost', 'Self Registered', 'Proposal Dropped'];

  // Determine if a lead is a vendor based on its status
  const isVendor = (lead) => VENDOR_STATUSES.includes(lead.lead_status);

  // Build API params based on active tab
  const buildParams = useCallback((page = 1, limit = 25) => {
    // When searching in "All Vendors" tab, search all types (no type filter)
    const params = { page, limit };
    if (activeTab === 'all' && searchQuery) {
      // No type filter — search everything
    } else {
      params.type = 'vendor';
    }
    if (searchQuery) params.search = searchQuery;
    if (sortOption === 'products_desc' || sortOption === 'products_asc') {
      params.sort_by = sortOption;
    }

    switch (activeTab) {
      case 'verified':
        params.verification_status = 'verified';
        break;
      case 'pending':
        params.verification_status = 'pending';
        break;
      case 'lost':
        params.lead_status = 'Lost';
        break;
      case 'unassigned':
        params.unassigned = 'true';
        break;
      case 'all':
      default:
        break;
    }
    return params;
  }, [activeTab, searchQuery, sortOption]);

  const refetchVendors = useCallback(() => {
    dispatch(resetVendors());
    const sortParam = (sortOption === 'products_desc' || sortOption === 'products_asc') ? { sort_by: sortOption } : {};
    if (activeTab === 'active') {
      dispatch(fetchActiveSellers({ page: 1, limit: 25, search: searchQuery, ...sortParam }));
    } else {
      dispatch(fetchVendors(buildParams(1, 25)));
    }
  }, [dispatch, activeTab, buildParams, searchQuery, sortOption]);

  // Refetch when tab or sort changes
  useEffect(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetVendors());
    const sortParam = (sortOption === 'products_desc' || sortOption === 'products_asc') ? { sort_by: sortOption } : {};
    if (activeTab === 'active') {
      dispatch(fetchActiveSellers({ page: 1, limit: 25, ...sortParam }));
    } else {
      dispatch(fetchVendors(buildParams(1, 25)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortOption, dispatch]);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchTerm);
    dispatch(resetVendors());
    const sortParam = (sortOption === 'products_desc' || sortOption === 'products_asc') ? { sort_by: sortOption } : {};
    if (activeTab === 'active') {
      dispatch(fetchActiveSellers({ page: 1, limit: 25, search: searchTerm, ...sortParam }));
    } else {
      const params = buildParams(1, 25);
      if (searchTerm) params.search = searchTerm;
      dispatch(fetchVendors(params));
    }
  }, [dispatch, searchTerm, buildParams, activeTab, sortOption]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetVendors());
    const sortParam = (sortOption === 'products_desc' || sortOption === 'products_asc') ? { sort_by: sortOption } : {};
    if (activeTab === 'active') {
      dispatch(fetchActiveSellers({ page: 1, limit: 25, ...sortParam }));
    } else {
      dispatch(fetchVendors(buildParams(1, 25)));
    }
  }, [dispatch, buildParams, activeTab, sortOption]);

  // Fetch today's vendor follow-ups
  const fetchTodayFollowups = useCallback(async () => {
    if (!user || !token) return;
    setFollowupLoading(true);
    try {
      const params = user.role === 'super_admin' ? { type: 'vendor' } : { userId: user._id, type: 'vendor' };
      const res = await axios.get(`${API_URL}/activities/today`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodayFollowups(res.data.data?.followUps || []);
    } catch (err) {
      console.error('Error fetching vendor followups:', err);
    } finally {
      setFollowupLoading(false);
    }
  }, [token, user]);

  // Fetch auto follow-ups for vendors
  const fetchAutoFollowups = useCallback(async () => {
    if (!user || !token) return;
    setAutoFollowupLoading(true);
    try {
      const res = await axios.get(`${API_URL}/activities/auto-followups`, {
        params: { type: 'vendor' },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutoFollowups(res.data.data?.followUps || []);
    } catch (err) {
      console.error('Error fetching auto followups:', err);
    } finally {
      setAutoFollowupLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (user && token && activeTab === 'followup') {
      fetchTodayFollowups();
      fetchAutoFollowups();
    }
  }, [activeTab, fetchTodayFollowups, fetchAutoFollowups, user, token]);

  // Check if a vendor has upcoming follow-ups
  const hasUpcomingFollowup = useCallback((vendorId) => {
    return todayFollowups.some(f => f._id === vendorId);
  }, [todayFollowups]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${API_BASE}/nepalcan/sync-vendors-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSyncResult({ type: 'success', ...json.data });
        refetchVendors();
        fetchSyncHistory();
      } else {
        setSyncResult({ type: 'error', message: json.message });
      }
    } catch (err) {
      setSyncResult({ type: 'error', message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${API_BASE}/nepalcan/vendor-sync-logs`, { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      if (json.status === 'success') setSyncHistory(json.data.logs);
    } catch (err) { console.error('Failed to fetch sync history:', err); }
  };

  const loadMoreVendors = useCallback(() => {
    if (reduxLoadingMore || !hasMore) return;
    const sortParam = (sortOption === 'products_desc' || sortOption === 'products_asc') ? { sort_by: sortOption } : {};
    if (activeTab === 'active') {
      dispatch(fetchActiveSellers({ page: currentPage + 1, limit: 25, search: searchQuery, ...sortParam }));
    } else {
      dispatch(fetchVendors(buildParams(currentPage + 1, 25)));
    }
  }, [reduxLoadingMore, hasMore, currentPage, dispatch, buildParams, activeTab, searchQuery, sortOption]);

  // Log the call via API (no side effects)
  const handleCall = async (vendor) => {
    try {
      const res = await axios.post(`${API_URL}/activities/log-call`, {
        lead_id: vendor._id,
        description: 'Quick call from vendor list'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.data.autoCancelled) {
        toast.success('Same-day follow-up automatically completed!', { icon: '✅', duration: 4000 });
      } else if (res.data.data.needsConfirmation) {
        toast('Follow-up scheduled — check your activities', { icon: '📋' });
      } else {
        toast.success('Call logged');
      }

      refetchVendors();
      fetchTodayFollowups();
    } catch (err) {
      console.error('Error logging call:', err);
    }
  };

  // Open tel: link — use anchor tag on mobile, fallback to window.location
  const handleCallClick = (vendor) => {
    const phone = vendor.phone?.replace(/\D/g, '');
    if (phone && phone.length >= 10) {
      window.location.href = `tel:${vendor.phone}`;
    }
    handleCall(vendor);
  };

  // Use correct data source based on active tab
  const displayVendors = activeTab === 'active' ? activeSellerItems : allVendors;
  const isLoading = activeTab === 'active' ? activeSellersLoading : loading;

  // Infinite scroll — two observers: desktop (overflow container) + mobile (viewport)
  useEffect(() => {
    const trigger = () => { if (!isLoading && !reduxLoadingMore && hasMore) loadMoreVendors(); };
    const observers = [];
    const desktopSentinel = desktopSentinelRef.current;
    const mobileSentinel = mobileSentinelRef.current;
    const scrollContainer = vendorsContainerRef.current;
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
  }, [isLoading, reduxLoadingMore, hasMore, loadMoreVendors]);

  const handleDetail = async (vendor) => {
    // If this is a follow-up item (enriched), fetch the full vendor
    if (vendor.activity_id && !vendor.business_name?.includes(vendor.lead_status)) {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
        const res = await fetch(`${API_BASE}/leads/${vendor._id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        if (json.data?.lead) {
          setSelectedVendor(json.data.lead);
          setIsDetailModalOpen(true);
          return;
        }
      } catch (err) { /* fall through */ }
    }
    setSelectedVendor(vendor); setIsDetailModalOpen(true);
  };
  const handleAction = (vendor) => { setSelectedVendor(vendor); setIsActionModalOpen(true); };

  // Sort client-side only for date sorts; product sorts are server-side
  const sortedVendors = [...displayVendors].sort((a, b) => {
    if (sortOption === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sortOption === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    return 0;
  });

  const tabs = [
    { key: 'all', label: 'All Vendors' },
    { key: 'unassigned', label: 'Unassigned', icon: <UserMinus size={13} /> },
    { key: 'verified', label: 'Verified', icon: <ShieldCheck size={13} /> },
    { key: 'pending', label: 'Pending', icon: <AlertCircle size={13} /> },
    { key: 'active', label: 'Active Sellers', icon: <Store size={13} /> },
    { key: 'followup', label: 'Follow-ups', icon: <Clock size={13} /> },
    { key: 'lost', label: 'Lost', icon: <X size={13} /> },
  ];

  // Filter and map follow-ups for display
  const filteredFollowups = (todayFollowups || []).map(f => ({
    ...f,
    display_business_name: f.business_name || 'Unknown Enterprise',
    display_location: f.location || 'N/A',
    display_contact_person: f.contact_person || 'N/A',
    display_phone: f.phone || 'N/A',
    display_message: f.message || f.description || 'No notes available',
    display_category: f.category || 'N/A',
    display_status: f.lead_status || 'New',
    display_manager_name: f.manager?.name || 'Unassigned',
    display_time: f.scheduled_time || f.follow_up_time,
    display_scheduled_for: f.scheduled_for || f.follow_up_date,
    display_activity_id: f.activity_id || f._id
  })).filter(f =>
    !searchTerm ||
    (f.display_business_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_contact_person?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_phone?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_message?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_category?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_manager_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 lg:space-y-6 max-w-[1600px] mx-auto">
      <VendorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refetchVendors} token={token} />
      <VendorDetailModal isOpen={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setSelectedVendor(null); }} vendor={selectedVendor} token={token} user={user} onSuccess={refetchVendors} />
      <LeadActionModal isOpen={isActionModalOpen} onClose={() => { setIsActionModalOpen(false); setSelectedVendor(null); }} lead={selectedVendor} token={token} onSuccess={refetchVendors} />

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1 w-6 bg-white/60 rounded-full" />
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Vendor Management</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Vendor Repository</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white text-red-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-50 transition-all shadow-lg">
              <Plus size={16} /> Add Vendor
            </button>
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white border border-white/25 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-white/25 transition-all disabled:opacity-50 backdrop-blur-sm">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Nepalcan'}
            </button>
            <button onClick={() => { fetchSyncHistory(); setShowSyncHistory(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white/90 border border-white/20 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-white/20 transition-all backdrop-blur-sm">
              <History size={14} /> History
            </button>
          </div>
        </div>
        {syncResult && (
          <div className={cn("mt-3 px-4 py-2 rounded-xl text-xs font-bold", syncResult.type === 'success' ? 'bg-white/20 text-white' : 'bg-red-900/40 text-red-100')}>
            {syncResult.type === 'success' ? `Synced: ${syncResult.created} created, ${syncResult.updated} updated` : `Error: ${syncResult.message}`}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn(
            "flex items-center gap-1.5 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
            activeTab === tab.key ? "text-red-700" : "text-slate-400 hover:text-slate-600"
          )}>
            {tab.icon} {tab.label}
            {activeTab === tab.key && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-red-600 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors pointer-events-none" style={{ zIndex: 10 }} size={16} />
          <input type="text" placeholder="Search by name, phone, email, location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ paddingLeft: '2.75rem' }}
            className="w-full pr-24 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none transition-all font-medium text-sm text-slate-800" />
          {searchTerm && <button onClick={handleClearSearch} className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 z-10"><X size={14} /></button>}
          <button onClick={handleSearch} disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 z-10">Search</button>
        </div>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400">
          <option value="newest">Newest First</option><option value="oldest">Oldest First</option>
          <option value="products_desc">Most Products</option><option value="products_asc">Least Products</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto overflow-y-auto" ref={vendorsContainerRef} style={{ maxHeight: 'calc(100dvh - 400px)' }}>
          {activeTab === 'followup' ? (
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-red-50/50 border-b border-red-100">
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Time</th>
                  <th className="w-[18%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Vendor</th>
                  <th className="w-[12%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Contact</th>
                  <th className="w-[22%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Note</th>
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Pipeline</th>
                  <th className="w-[13%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Manager</th>
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest text-center">Done</th>
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {followupLoading ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading...</span></div></td></tr>
                ) : filteredFollowups.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><Clock size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No follow-ups today</span></td></tr>
                ) : filteredFollowups.map((followup) => (
                  <tr key={followup.display_activity_id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg", followup.is_overdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
                          <Clock size={12} />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("font-bold text-sm", followup.is_overdue ? "text-red-600" : "text-slate-900")}>
                            {followup.display_time ? new Date(`1970-01-01T${followup.display_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : followup.display_scheduled_for ? new Date(followup.display_scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Time'}
                          </span>
                          {followup.is_overdue && <span className="text-[8px] font-black uppercase text-red-500">Overdue</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900 text-sm truncate">{followup.display_business_name}</div>
                        {followup.hasActivity && <CheckCircle size={14} className="text-emerald-600" />}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                        <MapPin size={8} className="text-red-400" /> {followup.display_location}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs font-bold text-slate-700 truncate">{followup.display_contact_person}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{followup.display_phone}</div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[10px] font-medium text-slate-600 line-clamp-2 italic">"{followup.display_message}"</p>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 inline-block bg-slate-100 px-1.5 py-0.5 rounded">{followup.display_category}</span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={followup.display_status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-[8px] font-black text-white">{followup.display_manager_name[0]}</div>
                        <span className="text-[10px] font-bold text-slate-700 truncate">{followup.display_manager_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {followup.hasActivity ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[10px]"><CheckCircle size={12} /> Yes</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-black text-[10px]"><AlertCircle size={12} /> No</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDetail(followup)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-lg transition-all">
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="bg-red-50/50 border-b border-red-100">
                <th className="w-[20%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Enterprise</th>
                <th className="w-[15%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Contact</th>
                <th className="w-[12%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Category</th>
                <th className="w-[10%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Products</th>
                <th className="w-[10%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Verified</th>
                <th className="w-[12%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Pipeline</th>
                <th className="w-[12%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider">Manager</th>
                <th className="w-[9%] px-5 py-3 text-[10px] font-bold text-red-700/70 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="8" className="px-6 py-16 text-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading vendors...</span></td></tr>
              ) : sortedVendors.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-16 text-center"><Store size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">No vendors found</span></td></tr>
              ) : sortedVendors.map((vendor) => (
                <tr key={vendor._id} className="hover:bg-red-50/40 transition-colors group cursor-pointer" onClick={() => handleDetail(vendor)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate group-hover:text-red-700 transition-colors">{vendor.business_name}</span>
                      {searchQuery && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${isVendor(vendor) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isVendor(vendor) ? 'Vendor' : 'Lead'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"><MapPin size={9} className="text-red-400" /> {vendor.location}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs font-semibold text-slate-700 truncate">{vendor.contact_person}</div>
                    <a href={`tel:${vendor.phone}`} className="text-[10px] text-slate-400 hover:text-red-600">{vendor.phone}</a>
                  </td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{vendor.category}</span></td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{vendor.expected_product_count ?? vendor.total_products_listed ?? 0}</span></td>
                  <td className="px-5 py-3">{vendor.is_verified ? <ShieldCheck size={16} className="text-emerald-600" /> : <span className="text-[10px] text-slate-400 font-medium">Pending</span>}</td>
                  <td className="px-5 py-3"><StatusBadge status={vendor.lead_status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-[9px] font-bold text-white">{vendor.assigned_user?.name?.[0] || 'U'}</div>
                      <span className="text-[10px] font-semibold text-slate-700 truncate">{vendor.assigned_user?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${vendor.phone}`} onClick={() => handleCall(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Call"><Phone size={14} /></a>
                      <a href={vendor.phone ? `https://wa.me/${vendor.phone.replace(/\D/g, '')}` : '#'} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="WhatsApp"><MessageCircle size={14} /></a>
                      <button onClick={() => handleDetail(vendor)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="View Details"><ExternalLink size={14} /></button>
                      <button onClick={() => handleAction(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Actions"><MoreVertical size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {reduxLoadingMore && <tr><td colSpan="8" className="px-6 py-4 text-center"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>}
              {hasMore && !isLoading && <tr ref={desktopSentinelRef}><td colSpan="8" className="h-1" /></tr>}
            </tbody>
          </table>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="block lg:hidden">
          {activeTab === 'followup' ? (
            followupLoading ? (
              <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading...</p></div>
            ) : filteredFollowups.length === 0 ? (
              <div className="p-12 text-center"><Clock size={40} className="text-slate-200 mx-auto mb-3" /><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No follow-ups today</p></div>
            ) : filteredFollowups.map((followup) => (
              <div key={followup.display_activity_id} className="p-4 active:bg-red-50/50 transition-colors border-l-4 border-red-500">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1 rounded", followup.is_overdue ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
                      <Clock size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className={cn("font-bold text-xs", followup.is_overdue ? "text-red-600" : "text-slate-900")}>
                        {followup.display_time ? new Date(`1970-01-01T${followup.display_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : followup.display_scheduled_for ? new Date(followup.display_scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No Time'}
                      </span>
                      {followup.is_overdue && <span className="text-[7px] font-black uppercase text-red-500">Overdue</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {followup.hasActivity ? (
                      <span className="p-1 bg-emerald-100 text-emerald-600 rounded"><CheckCircle size={12} /></span>
                    ) : (
                      <span className="p-1 bg-amber-100 text-amber-600 rounded"><AlertCircle size={12} /></span>
                    )}
                    <button onClick={() => handleDetail(followup)} className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400"><ExternalLink size={14} /></button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">{followup.display_business_name}</h3>
                <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-2">"{followup.display_message}"</p>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>{followup.display_contact_person}</span>
                  <a href={`tel:${followup.display_phone}`} className="text-red-600">{followup.display_phone}</a>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                  <span className="text-[9px] font-bold text-slate-500">Manager: {followup.display_manager_name}</span>
                </div>
              </div>
            ))
          ) : (<>
          {isLoading ? (
            <div className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><span className="text-xs font-bold text-slate-400">Loading...</span></div>
          ) : sortedVendors.length === 0 ? (
            <div className="px-4 py-12 text-center"><Store size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-xs font-bold text-slate-400">No vendors found</span></div>
          ) : sortedVendors.map((vendor) => (
            <div key={vendor._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-red-50 cursor-pointer" onClick={() => handleDetail(vendor)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm truncate">{vendor.business_name}</span>
                    {searchQuery && (
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${isVendor(vendor) ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isVendor(vendor) ? 'Vendor' : 'Lead'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5"><MapPin size={9} className="text-red-400 shrink-0" /><span className="truncate">{vendor.location}</span></div>
                </div>
                <div className="ml-2 shrink-0"><StatusBadge status={vendor.lead_status} /></div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0">{vendor.assigned_user?.name?.[0] || 'U'}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-700 truncate">{vendor.contact_person}</div>
                  <div className="text-[10px] text-slate-400">{vendor.phone}</div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">{vendor.category}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{vendor.expected_product_count ?? vendor.total_products_listed ?? 0} products</span>
                  {vendor.is_verified ? <ShieldCheck size={14} className="text-emerald-600" /> : <span className="text-[10px] text-slate-400">Pending</span>}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <a href={`tel:${vendor.phone}`} onClick={() => handleCall(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Call"><Phone size={14} /></a>
                  <a href={vendor.phone ? `https://wa.me/${vendor.phone.replace(/\D/g, '')}` : '#'} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="WhatsApp"><MessageCircle size={14} /></a>
                  <button onClick={() => handleDetail(vendor)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Details"><ExternalLink size={14} /></button>
                  <button onClick={() => handleAction(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Actions"><MoreVertical size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {reduxLoadingMore && <div className="p-4 text-center"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>}
          {hasMore && !isLoading && sortedVendors.length > 0 && <div ref={mobileSentinelRef} className="h-1" />}
          {!hasMore && sortedVendors.length > 0 && <div className="p-4 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">All vendors loaded</span></div>}
          </>
        )}
        </div>
      </div>

      {/* Auto Follow-up Section */}
      {activeTab === 'followup' && autoFollowups.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <h3 className="text-xs font-black text-amber-700 uppercase tracking-wider">Auto Follow-up ({autoFollowups.length})</h3>
          </div>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-100">
                  <th className="w-[20%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Vendor</th>
                  <th className="w-[12%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Contact</th>
                  <th className="w-[10%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Pipeline</th>
                  <th className="w-[30%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Reason</th>
                  <th className="w-[13%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Manager</th>
                  <th className="w-[10%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {autoFollowups.map((item) => (
                  <tr key={item._id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="font-bold text-slate-900 text-sm truncate">{item.display_business_name}</div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                        <MapPin size={8} className="text-amber-400" /> {item.display_location}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="text-xs font-bold text-slate-700 truncate">{item.display_contact_person}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{item.display_phone}</div>
                    </td>
                    <td className="px-5 py-2.5"><StatusBadge status={item.display_status} /></td>
                    <td className="px-5 py-2.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", item.auto_followup_type === 'proposal_dropped' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {item.auto_followup_type === 'proposal_dropped' ? '3-Day Drop' : '7-Day Stale'}
                      </span>
                      <p className="text-[10px] font-medium text-slate-600 mt-1 italic line-clamp-1">{item.display_message}</p>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-amber-500 rounded-md flex items-center justify-center text-[7px] font-black text-white">{item.display_manager_name[0]}</div>
                        <span className="text-[10px] font-bold text-slate-700 truncate">{item.display_manager_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => setSelectedVendor(item)} className="p-1.5 bg-white border border-amber-200 text-amber-400 hover:text-amber-600 hover:border-amber-300 rounded-lg transition-all">
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Cards */}
          <div className="block lg:hidden divide-y divide-amber-50">
            {autoFollowups.map((item) => (
              <div key={item._id} className="p-4 active:bg-amber-50/50 transition-colors border-l-4 border-amber-500">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md", item.auto_followup_type === 'proposal_dropped' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                      {item.auto_followup_type === 'proposal_dropped' ? '3-Day Drop' : '7-Day Stale'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.display_status} />
                    <button onClick={() => setSelectedVendor(item)} className="p-2 bg-white border border-amber-200 text-amber-400 hover:text-amber-600 hover:border-amber-300 rounded-lg transition-all">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">{item.display_business_name}</h3>
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate mb-2">
                  <MapPin size={8} className="text-amber-400" /> {item.display_location}
                </div>
                <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-2">"{item.display_message}"</p>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>{item.display_contact_person}</span>
                  <a href={`tel:${item.display_phone}`} className="text-amber-600">{item.display_phone}</a>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-50">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-amber-500 rounded-md flex items-center justify-center text-[7px] font-black text-white">{item.display_manager_name[0]}</div>
                    <span className="text-[10px] font-bold text-slate-700 truncate">{item.display_manager_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {activeTab === 'followup'
            ? `${todayFollowups.length} follow-ups today`
            : `${sortedVendors.length} of ${(activeTab === 'active' ? activeSellersPagination?.total : pagination?.total) || displayVendors.length} vendors`
          }
        </span>
      </div>

      {/* Sync History Modal */}
      {showSyncHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowSyncHistory(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Sync History</h3>
                <p className="text-xs text-slate-400 mt-0.5">Last 20 sync attempts</p>
              </div>
              <button onClick={() => setShowSyncHistory(false)} className="p-2 hover:bg-red-50 rounded-xl transition-all"><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {syncHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No sync history</p>
              ) : (
                <div className="space-y-2">
                  {syncHistory.map((log, index) => (
                    <div key={index} className={cn("p-4 rounded-xl border", log.success ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200')}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">{log.vendorsSynced} vendors <span className="text-[10px] font-normal text-slate-400 ml-1">({log.durationMs}ms)</span></div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{log.mergedRecords} updated, {log.leadsSynced} created</div>
                      {log.errorMessage && <p className="text-[10px] text-red-600 mt-1">{log.errorMessage}</p>}
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

export default VendorManagementPage;
