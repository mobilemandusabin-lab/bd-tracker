import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { fetchLeads, resetLeads } from '../store/leadSlice';
import { Plus, Search, MoreVertical, Phone, MapPin, ExternalLink, Clock, MessageCircle, X, Upload, Loader2, User, FileSpreadsheet, AlertCircle, Briefcase } from 'lucide-react';
import LeadModal from '../components/LeadModal';
import LeadActionModal from '../components/LeadActionModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { cn } from '../utils/cn';
import * as XLSX from 'xlsx';
import { API_URL } from '../config/api';

const StatusBadge = ({ status }) => {
  const getColors = (s) => {
    switch(s) {
      case 'New': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Contacted': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Interested': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'Meeting Scheduled': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Negotiation': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'Document Pending': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Activated': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getColors(status)}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority, score }) => {
  const getPriorityConfig = (p) => {
    switch(p) {
      case 'Hot': return { 
        colors: 'bg-red-50 text-red-600 border-red-200',
        icon: '🔥',
        label: 'Hot'
      };
      case 'Warm': return { 
        colors: 'bg-orange-50 text-orange-600 border-orange-200',
        icon: '⭐',
        label: 'Warm'
      };
      case 'Cold': return { 
        colors: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: '❄️',
        label: 'Cold'
      };
      default: return { 
        colors: 'bg-slate-50 text-slate-600 border-slate-200',
        icon: '⚪',
        label: 'N/A'
      };
    }
  };

  const config = getPriorityConfig(priority);
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${config.colors}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {score !== undefined && <span className="ml-1 opacity-60">({score})</span>}
    </div>
  );
};

const LeadsPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items: allLeads, loading, hasMore, currentPage } = useSelector((state) => state.leads);
  const { token } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('accepted');
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [loadingMore, setLoadingMore] = useState(false);
  const leadsContainerRef = useRef(null);

  // Bulk Upload Modal states
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState([]);
  const [selectedBulkUser, setSelectedBulkUser] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState([]);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);

  // Helper to refetch leads based on current tab context
  const refetchLeads = useCallback(() => {
    if (activeTab === 'pending') {
      dispatch(fetchLeads({ assignment_status: 'pending', page: 1, limit: 10 }));
    } else if (activeTab === 'recent') {
      dispatch(fetchLeads({ assignment_status: 'accepted', page: 1, limit: 0 }));
    } else if (activeTab === 'accepted') {
      dispatch(fetchLeads({ assignment_status: 'accepted' }));
    } else if (activeTab !== 'followup') {
      dispatch(fetchLeads({ assignment_status: activeTab }));
    }
  }, [activeTab, dispatch]);

  // Initial fetch when tab changes
  useEffect(() => {
    dispatch(resetLeads());
    refetchLeads();
  }, [activeTab, dispatch, refetchLeads]);

  // Load more leads for paginated tabs (pending only)
  const loadMoreLeads = useCallback(() => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    dispatch(fetchLeads({ 
      assignment_status: 'pending', 
      page: currentPage + 1, 
      limit: 10 
    })).finally(() => {
      setLoadingMore(false);
    });
  }, [loadingMore, hasMore, currentPage, dispatch]);

  // Infinite scroll for pending assignments
  useEffect(() => {
    if (activeTab !== 'pending') return;
    
    const handleScroll = (e) => {
      if (loading || loadingMore || !hasMore) return;
      
      const container = e.currentTarget;
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMoreLeads();
      }
    };

    const container = leadsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab, loading, loadingMore, hasMore, loadMoreLeads]);

  // Fetch today's followups
  useEffect(() => {
    const fetchTodayFollowups = async () => {
      setFollowupLoading(true);
      try {
        const res = await axios.get(`${API_URL}/activities/today`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTodayFollowups(res.data.data.followups);
      } catch (err) {
        console.error('Error fetching today followups:', err);
      } finally {
        setFollowupLoading(false);
      }
    };

    if (activeTab === 'followup') {
      fetchTodayFollowups();
    }
  }, [activeTab, token]);

  // Fetch users for bulk upload modal
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBulkUsers(res.data.data.users);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };

    if (isBulkUploadOpen) {
      fetchUsers();
    }
  }, [isBulkUploadOpen, token]);

  // Deep-link intelligence check
  useEffect(() => {
    if (!loading && allLeads.length > 0) {
      const intelligenceId = searchParams.get('intelligence');
      if (intelligenceId) {
        const targetLead = allLeads.find(l => l._id === intelligenceId);
        if (targetLead) {
          setSelectedLead(targetLead);
          setIsDetailModalOpen(true);
          setSearchParams({}, { replace: true });
        }
      }
    }
  }, [loading, allLeads, searchParams, setSearchParams]);

  const handleSuccess = () => {
    refetchLeads();
  };

  const handleDetail = (lead) => {
    setSelectedLead(lead);
    setIsDetailModalOpen(true);
  };

  const handleAction = (lead) => {
    setSelectedLead(lead);
    setIsActionModalOpen(true);
  };

  // Select the appropriate leads based on active tab
  const getActiveLeads = useCallback(() => {
    if (activeTab === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return allLeads.filter(lead => {
        const createdAt = new Date(lead.created_at);
        return createdAt >= sevenDaysAgo;
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (activeTab === 'followup') return allLeads;
    return allLeads.filter(lead => lead.assignment_status === activeTab);
  }, [activeTab, allLeads]);

  const filteredLeads = getActiveLeads().filter(lead => {
    const businessName = lead.business_name || '';
    const contactPerson = lead.contact_person || '';
    const matchesSearch = businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPipeline = pipelineFilter === 'all' || lead.lead_status === pipelineFilter;
    
    return matchesSearch && matchesPipeline;
  }).sort((a, b) => {
    if (sortOption === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortOption === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0;
  });

  // Bulk Upload Handlers
  const handleBulkFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setBulkFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setBulkPreviewData(data);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleBulkUpload = async () => {
    if (!selectedBulkUser) {
      alert('Please select a user to assign the leads');
      return;
    }
    if (!bulkFile) {
      alert('Please select a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('assigned_user', selectedBulkUser);

    try {
      setBulkLoading(true);
      const res = await axios.post(`${API_URL}/leads/bulk-upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      setBulkUploadResults({
        created: res.data.data.created,
        skipped: res.data.data.skipped,
        errors: res.data.data.errors
      });
      
      refetchLeads();
    } catch (err) {
      alert('Bulk upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setBulkLoading(false);
    }
  };

  const resetBulkUpload = () => {
    setBulkFile(null);
    setSelectedBulkUser('');
    setBulkPreviewData([]);
    setBulkUploadResults(null);
  };

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      <LeadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleSuccess} 
        token={token} 
      />
      <LeadActionModal
        isOpen={isActionModalOpen}
        onClose={() => { setIsActionModalOpen(false); setSelectedLead(null); }}
        lead={selectedLead}
        token={token}
        onSuccess={handleSuccess}
      />
      <LeadDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedLead(null); }}
        lead={selectedLead}
        token={token}
      />
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Growth Management</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Lead Repository</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-red-100 transition-all active:scale-95 w-full sm:w-auto"
        >
          <Plus size={18} />
          <span>Capture New Lead</span>
        </button>
        <button 
          onClick={() => setIsBulkUploadOpen(true)}
          className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-sm transition-all active:scale-95 w-full sm:w-auto"
        >
          <Upload size={18} />
          <span>Bulk Upload</span>
        </button>
      </div>

      {/* Tabs and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 lg:gap-4 border-b border-slate-100 pb-px overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('accepted')}
            className={cn(
              "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
              activeTab === 'accepted' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Active Leads
            {activeTab === 'accepted' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={cn(
              "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
              activeTab === 'pending' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Pending Assignments
            {allLeads.filter(l => l.assignment_status === 'pending').length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-[8px] rounded-full">
                {allLeads.filter(l => l.assignment_status === 'pending').length}
              </span>
            )}
            {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('recent')}
            className={cn(
              "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
              activeTab === 'recent' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Recently Added
            {activeTab === 'recent' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('followup')}
            className={cn(
              "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
              activeTab === 'followup' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Follow up Today
            <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] rounded-full">
              New
            </span>
            {activeTab === 'followup' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
          </button>
        </div>

         <div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4">
           <div className="md:col-span-9 relative group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" size={18} />
             <input 
               type="text" 
               placeholder="Search leads..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-12 pr-4 py-3 lg:py-4 bg-white border border-slate-200 rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition-all font-bold text-sm text-slate-800 shadow-sm"
             />
           </div>
           <div className="md:col-span-3">
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
                   <option value="Meeting Scheduled">Meeting Scheduled</option>
                   <option value="Negotiation">Negotiation</option>
                   <option value="Document Pending">Document Pending</option>
                   <option value="Activated">Activated</option>
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

      {/* Leads Table/Grid */}
      <div className="bg-white rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Desktop Table View - Hidden on mobile */}
        <div className="hidden lg:block overflow-x-auto" ref={activeTab === 'pending' ? leadsContainerRef : null}>
          {activeTab === 'followup' ? (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-100">
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Time</th>
                  <th className="w-[25%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Enterprise</th>
                  <th className="w-[30%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Follow-up Note</th>
                  <th className="w-[20%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Key Contact</th>
                  <th className="w-[10%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {followupLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading Follow-ups...</span>
                      </div>
                    </td>
                  </tr>
                ) : todayFollowups.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Clock size={32} className="text-slate-200" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No follow-ups for today</span>
                      </div>
                    </td>
                  </tr>
                ) : todayFollowups.map((followup) => (
                  <tr key={followup._id} className="hover:bg-amber-50/30 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                          <Clock size={12} />
                        </div>
                        <span className="font-black text-slate-900 text-sm">{followup.follow_up_time || 'No Time'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-bold text-slate-900 text-sm truncate">{followup.lead_id?.business_name}</div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                        <MapPin size={8} className="text-red-400" /> {followup.lead_id?.location}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-xs text-slate-600 line-clamp-2 italic">"{followup.description}"</p>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-xs font-bold text-slate-700 truncate">{followup.lead_id?.contact_person}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase">{followup.lead_id?.phone}</div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDetail(followup.lead_id)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-xl shadow-sm transition-all active:scale-95">
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="w-[20%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise</th>
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Contact</th>
                  <th className="w-[10%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="w-[10%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</th>
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline</th>
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                  <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Leads...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Briefcase size={32} className="text-slate-200" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                        <MapPin size={8} className="text-red-400" /> {lead.location}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-xs font-bold text-slate-700 truncate">{lead.contact_person}</div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <a href={`mailto:${lead.email}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 transition-colors uppercase truncate max-w-[150px]">{lead.email}</a>
                        <a href={`tel:${lead.phone}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 transition-colors uppercase">{lead.phone}</a>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{lead.category}</span>
                    </td>
                    <td className="px-6 py-3">
                      <PriorityBadge priority={lead.priority} score={lead.lead_score} />
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={lead.lead_status} />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-[8px] font-black text-white">
                          {lead.assigned_user?.name ? lead.assigned_user.name[0] : 'U'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 truncate">{lead.assigned_user?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a 
                          href={`tel:${lead.phone}`} 
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Call Now"
                          onClick={() => {
                            axios.post(`${API_URL}/activities`, {
                              lead_id: lead._id,
                              activity_type: 'call',
                              description: 'Quick call from lead list',
                              status: 'completed'
                            }, {
                              headers: { Authorization: `Bearer ${token}` }
                            }).catch(err => console.error('Error logging call:', err));
                          }}
                        >
                          <Phone size={14} />
                        </a>
                        <a 
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-all"
                          title="WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </a>
                        <button onClick={() => handleDetail(lead)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><ExternalLink size={14} /></button>
                        <button onClick={() => handleAction(lead)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><MoreVertical size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activeTab === 'pending' && loadingMore && (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          </div>

          {/* Mobile Card View - Only visible on small screens, not for followup tab */}
        {activeTab !== 'followup' ? (
          <div className="block lg:hidden">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Leads...</span>
                </div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Briefcase size={32} className="text-slate-200" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
                </div>
              </div>
            ) : filteredLeads.map((lead) => (
              <div key={lead._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                      <MapPin size={8} className="text-red-400 shrink-0" /> 
                      <span className="truncate">{lead.location}</span>
                    </div>
                  </div>
                  <div className="ml-2 shrink-0">
                    <StatusBadge status={lead.lead_status} />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0">
                    {lead.assigned_user?.name ? lead.assigned_user.name[0] : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-700 truncate">{lead.contact_person}</div>
                    <div className="text-[10px] font-black text-slate-400">{lead.phone}</div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md shrink-0">{lead.category}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <PriorityBadge priority={lead.priority} score={lead.lead_score} />
                  <div className="flex items-center gap-1">
                    <a href={`tel:${lead.phone}`} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all active:scale-95">
                      <Phone size={16} />
                    </a>
                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all active:scale-95">
                      <MessageCircle size={16} />
                    </a>
                    <button onClick={() => handleDetail(lead)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all active:scale-95">
                      <ExternalLink size={16} />
                    </button>
                    <button onClick={() => handleAction(lead)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Mobile List View for Followups
          <div className="lg:hidden divide-y divide-slate-50">
            {followupLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Follow-ups...</p>
              </div>
            ) : todayFollowups.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={40} className="text-slate-200 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No follow-ups for today</p>
              </div>
            ) : todayFollowups.map((followup) => (
              <div key={followup._id} className="p-4 active:bg-amber-50 transition-colors border-l-4 border-amber-500">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-amber-600" />
                    <span className="font-black text-slate-900 text-xs">{followup.follow_up_time || 'No Time'}</span>
                  </div>
                  <button onClick={() => handleDetail(followup.lead_id)} className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400">
                    <ExternalLink size={16} />
                  </button>
                </div>
                <h3 className="font-black text-slate-900 mb-1">{followup.lead_id?.business_name}</h3>
                <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-3">"{followup.description}"</p>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>{followup.lead_id?.contact_person}</span>
                  <a href={`tel:${followup.lead_id?.phone}`} className="text-red-600">{followup.lead_id?.phone}</a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="px-6 lg:px-8 py-4 bg-slate-50/30 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
            {activeTab === 'followup' 
              ? `Showing ${todayFollowups.length} follow-ups scheduled for today`
              : `Showing ${filteredLeads.length} of ${allLeads.length} records`
            }
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <button className="flex-1 sm:flex-none px-4 py-2 text-[9px] lg:text-[10px] font-black text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg uppercase tracking-widest disabled:opacity-50">Prev</button>
            <button className="flex-1 sm:flex-none px-4 py-2 text-[9px] lg:text-[10px] font-black text-red-600 border border-red-100 rounded-lg uppercase tracking-widest">Next</button>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 text-white">
                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
                  <Upload size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-widest">Bulk Upload Leads</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Assign leads to team members</p>
                </div>
              </div>
              <button onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
              {bulkUploadResults ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Created</p>
                      <h3 className="text-3xl font-black text-emerald-700">{bulkUploadResults.created}</h3>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 text-center">
                      <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Skipped</p>
                      <h3 className="text-3xl font-black text-rose-700">{bulkUploadResults.skipped}</h3>
                    </div>
                  </div>

                  {bulkUploadResults.errors.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} className="text-rose-500" />
                        Errors
                      </h4>
                      <div className="bg-slate-50 rounded-[2rem] border border-slate-100 divide-y divide-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                        {bulkUploadResults.errors.map((err, idx) => (
                          <div key={idx} className="p-4 flex items-start gap-4">
                            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-400">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{err}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign to User</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select
                        value={selectedBulkUser}
                        onChange={(e) => setSelectedBulkUser(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all appearance-none"
                      >
                        <option value="">Select User...</option>
                        {bulkUsers.map(user => (
                          <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel File</label>
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50 hover:bg-slate-100 hover:border-red-200 transition-all cursor-pointer group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <FileSpreadsheet className="w-12 h-12 text-slate-300 group-hover:text-red-600 transition-colors mb-4" />
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {bulkFile ? bulkFile.name : 'Click to select Excel file'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">XLSX, XLS or CSV</p>
                      </div>
                      <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkFileChange} />
                    </label>
                  </div>

                  {bulkPreviewData.length > 0 && (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">File loaded: {bulkPreviewData.length} records</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {!bulkUploadResults && (
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                <button 
                  onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }}
                  className="flex-1 px-8 py-4 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100 hover:text-slate-900 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkUpload}
                  disabled={bulkLoading || !bulkFile || !selectedBulkUser}
                  className="flex-[2] px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {bulkLoading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  <span>Upload Leads</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPage;