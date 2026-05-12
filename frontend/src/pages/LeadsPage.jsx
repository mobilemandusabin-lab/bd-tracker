import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLeads, resetLeads } from '../store/leadSlice';
import { Plus, Search, MoreVertical, Phone, MapPin, ExternalLink, Clock, MessageCircle, Upload, Loader2, User, FileSpreadsheet, AlertCircle, Briefcase, X, CalendarCheck, Brain, CheckCircle } from 'lucide-react';
import LeadModal from '../components/LeadModal';
import LeadActionModal from '../components/LeadActionModal';
import LeadDetailModal from '../components/LeadDetailModal';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/button';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
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
  const { items: allLeads, loading, loadingMore: reduxLoadingMore, hasMore, currentPage } = useSelector((state) => state.leads);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('accepted');
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [pendingFollowups, setPendingFollowups] = useState([]);
  const [followupLoading, setFollowupLoading] = useState(false);
const [pipelineFilter, setPipelineFilter] = useState('all');
   const [sortOption, setSortOption] = useState('newest');
   const leadsContainerRef = useRef(null);

  // Bulk Upload Modal states
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState([]);
  const [selectedBulkUser, setSelectedBulkUser] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState([]);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);

  // Follow-up confirmation modal states
  const [showFollowupConfirm, setShowFollowupConfirm] = useState(false);
  const [followupToCancel, setFollowupToCancel] = useState(null);
  const [followupInfo, setFollowupInfo] = useState(null);

// Helper to refetch leads based on current tab context
const refetchLeads = useCallback(() => {
       const limit = 25; // 25 leads per batch for better performance
       
       // When searching, filter within the currently active tab
       // When not searching, filter by current tab
       if (searchQuery) {
         if (activeTab === 'database') {
           dispatch(fetchLeads({ page: 1, limit, search: searchQuery, all: 'true' }));
         } else if (activeTab === 'pending') {
           dispatch(fetchLeads({ assignment_status: 'pending', page: 1, limit: 10, search: searchQuery }));
         } else if (activeTab === 'recent') {
           // Recent shows both pending (newly assigned) and accepted leads
           dispatch(fetchLeads({ recent: 'true', page: 1, limit, search: searchQuery }));
         } else if (activeTab === 'accepted') {
           dispatch(fetchLeads({ assignment_status: 'accepted', page: 1, limit, search: searchQuery }));
         } else if (activeTab !== 'followup') {
           dispatch(fetchLeads({ assignment_status: activeTab, page: 1, limit: 10, search: searchQuery }));
         } else {
           dispatch(fetchLeads({ page: 1, limit, search: searchQuery }));
         }
       } else if (activeTab === 'pending') {
         dispatch(fetchLeads({ assignment_status: 'pending', page: 1, limit: 10 }));
       } else if (activeTab === 'recent') {
         // Recent shows both pending (newly assigned) and accepted leads for "recently added" view
         dispatch(fetchLeads({ recent: 'true', page: 1, limit }));
       } else if (activeTab === 'accepted') {
         dispatch(fetchLeads({ assignment_status: 'accepted', page: 1, limit }));
       } else if (activeTab !== 'followup' && activeTab !== 'database') {
         dispatch(fetchLeads({ assignment_status: activeTab, page: 1, limit: 10 }));
       }
     }, [activeTab, dispatch, searchQuery]);

// Handle tab changes - reset search
   useEffect(() => {
     setSearchTerm('');
     setSearchQuery('');
     dispatch(resetLeads());
   }, [activeTab, dispatch]);

   // Initial fetch on mount
   useEffect(() => {
     refetchLeads();
   }, []);

// Handle search button click - triggers API call
    const handleSearch = useCallback(() => {
      dispatch(resetLeads());
      setSearchQuery(searchTerm);
    }, [dispatch, searchTerm]);

    // Handle clearing search - resets to active leads
    const handleClearSearch = useCallback(() => {
      setSearchTerm('');
      setSearchQuery('');
      dispatch(resetLeads());
    }, [dispatch]);

   // When searchQuery changes, fetch leads
   useEffect(() => {
     if (activeTab !== 'followup') {
       refetchLeads();
     }
   }, [searchQuery, activeTab, refetchLeads]);

const loadMoreLeads = useCallback(() => {
      if (reduxLoadingMore || !hasMore) return;
      
      const limit = 25; // 25 leads per batch for better performance
      
      // Determine the correct parameters based on active tab
      let params = { page: currentPage + 1, limit };
      if (searchQuery) {
        params.search = searchQuery;
      }
      if (activeTab === 'pending') {
        params.assignment_status = 'pending';
        params.limit = 10;
      } else if (activeTab === 'recent') {
        params.assignment_status = 'accepted';
      } else if (activeTab === 'accepted') {
        params.assignment_status = 'accepted';
      } else if (activeTab !== 'followup' && activeTab !== 'database') {
        params.assignment_status = activeTab;
        params.limit = 10;
      }
      
      dispatch(fetchLeads(params));
   }, [reduxLoadingMore, hasMore, currentPage, dispatch, activeTab, searchQuery]);

// Infinite scroll for accepted, recent, and pending tabs
     useEffect(() => {
      if (activeTab === 'followup' || activeTab === 'database') return; // Don't apply infinite scroll to followup or database tabs
      
      const handleScroll = () => {
       if (loading || reduxLoadingMore || !hasMore) return;
       
       // Check window scroll for mobile
       const scrollTop = window.scrollY || document.documentElement.scrollTop;
       const scrollHeight = document.documentElement.scrollHeight;
       const clientHeight = window.innerHeight;
       
       if (scrollHeight - scrollTop - clientHeight < 200) {
         loadMoreLeads();
       }
     };
     
     // For desktop, check container scroll
     const container = leadsContainerRef.current;
     const desktopScrollHandler = (e) => {
       if (loading || reduxLoadingMore || !hasMore) return;
       
       const scrollTop = e.currentTarget.scrollTop;
       const scrollHeight = e.currentTarget.scrollHeight;
       const clientHeight = e.currentTarget.clientHeight;
       
       if (scrollHeight - scrollTop - clientHeight < 100) {
         loadMoreLeads();
       }
     };
     
     // Add event listeners
     window.addEventListener('scroll', handleScroll);
     if (container) {
       container.addEventListener('scroll', desktopScrollHandler);
     }
     
     return () => {
       window.removeEventListener('scroll', handleScroll);
       if (container) {
         container.removeEventListener('scroll', desktopScrollHandler);
       }
     };
   }, [activeTab, loading, reduxLoadingMore, hasMore, loadMoreLeads]);

// Fetch today's followups
   const fetchTodayFollowups = useCallback(async () => {
     if (!user || !token) return;
     
     setFollowupLoading(true);
     try {
       // For Super Admin, we don't send userId so they see everything by default
       // For others, we send userId to match their assigned leads
       const params = user.role === 'super_admin' ? {} : { userId: user._id };
       
       const res = await axios.get(`${API_URL}/activities/today`, {
         params,
         headers: { Authorization: `Bearer ${token}` }
       });
       // Check for both camelCase and lowercase keys for backward compatibility
       const fetchedFollowups = res.data.data?.followUps || res.data.data?.followups || [];
       setTodayFollowups(fetchedFollowups);
     } catch (err) {
       console.error('Error fetching today followups:', err);
     } finally {
       setFollowupLoading(false);
     }
   }, [token, user]);

  // Check if a lead has upcoming follow-ups
const hasUpcomingFollowup = useCallback((leadId) => {
    return todayFollowups.some(f => f._id === leadId || f.lead_id?._id === leadId);
  }, [todayFollowups]);

useEffect(() => {
     if (user && token) {
       fetchTodayFollowups();
     }
   }, [fetchTodayFollowups, user, token]);

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

// Deep-link intelligence check - fetch lead if needed
  const processedIntelligenceRef = useRef(null);
  const intelligenceParam = searchParams.get('intelligence');

  useEffect(() => {
    if (!intelligenceParam || processedIntelligenceRef.current === intelligenceParam) return;

    const targetLead = allLeads.find(l => l._id === intelligenceParam);
    if (targetLead) {
      setSelectedLead(targetLead);
      setIsDetailModalOpen(true);
      processedIntelligenceRef.current = intelligenceParam;
      setSearchParams({}, { replace: true });
    } else if (token) {
      // Lead not in current list, fetch directly from API
      axios.get(`${API_URL}/leads/${intelligenceParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setSelectedLead(res.data.data.lead);
        setIsDetailModalOpen(true);
        processedIntelligenceRef.current = intelligenceParam;
        setSearchParams({}, { replace: true });
      }).catch(err => {
        console.error('Error fetching lead for intelligence:', err);
        toast.error('Lead not found or access denied');
      });
    }
  }, [intelligenceParam, allLeads, token, setSearchParams]);

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

  // Handle phone call with follow-up check
  const handleCall = async (lead) => {
    try {
      const res = await axios.post(`${API_URL}/activities/log-call`, {
        lead_id: lead._id,
        description: 'Quick call from lead list'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.data.autoCancelled) {
        toast.success('Same-day follow-up automatically completed!', {
          icon: '✅',
          duration: 4000
        });
      }

      if (res.data.data.needsConfirmation) {
        setFollowupInfo(res.data.data.followupInfo);
        setShowFollowupConfirm(true);
      } else if (!res.data.data.autoCancelled) {
        toast.success('Call logged successfully');
      }
      
      refetchLeads();
      fetchTodayFollowups();
    } catch (err) {
      console.error('Error logging call:', err);
    }
  };

  // Handle follow-up decision after user confirmation
  const handleFollowupDecision = async (decision) => {
    if (!followupInfo) return;
    
    try {
      await axios.patch(`${API_URL}/activities/followup/${followupInfo.activity_id}/decision`, { decision }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (decision === 'cancel') {
        toast.success('Follow-up cancelled as per your decision');
      } else {
        toast.success('Follow-up kept for the original scheduled day');
      }

      setShowFollowupConfirm(false);
      setFollowupInfo(null);
      refetchLeads();
      fetchTodayFollowups();
    } catch (err) {
      console.error('Error handling follow-up decision:', err);
    }
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
      if (activeTab === 'database') return allLeads;
      return allLeads.filter(lead => lead.assignment_status === activeTab);
    }, [activeTab, allLeads]);

   const filteredLeads = getActiveLeads().filter(lead => {
      const matchesPipeline = pipelineFilter === 'all' || lead.lead_status === pipelineFilter;
      
      return matchesPipeline;
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

  // Filter followups based on search term
  const filteredFollowups = (todayFollowups || []).map(f => ({
    ...f,
    // Flatten data to ensure compatibility with both raw and enriched API responses
    display_business_name: f.business_name || f.lead_id?.business_name || 'Unknown Enterprise',
    display_location: f.location || f.lead_id?.location || 'N/A',
    display_contact_person: f.contact_person || f.lead_id?.contact_person || 'N/A',
    display_phone: f.phone || f.lead_id?.phone || 'N/A',
    display_message: f.message || f.description || 'No notes available',
    display_category: f.category || f.lead_id?.category || 'N/A',
    display_status: f.lead_status || f.lead_id?.lead_status || 'New',
    display_manager_name: f.manager?.name || f.user_id?.name || 'Unassigned',
    display_time: f.scheduled_time || f.follow_up_time,
    display_scheduled_for: f.scheduled_for || f.follow_up_date,
    display_activity_id: f.activity_id || f._id
  })).filter(f => 
    (f.display_business_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_contact_person?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (f.display_phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
          user={user}
          onSuccess={(updatedLead) => {
            setSelectedLead(updatedLead);
            refetchLeads();
          }}
        />
      <FollowupConfirmModal 
        isOpen={showFollowupConfirm}
        onClose={() => setShowFollowupConfirm(false)}
        onDecision={handleFollowupDecision}
        followupInfo={followupInfo}
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
          <button 
            onClick={() => setActiveTab('database')}
            className={cn(
              "px-4 lg:px-6 py-3 text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
              activeTab === 'database' ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Database Search
            {activeTab === 'database' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />}
          </button>
        </div>

<div className="grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4">
              <div className="md:col-span-12 lg:col-span-6 relative group">
                <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder={activeTab === 'database' 
                    ? "Search by business name, email, phone or address..." 
                    : "Search by business name, contact, phone or email..."}
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
          <div 
            className="hidden lg:block overflow-x-auto overflow-y-auto" 
            ref={leadsContainerRef}
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          >
          {activeTab === 'followup' ? (
<table className="w-full text-left border-collapse table-fixed">
               <thead>
                 <tr className="bg-amber-50/50 border-b border-amber-100">
                   <th className="w-[10%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Time</th>
                   <th className="w-[15%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Enterprise</th>
                   <th className="w-[12%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Key Contact</th>
                   <th className="w-[25%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Follow-up Note</th>
                   <th className="w-[10%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Pipeline</th>
                   <th className="w-[13%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest">Manager</th>
                   <th className="w-[10%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest text-center">Recent Activity</th>
                   <th className="w-[15%] px-6 py-4 text-[9px] font-black text-amber-600 uppercase tracking-widest text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {followupLoading ? (
                   <tr>
                     <td colSpan="8" className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-2">
                         <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading Follow-ups...</span>
                       </div>
                     </td>
                   </tr>
                 ) : filteredFollowups.length === 0 ? (
                   <tr>
                     <td colSpan="8" className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-2">
                         <Clock size={32} className="text-slate-200" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No follow-ups for today</span>
                       </div>
                     </td>
                   </tr>
                ) : filteredFollowups.map((followup) => (
                   <tr key={followup.display_activity_id} className="hover:bg-amber-50/30 transition-colors group">
                     <td className="px-6 py-3">
                       <div className="flex items-center gap-2">
                         <div className={cn(
                           "p-1.5 rounded-lg",
                           followup.is_overdue ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                         )}>
                           <Clock size={12} />
                         </div>
                         <div className="flex flex-col">
                           <span className={cn(
                             "font-black text-sm",
                             followup.is_overdue ? "text-rose-600" : "text-slate-900"
                           )}>
                             {followup.display_time ? (
                               new Date(`1970-01-01T${followup.display_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                             ) : followup.display_scheduled_for ? (
                               new Date(followup.display_scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                             ) : 'No Time'}
                           </span>
                           {followup.is_overdue && (
                             <span className="text-[8px] font-black uppercase text-rose-500">Overdue</span>
                           )}
                         </div>
                       </div>
                     </td>
<td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-900 text-sm truncate">{followup.display_business_name}</div>
                          {followup.hasActivity && (
                            <CheckCircle size={16} className="text-emerald-600" title="Follow-up completed" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                          <MapPin size={8} className="text-red-400" /> {followup.display_location}
                        </div>
                      </td>
                     <td className="px-6 py-3">
                       <div className="text-xs font-bold text-slate-700 truncate">{followup.display_contact_person}</div>
                       <div className="text-[9px] font-black text-slate-400 uppercase">{followup.display_phone}</div>
                     </td>
                     <td className="px-6 py-3">
                       <p className="text-[10px] font-bold text-slate-600 line-clamp-2 italic">"{followup.display_message}"</p>
                       <span className="text-[8px] font-black text-slate-400 uppercase mt-1 inline-block bg-slate-100 px-1.5 py-0.5 rounded">{followup.display_category}</span>
                     </td>
                     <td className="px-6 py-3">
                       <StatusBadge status={followup.display_status} />
                     </td>
                     <td className="px-6 py-3">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center text-[8px] font-black text-white">
                           {followup.display_manager_name[0]}
                         </div>
                         <span className="text-[10px] font-bold text-slate-700 truncate">{followup.display_manager_name}</span>
                       </div>
                     </td>
                     <td className="px-6 py-3 text-center">
                       {followup.hasActivity ? (
                         <span className="inline-flex items-center gap-1 text-green-600 font-black text-[10px]">
                           <span>&#10003;</span> Yes
                         </span>
                       ) : (
                         <span className="inline-flex items-center gap-1 text-amber-600 font-black text-[10px]">
                           <AlertCircle size={14} /> No
                         </span>
                       )}
                     </td>
                     <td className="px-6 py-3 text-right">
                       <button onClick={() => handleDetail(followup)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-xl shadow-sm transition-all active:scale-95">
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
                   <th className="w-[18%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise</th>
                   <th className="w-[13%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Key Contact</th>
                   <th className="w-[9%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                   <th className="w-[9%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</th>
                   <th className="w-[12%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline</th>
                   <th className="w-[11%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                   <th className="w-[11%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Intelligence</th>
                   <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {loading ? (
                   <tr>
                     <td colSpan="8" className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-2">
                         <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Leads...</span>
                       </div>
                     </td>
                   </tr>
                 ) : filteredLeads.length === 0 ? (
                   <tr>
                     <td colSpan="8" className="px-6 py-12 text-center">
                       <div className="flex flex-col items-center gap-2">
                         <Briefcase size={32} className="text-slate-200" />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Records</span>
                       </div>
                     </td>
                   </tr>
                ) : filteredLeads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                        {hasUpcomingFollowup(lead._id) && (
                          <CalendarCheck size={14} className="text-red-600 animate-pulse" title="Upcoming follow-up" />
                        )}
                      </div>
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
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <Brain size={12} className="text-purple-500" />
                        <span className="text-[9px] font-bold text-slate-600">
                          {lead.lead_score || 0}/100
                        </span>
                      </div>
                      <div className="text-[8px] font-black text-slate-400 uppercase mt-0.5">
                        {lead.priority || 'Cold'} Priority
                      </div>
                    </td>
<td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.assignment_status === 'pending' && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await axios.patch(`${API_URL}/leads/${lead._id}/accept`, {}, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success('Assignment accepted');
                                  refetchLeads();
                                } catch (err) {
                                  toast.error(err.response?.data?.message || 'Failed to accept');
                                }
                              }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Accept Assignment"
                            >
                              <CheckCircle size={14} />
                            </button>
                          )}
                          <a 
                            href={`tel:${lead.phone}`} 
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Call Now"
                            onClick={(e) => {
                              e.preventDefault();
                              handleCall(lead);
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
                 {!hasMore && allLeads.length > 0 && !loading && (
                    <tr>
                      <td colSpan="8" className="px-6 py-3 text-center">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more leads to load</span>
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
                    <div className="flex items-center gap-1">
                      <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                      {hasUpcomingFollowup(lead._id) && (
                        <CalendarCheck size={16} className="text-red-600 animate-pulse" title="Upcoming follow-up" />
                      )}
                    </div>
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
                      {lead.assignment_status === 'pending' && (
                        <button 
                          onClick={async () => {
                            try {
                              const res = await axios.patch(`${API_URL}/leads/${lead._id}/accept`, {}, {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              toast.success('Assignment accepted');
                              refetchLeads();
                            } catch (err) {
                              toast.error(err.response?.data?.message || 'Failed to accept');
                            }
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all active:scale-95"
                          title="Accept Assignment"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleCall(lead)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all active:scale-95"
                        title="Call Now"
                      >
                        <Phone size={16} />
                      </button>
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
             {reduxLoadingMore && (
               <div className="p-4 text-center">
                 <div className="flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading more...</span>
                 </div>
               </div>
             )}
             {!hasMore && filteredLeads.length > 0 && !loading && (
               <div className="p-4 text-center">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No more leads to load</span>
               </div>
             )}
           </div>
         ) : (
          // Mobile List View for Followups
          <div className="lg:hidden divide-y divide-slate-50">
            {followupLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Follow-ups...</p>
              </div>
            ) : filteredFollowups.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={40} className="text-slate-200 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No follow-ups for today</p>
              </div>
            ) : filteredFollowups.map((followup) => (
<div key={followup.display_activity_id} className="p-4 active:bg-amber-50 transition-colors border-l-4 border-amber-500">
                 <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-2">
                     <div className={cn(
                       "p-1 bg-amber-100 rounded",
                       followup.is_overdue ? "bg-rose-100 text-rose-600" : "text-amber-600"
                     )}>
                       <Clock size={14} />
                     </div>
                     <div className="flex flex-col">
                       <span className={cn(
                         "font-black text-xs",
                         followup.is_overdue ? "text-rose-600" : "text-slate-900"
                       )}>
                         {followup.display_time ? (
                           new Date(`1970-01-01T${followup.display_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                         ) : followup.display_scheduled_for ? (
                           new Date(followup.display_scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                         ) : 'No Time'}
                       </span>
                       {followup.is_overdue && (
                         <span className="text-[7px] font-black uppercase text-rose-500">Overdue</span>
                       )}
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     {followup.hasActivity ? (
                       <span className="p-1 bg-green-100 text-green-600 rounded">
                         <span className="text-[10px] font-black">&#10003;</span>
                       </span>
                     ) : (
                       <span className="p-1 bg-amber-100 text-amber-600 rounded">
                         <AlertCircle size={12} />
                       </span>
                     )}
                     <button onClick={() => handleDetail(followup)} className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400">
                       <ExternalLink size={16} />
                     </button>
                   </div>
                 </div>
                <h3 className="font-black text-slate-900 mb-1">{followup.display_business_name}</h3>
                <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-3">"{followup.display_message}"</p>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>{followup.display_contact_person}</span>
                  <a href={`tel:${followup.display_phone}`} className="text-red-600">{followup.display_phone}</a>
                </div>
<div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                   <span className="text-[9px] font-black text-slate-500">
                     Manager: {followup.display_manager_name}
                   </span>
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
              : activeTab === 'database'
                ? `Showing ${filteredLeads.length} database search results`
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

// Follow-up confirmation modal component with smooth animations
const FollowupConfirmModal = ({ isOpen, onClose, onDecision, followupInfo }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay asChild>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" 
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed top-[50%] left-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white p-0 shadow-2xl outline-none"
              >
                <div className="px-6 py-4 bg-red-50 border-b border-red-100">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-600" />
                    <DialogPrimitive.Title className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      Follow-up Confirmation Required
                    </DialogPrimitive.Title>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-xs font-bold text-slate-600 mb-4">
                    This lead has a scheduled follow-up. Do you want to keep it or cancel it?
                  </p>
                  {followupInfo && (
                    <div className="bg-slate-50 p-3 rounded-lg mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled for:</p>
                      <p className="text-xs font-bold text-slate-900">
                        {new Date(followupInfo.scheduled_for).toLocaleDateString()} at {followupInfo.scheduled_time || 'No Time'}
                      </p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 mb-1">Note:</p>
                      <p className="text-xs font-bold text-slate-900">"{followupInfo.message}"</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => onDecision('cancel')}
                      className="flex-1 text-xs font-black uppercase tracking-widest border-red-200 text-red-600 hover:bg-red-50"
                    >
                      No, Cancel It
                    </Button>
                    <Button 
                      variant="default" 
                      onClick={() => onDecision('continue')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest"
                    >
                      Yes, Continue
                    </Button>
                  </div>
                </div>
                <DialogPrimitive.Close asChild>
                  <button className="absolute top-4 right-4 rounded-xs p-1 opacity-70 hover:opacity-100">
                    <X size={16} />
                  </button>
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </AnimatePresence>
  );
};