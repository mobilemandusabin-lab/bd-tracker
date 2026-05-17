import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, X, ExternalLink, MoreVertical, MapPin, Briefcase, Phone, MessageCircle, RefreshCw, History, ShieldCheck, AlertCircle } from 'lucide-react';
import { fetchVendors, resetVendors } from '../store/vendorSlice';
import VendorModal from '../components/VendorModal';
import VendorDetailModal from '../components/VendorDetailModal';
import LeadActionModal from '../components/LeadActionModal';
import { cn } from '../utils/cn';

const StatusBadge = ({ status }) => {
  const getColors = (s) => {
    switch(s) {
      case 'New': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Contacted': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Interested': return 'bg-emerald-50 text-emerald-600 border-indigo-100';
      case 'Meeting Scheduled': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Negotiation': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Document Pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Activated': return 'bg-red-600 text-white border-red-700';
      case 'Self Registered': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Active Seller': return 'bg-emerald-600 text-white border-emerald-700';
      case 'Lost': return 'bg-slate-600 text-white border-slate-700';
      case 'Verification': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Onboarding': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getColors(status)}`}>
      {status}
    </span>
  );
};

const VendorManagementPage = () => {
  const dispatch = useDispatch();
  const { items: allVendors, loading, loadingMore: reduxLoadingMore, hasMore, currentPage, pagination } = useSelector((state) => state.vendors);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const vendorsContainerRef = useRef(null);

  const refetchVendors = useCallback(() => {
    const limit = 25;
    const params = { page: 1, limit, type: 'vendor' };
    if (searchQuery) {
      params.search = searchQuery;
    }
    if (pipelineFilter !== 'all') {
      params.lead_status = pipelineFilter;
    }
    dispatch(fetchVendors(params));
  }, [dispatch, searchQuery, pipelineFilter]);

  useEffect(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetVendors());
  }, [activeTab, dispatch]);

  useEffect(() => {
    refetchVendors();
  }, [refetchVendors]);

  const handleSearch = useCallback(() => {
    dispatch(resetVendors());
    setSearchQuery(searchTerm);
  }, [dispatch, searchTerm]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetVendors());
  }, [dispatch]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const API_BASE = import.meta.env.VITE_API_URL || 'http://192.168.25.149:5000/api/v1';
      const res = await fetch(`${API_BASE}/nepalcan/sync-vendors-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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
      const API_BASE = import.meta.env.VITE_API_URL || 'http://192.168.25.149:5000/api/v1';
      const res = await fetch(`${API_BASE}/nepalcan/vendor-sync-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSyncHistory(json.data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      refetchVendors();
    }
  }, [searchQuery, refetchVendors]);

  const loadMoreVendors = useCallback(() => {
    if (reduxLoadingMore || !hasMore) return;

    const limit = 25;
    let params = { page: currentPage + 1, limit, type: 'vendor' };
    if (searchQuery) {
      params.search = searchQuery;
    }
    if (pipelineFilter !== 'all') {
      params.lead_status = pipelineFilter;
    }
    dispatch(fetchVendors(params));
  }, [reduxLoadingMore, hasMore, currentPage, dispatch, searchQuery, pipelineFilter]);

  useEffect(() => {
    if (activeTab === 'all') {
      let ticking = false;

      const handleScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
          if (loading || reduxLoadingMore || !hasMore) {
            ticking = false;
            return;
          }

          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const scrollHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.documentElement.offsetHeight,
            document.body.offsetHeight
          );
          const clientHeight = Math.min(window.innerHeight, screen.height);

          if (scrollHeight - scrollTop - clientHeight < 300) {
            loadMoreVendors();
          }
          ticking = false;
        });
      };

      const container = vendorsContainerRef.current;
      const desktopScrollHandler = (e) => {
        if (loading || reduxLoadingMore || !hasMore) return;

        const scrollTop = e.currentTarget.scrollTop;
        const scrollHeight = e.currentTarget.scrollHeight;
        const clientHeight = e.currentTarget.clientHeight;

        if (scrollHeight - scrollTop - clientHeight < 100) {
          loadMoreVendors();
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      if (container) {
        container.addEventListener('scroll', desktopScrollHandler);
      }

      return () => {
        window.removeEventListener('scroll', handleScroll);
        if (container) {
          container.removeEventListener('scroll', desktopScrollHandler);
        }
      };
    }
  }, [activeTab, loading, reduxLoadingMore, hasMore, loadMoreVendors]);

  const handleDetail = (vendor) => {
    setSelectedVendor(vendor);
    setIsDetailModalOpen(true);
  };

  const handleAction = (vendor) => {
    setSelectedVendor(vendor);
    setIsActionModalOpen(true);
  };

  const filteredVendors = allVendors.filter(vendor => {
    const matchesPipeline = pipelineFilter === 'all' || vendor.lead_status === pipelineFilter;
    const matchesTab = activeTab === 'all' ||
      (activeTab === 'verified' && vendor.verification_status === 'verified') ||
      (activeTab === 'pending' && vendor.lead_status === 'Negotiation') ||
      (activeTab === 'lost' && vendor.lead_status === 'Lost');
    return matchesPipeline && matchesTab;
  }).sort((a, b) => {
    if (sortOption === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortOption === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0;
  });

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      <VendorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetchVendors}
        token={token}
      />
<VendorDetailModal
         isOpen={isDetailModalOpen}
         onClose={() => { setIsDetailModalOpen(false); setSelectedVendor(null); }}
         vendor={selectedVendor}
         token={token}
         user={user}
         onSuccess={refetchVendors}
       />
        <LeadActionModal
          isOpen={isActionModalOpen}
          onClose={() => { setIsActionModalOpen(false); setSelectedVendor(null); }}
          lead={selectedVendor}
          token={token}
          onSuccess={refetchVendors}
        />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Vendor Management</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Vendor Repository</h1>
        </div>
<button
           onClick={() => setIsModalOpen(true)}
           className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-red-100 transition-all active:scale-95 w-full sm:w-auto"
         >
           <Plus size={18} />
           <span>Add New Vendor</span>
         </button>
<button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 w-full sm:w-auto disabled:opacity-50"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync from Nepalcan'}</span>
          </button>
          <button
            onClick={() => { fetchSyncHistory(); setShowSyncHistory(true); }}
            className="flex items-center justify-center gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm transition-all"
          >
            <History size={14} />
            <span>Sync History</span>
          </button>
          {syncResult && (
            <div className={cn(
              "px-3 py-2 rounded-lg text-xs font-bold",
              syncResult.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {syncResult.type === 'success' 
                ? `Synced: ${syncResult.created} created, ${syncResult.updated} updated`
                : `Error: ${syncResult.message}`
              }
            </div>
          )}
      </div>

{/* Tabs and Filters */}
       <div className="space-y-4">
         <div className="flex items-center gap-2 lg:gap-4 border-b border-slate-100 pb-px overflow-x-auto no-scrollbar">
           <button
             onClick={() => setActiveTab('all')}
             className={cn(
               "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
               activeTab === 'all' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
             )}
           >
             All Vendors
             {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
           </button>
           <button
             onClick={() => setActiveTab('verified')}
             className={cn(
               "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
               activeTab === 'verified' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
             )}
           >
             <ShieldCheck size={14} className="inline mr-1" />
             Verified
             {activeTab === 'verified' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
           </button>
           <button
             onClick={() => setActiveTab('pending')}
             className={cn(
               "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
               activeTab === 'pending' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
             )}
           >
             <AlertCircle size={14} className="inline mr-1" />
             Pending
             {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
           </button>
           <button
             onClick={() => setActiveTab('lost')}
             className={cn(
               "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
               activeTab === 'lost' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
             )}
           >
             <X size={14} className="inline mr-1" />
             Lost
             {activeTab === 'lost' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
           </button>
         </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4">
          <div className="md:col-span-12 lg:col-span-6 relative group">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search by business name, contact, phone or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 sm:pl-12 pr-24 py-2.5 sm:py-3 lg:py-4 bg-white border border-slate-200 rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition-all font-bold text-xs sm:text-sm text-slate-800 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-24 top-1/2 -translate-y-1/2 p-0.5 sm:p-1 text-slate-400 hover:text-red-600 transition-colors"
                title="Clear search"
              >
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 px-3 sm:px-4 py-1 sm:py-1.5 bg-red-600 text-white rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
            >
              Search
            </button>
          </div>
          <div className="md:col-span-12 lg:col-span-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pipeline</label>
                <select
                  value={pipelineFilter}
                  onChange={(e) => setPipelineFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-600 font-bold text-sm"
                >
                  <option value="all">All Stages</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Document Pending">Document Pending</option>
                  <option value="Verification">Verification</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Activated">Activated</option>
                  <option value="Active Seller">Active Seller</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sort By</label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-600 font-bold text-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vendors Table/Grid */}
      <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="hidden lg:block overflow-x-auto overflow-y-auto"
          ref={vendorsContainerRef}
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
<tr className="bg-slate-50/50 border-b border-slate-100">
                 <th className="w-[20%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise</th>
                 <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Contact</th>
                 <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                 <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Products</th>
                 <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Verification</th>
                 <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline</th>
                 <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                 <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
{loading ? (
                 <tr>
                   <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Vendors...</span>
                    </div>
                  </td>
                </tr>
) : filteredVendors.length === 0 ? (
                 <tr>
                   <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase size={32} className="text-slate-200" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.map((vendor) => (
                <tr key={vendor._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <div className="font-bold text-slate-900 text-sm truncate">{vendor.business_name}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                      <MapPin size={8} className="text-red-400" /> {vendor.location}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-xs font-bold text-slate-700 truncate">{vendor.contact_person}</div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <a href={`mailto:${vendor.email}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 transition-colors uppercase truncate max-w-[150px]">{vendor.email}</a>
                      <a href={`tel:${vendor.phone}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 transition-colors uppercase">{vendor.phone}</a>
                    </div>
                  </td>
<td className="px-6 py-3">
                     <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{vendor.category}</span>
                   </td>
                   <td className="px-6 py-3">
                     <span className="text-[10px] font-bold text-slate-600 bg-blue-50 px-2 py-0.5 rounded-md">
                       {vendor.expected_product_count ?? vendor.productCount ?? vendor.total_products_listed ?? 0} products
                     </span>
                   </td>
                   <td className="px-6 py-3">
                     {vendor.is_verified ? (
                       <ShieldCheck size={16} className="text-emerald-600" title="Verified" />
                     ) : (
                       <span className="text-[10px] font-bold text-slate-400">Pending</span>
                     )}
                   </td>
                   <td className="px-6 py-3">
                     <StatusBadge status={vendor.lead_status} />
                   </td>
                   <td className="px-6 py-3">
                     <div className="flex items-center gap-2">
                       <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-[8px] font-black text-white">
                         {vendor.assigned_user?.name ? vendor.assigned_user.name[0] : 'U'}
                       </div>
                       <span className="text-[10px] font-bold text-slate-700 truncate">{vendor.assigned_user?.name || 'Unassigned'}</span>
                     </div>
                   </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`tel:${vendor.phone}`}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        title="Call Now"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={`https://wa.me/${vendor.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                        title="WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                      <button onClick={() => handleDetail(vendor)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><ExternalLink size={14} /></button>
                      <button onClick={() => handleAction(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
{reduxLoadingMore && (
                 <tr>
                   <td colSpan="8" className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
                    </div>
                  </td>
                </tr>
              )}
{!hasMore && allVendors.length > 0 && !loading && (
                 <tr>
                   <td colSpan="8" className="px-6 py-3 text-center">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more vendors to load</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden">
          {loading ? (
            <div className="px-4 py-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Vendors...</span>
              </div>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Briefcase size={32} className="text-slate-200" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
              </div>
            </div>
          ) : filteredVendors.map((vendor) => (
            <div key={vendor._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{vendor.business_name}</div>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    <MapPin size={8} className="text-red-400 shrink-0" />
                    <span className="truncate">{vendor.location}</span>
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <StatusBadge status={vendor.lead_status} />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0">
                  {vendor.assigned_user?.name ? vendor.assigned_user.name[0] : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-700 truncate">{vendor.contact_person}</div>
                  <div className="text-[10px] font-black text-slate-400">{vendor.phone}</div>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md shrink-0">{vendor.category}</span>
              </div>

<div className="flex items-center justify-between pt-2 border-t border-slate-50">
                 <div className="flex items-center gap-3">
                   <span className="text-[10px] font-bold text-slate-600 bg-blue-50 px-2 py-1 rounded-md">
                     {vendor.expected_product_count ?? vendor.productCount ?? vendor.total_products_listed ?? 0} products
                   </span>
                   {vendor.is_verified ? (
                     <ShieldCheck size={14} className="text-emerald-600" title="Verified" />
                   ) : (
                     <span className="text-[10px] font-bold text-slate-400">Pending</span>
                   )}
                 </div>
                 <div className="flex items-center gap-1">
                   <button
                     onClick={() => handleDetail(vendor)}
                     className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
                   >
                     <ExternalLink size={16} />
                   </button>
                   <button
                     onClick={() => handleAction(vendor)}
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                   >
                     <MoreVertical size={16} />
                   </button>
                 </div>
               </div>
            </div>
          ))}
          {reduxLoadingMore && (
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
              </div>
            </div>
          )}
          {!hasMore && filteredVendors.length > 0 && !loading && (
            <div className="p-4 text-center">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more vendors to load</span>
            </div>
          )}

          {/* Load More button for mobile */}
          {hasMore && !loading && filteredVendors.length > 0 && (
            <div className="p-4 text-center">
              <button
                onClick={loadMoreVendors}
                disabled={reduxLoadingMore}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50"
              >
                {reduxLoadingMore ? 'Loading...' : 'Load More Vendors'}
              </button>
            </div>
          )}
</div>
       </div>

       {/* Sync History Modal */}
       {showSyncHistory && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <div>
                 <h3 className="text-lg font-black text-slate-900">Vendor Sync History</h3>
                 <p className="text-xs text-slate-500 mt-1">Last 20 sync attempts</p>
               </div>
               <button onClick={() => setShowSyncHistory(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                 <X size={18} className="text-slate-400" />
               </button>
             </div>
             <div className="p-6 overflow-y-auto max-h-[60vh]">
               {syncHistory.length === 0 ? (
                 <p className="text-sm text-slate-400 text-center py-4">No sync history available</p>
               ) : (
                 <div className="space-y-3">
                   {syncHistory.map((log, index) => (
                     <div key={index} className={`p-4 rounded-xl border ${log.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                       <div className="flex items-center justify-between mb-2">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                           {log.success ? 'Success' : 'Failed'}
                         </span>
                         <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                       </div>
                       <div className="text-sm font-bold text-slate-900">
                         {log.vendorsSynced} vendors processed<span className="text-[10px] font-normal text-slate-500 ml-2">({log.durationMs}ms)</span>
                       </div>
                       <div className="text-xs text-slate-600 mt-1">
                         {log.mergedRecords} updated, {log.leadsSynced} created
                       </div>
                       {log.errorMessage && <p className="text-[10px] text-red-600 mt-1">{log.errorMessage}</p>}
                     </div>
                   ))}
                 </div>
               )}
             </div>
           </div>
         </div>
       )}

       {/* Footer Info */}
       <div className="px-6 lg:px-8 py-4 bg-slate-50/30 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
         <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
           Showing {filteredVendors.length} of {pagination?.total || allVendors.length} records
         </span>
         <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
           <button className="flex-1 sm:flex-none px-4 py-2 text-[9px] lg:text-[10px] font-black text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg uppercase tracking-widest disabled:opacity-50">Prev</button>
           <button className="flex-1 sm:flex-none px-4 py-2 text-[9px] lg:text-[10px] font-black text-red-600 border border-red-100 rounded-lg uppercase tracking-widest">Next</button>
         </div>
       </div>
     </div>
   );
};

export default VendorManagementPage;