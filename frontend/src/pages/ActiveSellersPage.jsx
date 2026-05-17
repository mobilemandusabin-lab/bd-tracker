import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, X, ExternalLink, MoreVertical, MapPin, Briefcase, Phone, MessageCircle, RefreshCw, History, Package } from 'lucide-react';
import { fetchActiveSellers, resetLeads } from '../store/leadSlice';
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
      case 'Active Seller': return 'bg-emerald-600 text-white border-emerald-700';
      case 'Lost': return 'bg-slate-600 text-white border-slate-700';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getColors(status)}`}>
      {status}
    </span>
  );
};

const ActiveSellersPage = () => {
  const dispatch = useDispatch();
  const { items: allSellers, loading, loadingMore: reduxLoadingMore, hasMore, currentPage, pagination } = useSelector((state) => state.leads);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState('last_order');
  const sellersContainerRef = useRef(null);

  const refetchSellers = useCallback(() => {
    const limit = 25;
    const params = { page: 1, limit };
    if (searchQuery) {
      params.search = searchQuery;
    }
    dispatch(fetchActiveSellers(params));
  }, [dispatch, searchQuery]);

  useEffect(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetLeads());
  }, [dispatch]);

  useEffect(() => {
    refetchSellers();
  }, [refetchSellers]);

  const handleSearch = useCallback(() => {
    dispatch(resetLeads());
    setSearchQuery(searchTerm);
  }, [dispatch, searchTerm]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetLeads());
  }, [dispatch]);

  const loadMoreSellers = useCallback(() => {
    if (reduxLoadingMore || !hasMore) return;

    const limit = 25;
    const params = { page: currentPage + 1, limit };
    if (searchQuery) {
      params.search = searchQuery;
    }
    dispatch(fetchActiveSellers(params));
  }, [reduxLoadingMore, hasMore, currentPage, dispatch, searchQuery]);

  useEffect(() => {
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
          loadMoreSellers();
        }
        ticking = false;
      });
    };

    const container = sellersContainerRef.current;
    const desktopScrollHandler = (e) => {
      if (loading || reduxLoadingMore || !hasMore) return;

      const scrollTop = e.currentTarget.scrollTop;
      const scrollHeight = e.currentTarget.scrollHeight;
      const clientHeight = e.currentTarget.clientHeight;

      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMoreSellers();
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
  }, [loading, reduxLoadingMore, hasMore, loadMoreSellers]);

  const handleDetail = (seller) => {
    setSelectedSeller(seller);
    setIsDetailModalOpen(true);
  };

  const handleAction = (seller) => {
    setSelectedSeller(seller);
    setIsActionModalOpen(true);
  };

  const filteredSellers = [...allSellers].sort((a, b) => {
    if (sortOption === 'last_order') {
      return new Date(b.last_order_date) - new Date(a.last_order_date);
    } else if (sortOption === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    return 0;
  });

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      <VendorDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSeller(null); }}
        vendor={selectedSeller}
        token={token}
        user={user}
        onSuccess={refetchSellers}
      />
      <LeadActionModal
        isOpen={isActionModalOpen}
        onClose={() => { setIsActionModalOpen(false); setSelectedSeller(null); }}
        lead={selectedSeller}
        token={token}
        onSuccess={refetchSellers}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-emerald-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Active Sellers</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Active Sellers Repository</h1>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4">
          <div className="md:col-span-12 lg:col-span-6 relative group">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search by business name, contact, phone or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 sm:pl-12 pr-24 py-2.5 sm:py-3 lg:py-4 bg-white border border-slate-200 rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all font-bold text-xs sm:text-sm text-slate-800 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-24 top-1/2 -translate-y-1/2 p-0.5 sm:p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                title="Clear search"
              >
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 px-3 sm:px-4 py-1 sm:py-1.5 bg-emerald-600 text-white rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              Search
            </button>
          </div>
          <div className="md:col-span-12 lg:col-span-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sort By</label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 font-bold text-sm"
                >
                  <option value="last_order">Last Order Date</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sellers Table/Grid */}
      <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div
          className="hidden lg:block overflow-x-auto overflow-y-auto"
          ref={sellersContainerRef}
          style={{ maxHeight: 'calc(100vh - 320px)' }}
        >
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="w-[20%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Contact</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Orders</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Products</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading Active Sellers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-slate-200" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Active Sellers Found</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSellers.map((seller) => (
                <tr key={seller._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <div className="font-bold text-slate-900 text-sm truncate">{seller.business_name}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                      <MapPin size={8} className="text-emerald-400" /> {seller.location}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-xs font-bold text-slate-700 truncate">{seller.contact_person}</div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <a href={`mailto:${seller.email}`} className="text-[9px] font-black text-slate-400 hover:text-emerald-600 transition-colors uppercase truncate max-w-[150px]">{seller.email}</a>
                      <a href={`tel:${seller.phone}`} className="text-[9px] font-black text-slate-400 hover:text-emerald-600 transition-colors uppercase">{seller.phone}</a>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {seller.delivered_order_count || 0} delivered
                    </span>
                  </td>
<td className="px-6 py-3">
                     <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{seller.total_products_listed ?? seller.expected_product_count ?? 0}</span>
                   </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={seller.lead_status} />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-[8px] font-black text-white">
                        {seller.assigned_user?.name ? seller.assigned_user.name[0] : 'U'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 truncate">{seller.assigned_user?.name || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`tel:${seller.phone}`}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                        title="Call Now"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={`https://wa.me/${seller.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                        title="WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                      <button onClick={() => handleDetail(seller)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><ExternalLink size={14} /></button>
                      <button onClick={() => handleAction(seller)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><MoreVertical size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {reduxLoadingMore && (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!hasMore && allSellers.length > 0 && !loading && (
                <tr>
                  <td colSpan="7" className="px-6 py-3 text-center">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more sellers to load</span>
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
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading Active Sellers...</span>
              </div>
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Package size={32} className="text-slate-200" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
              </div>
            </div>
          ) : filteredSellers.map((seller) => (
            <div key={seller._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{seller.business_name}</div>
                  <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    <MapPin size={8} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{seller.location}</span>
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <StatusBadge status={seller.lead_status} />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0">
                  {seller.assigned_user?.name ? seller.assigned_user.name[0] : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-700 truncate">{seller.contact_person}</div>
                  <div className="text-[10px] font-black text-slate-400">{seller.phone}</div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                  {seller.delivered_order_count || 0} orders
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
<span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                   {seller.total_products_listed ?? seller.expected_product_count ?? 0} products
                 </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDetail(seller)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    onClick={() => handleAction(seller)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all active:scale-95"
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
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
              </div>
            </div>
          )}
          {!hasMore && filteredSellers.length > 0 && !loading && (
            <div className="p-4 text-center">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more sellers to load</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 lg:px-8 py-4 bg-slate-50/30 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
          Showing {filteredSellers.length} of {pagination?.total || allSellers.length} records
        </span>
      </div>
    </div>
  );
};

export default ActiveSellersPage;