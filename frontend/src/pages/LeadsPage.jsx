import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Upload, X, Search, ChevronDown, Filter, Download, FileSpreadsheet, Loader2, Clock, CheckCircle, MapPin, Briefcase, CalendarCheck, Phone, User, AlertCircle, ExternalLink, Brain, MessageCircle, MoreVertical, BarChart3 } from 'lucide-react';
import { fetchLeads, resetLeads } from '../store/leadSlice';
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
      case 'Document Pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Activated': return 'bg-red-600 text-white border-red-700';
      case 'Self Registered': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'Proposal Dropped': return 'bg-rose-50 text-rose-600 border-rose-100';
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
      case 'Hot': return { colors: 'bg-red-50 text-red-600 border-red-200', icon: '🔥', label: 'Hot' };
      case 'Warm': return { colors: 'bg-orange-50 text-orange-600 border-orange-200', icon: '⭐', label: 'Warm' };
      case 'Cold': return { colors: 'bg-blue-50 text-blue-600 border-blue-200', icon: '❄️', label: 'Cold' };
      default: return { colors: 'bg-slate-50 text-slate-600 border-slate-200', icon: '⚪', label: 'N/A' };
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
  const { items: allLeads, loading, loadingMore: reduxLoadingMore, hasMore, currentPage, pagination } = useSelector((state) => state.leads);
  const { token, user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('accepted');
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [autoFollowups, setAutoFollowups] = useState([]);
  const [autoFollowupLoading, setAutoFollowupLoading] = useState(false);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [pipelineStages, setPipelineStages] = useState([]);
  const leadsContainerRef = useRef(null);
  const desktopSentinelRef = useRef(null);
  const mobileSentinelRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';

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
  const [followupInfo, setFollowupInfo] = useState(null);

  // Helper to refetch leads based on current tab context
  const refetchLeads = useCallback(() => {
    const limit = 25;

    if (searchQuery) {
      if (activeTab === 'database') {
        dispatch(fetchLeads({ page: 1, limit, search: searchQuery, all: 'true', type: 'lead' }));
      } else if (activeTab === 'pending') {
        dispatch(fetchLeads({ assignment_status: 'pending', page: 1, limit: 10, search: searchQuery, type: 'lead' }));
      } else if (activeTab === 'recent') {
        dispatch(fetchLeads({ recent: 'true', page: 1, limit, search: searchQuery, type: 'lead' }));
      } else if (activeTab === 'accepted') {
        dispatch(fetchLeads({ assignment_status: 'accepted', page: 1, limit, search: searchQuery, type: 'lead' }));
      } else if (activeTab !== 'followup') {
        dispatch(fetchLeads({ assignment_status: activeTab, page: 1, limit: 10, search: searchQuery, type: 'lead' }));
      } else {
        dispatch(fetchLeads({ page: 1, limit, search: searchQuery, type: 'lead' }));
      }
    } else if (activeTab === 'pending') {
      dispatch(fetchLeads({ assignment_status: 'pending', page: 1, limit: 10, type: 'lead' }));
    } else if (activeTab === 'recent') {
      dispatch(fetchLeads({ recent: 'true', page: 1, limit, type: 'lead' }));
    } else if (activeTab === 'accepted') {
      dispatch(fetchLeads({ assignment_status: 'accepted', page: 1, limit, type: 'lead' }));
    } else if (activeTab !== 'followup' && activeTab !== 'database') {
      dispatch(fetchLeads({ assignment_status: activeTab, page: 1, limit: 10, type: 'lead' }));
    } else {
      dispatch(fetchLeads({ page: 1, limit, type: 'lead' }));
    }
  }, [activeTab, dispatch, searchQuery]);

  // Fetch pipeline stages for filter dropdown
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/v1/settings/pipeline?category=lead', { headers })
      .then(r => r.json())
      .then(d => setPipelineStages(d.data?.stages || []))
      .catch(() => {});
  }, [token]);

  // Handle tab changes - reset search
  useEffect(() => {
    setSearchTerm('');
    setSearchQuery('');
    dispatch(resetLeads());
  }, [activeTab, dispatch]);

  // Initial fetch on mount using refetchLeads
  useEffect(() => {
    refetchLeads();
  }, [refetchLeads]);

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

    const limit = 25;

    let params = { page: currentPage + 1, limit, type: 'lead' };
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

  // Infinite scroll — two observers: desktop (overflow container) + mobile (viewport)
  useEffect(() => {
    if (activeTab === 'followup' || activeTab === 'database') return;
    const trigger = () => { if (!loading && !reduxLoadingMore && hasMore) loadMoreLeads(); };
    const observers = [];
    const desktopSentinel = desktopSentinelRef.current;
    const mobileSentinel = mobileSentinelRef.current;
    const scrollContainer = leadsContainerRef.current;
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
  }, [activeTab, loading, reduxLoadingMore, hasMore, loadMoreLeads]);

  // Fetch today's followups
  const fetchTodayFollowups = useCallback(async () => {
    if (!user || !token) return;

    setFollowupLoading(true);
    try {
      const params = user.role === 'super_admin' ? {} : { userId: user._id };

      const res = await axios.get(`${API_URL}/activities/today`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const fetchedFollowups = res.data.data?.followUps || res.data.data?.followups || [];
      setTodayFollowups(fetchedFollowups);
    } catch (err) {
      console.error('Error fetching today followups:', err);
    } finally {
      setFollowupLoading(false);
    }
  }, [token, user]);

  // Fetch auto follow-ups (stale leads)
  const fetchAutoFollowups = useCallback(async () => {
    if (!user || !token) return;
    setAutoFollowupLoading(true);
    try {
      const res = await axios.get(`${API_URL}/activities/auto-followups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutoFollowups(res.data.data?.followUps || []);
    } catch (err) {
      console.error('Error fetching auto followups:', err);
    } finally {
      setAutoFollowupLoading(false);
    }
  }, [token, user]);

  // Check if a lead has upcoming follow-ups
  const hasUpcomingFollowup = useCallback((leadId) => {
    return todayFollowups.some(f => f._id === leadId || f.lead_id?._id === leadId);
  }, [todayFollowups]);

  useEffect(() => {
    if (user && token) {
      fetchTodayFollowups();
      fetchAutoFollowups();
    }
  }, [fetchTodayFollowups, fetchAutoFollowups, user, token]);

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

  // Handle phone call with follow-up check - opens call and intelligence view
  const handleCall = async (lead) => {
    try {
      setSelectedLead(lead);
      setIsDetailModalOpen(true);

      const res = await axios.post(`${API_URL}/activities/log-call`, {
        lead_id: lead._id,
        description: 'Quick call from lead list'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.data.autoCancelled) {
        toast.success('Same-day follow-up automatically completed!', { icon: '✅', duration: 4000 });
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

  // Handle phone call with tel: link - starts call then opens intelligence view
  const handleCallWithTel = (lead) => {
    const phone = lead.phone?.replace(/\D/g, '');
    if (phone && phone.length >= 10) {
      window.location.href = `tel:${lead.phone}`;
    }
    handleCall(lead);
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

  const getActiveLeads = useCallback(() => {
    if (activeTab === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      let filtered = allLeads.filter(lead => {
        const createdAt = new Date(lead.created_at);
        return createdAt >= sevenDaysAgo;
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (!isSuperAdmin && activeTab === 'recent') {
        filtered = filtered.filter(lead => lead.assigned_user && lead.assigned_user._id === user?._id);
      }
      return filtered;
    }
    if (activeTab === 'followup') {
      return allLeads;
    }
    if (activeTab === 'database') return allLeads;

    return allLeads.filter(lead => {
      if (!isSuperAdmin && lead.assigned_user?._id !== user?._id) {
        return false;
      }
      if (activeTab === 'accepted') {
        return lead.assignment_status === 'accepted';
      }
      return lead.assignment_status === activeTab;
    });
  }, [activeTab, allLeads, isSuperAdmin, user]);

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

  const tabs = [
    { key: 'accepted', label: 'Active Leads' },
    { key: 'pending', label: 'Pending', badge: allLeads.filter(l => l.assignment_status === 'pending').length },
    { key: 'recent', label: 'Recent' },
    { key: 'followup', label: 'Follow-ups', badge: 'New', badgeColor: 'bg-amber-500' },
    { key: 'database', label: 'Database' },
  ];

  return (
    <div className="space-y-4 lg:space-y-6 max-w-[1600px] mx-auto">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-1 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Lead Management</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Lead Repository</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-200 transition-all active:scale-[0.98] w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>New Lead</span>
          </button>
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all w-full sm:w-auto"
          >
            <Upload size={16} />
            <span>Bulk Upload</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all relative whitespace-nowrap",
              activeTab === tab.key ? "text-red-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-white text-[9px] rounded-full font-black ${tab.badgeColor || 'bg-red-600'}`}>
                {tab.badge}
              </span>
            )}
            {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors pointer-events-none" style={{ zIndex: 10 }} size={16} />
          <input
            type="text"
            placeholder={activeTab === 'database' ? "Search by business name, email, phone..." : "Search leads..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ paddingLeft: '2.5rem', paddingRight: '6rem' }}
            className="w-full py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600 transition-colors z-10"
            >
              <X size={14} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 z-10"
          >
            Search
          </button>
        </div>
        <div className="md:col-span-3">
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 font-bold text-sm"
          >
            <option value="all">All Stages</option>
            {pipelineStages.map(stage => (
              <option key={stage._id} value={stage.name}>{stage.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 font-bold text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Auto Follow-up Section */}
      {activeTab === 'followup' && autoFollowups.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <h3 className="text-xs font-black text-amber-700 uppercase tracking-wider">Auto Follow-up ({autoFollowups.length})</h3>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-amber-50/50 border-b border-amber-100">
                  <th className="w-[20%] px-5 py-2 text-[9px] font-black text-amber-600 uppercase tracking-widest">Enterprise</th>
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
                      <button onClick={() => { setSelectedLead({ _id: item._id, ...item }); setIsDetailModalOpen(true); }} className="p-1.5 bg-white border border-amber-200 text-amber-400 hover:text-amber-600 hover:border-amber-300 rounded-lg transition-all">
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto overflow-y-auto" ref={leadsContainerRef} style={{ maxHeight: 'calc(100vh - 340px)' }}>
          {activeTab === 'followup' ? (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-red-50/40 border-b border-red-100">
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Time</th>
                  <th className="w-[15%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Enterprise</th>
                  <th className="w-[12%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Contact</th>
                  <th className="w-[25%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Note</th>
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Pipeline</th>
                  <th className="w-[13%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest">Manager</th>
                  <th className="w-[10%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest text-center">Activity</th>
                  <th className="w-[15%] px-5 py-3 text-[9px] font-black text-red-600 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {followupLoading ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading...</span></div></td></tr>
                ) : filteredFollowups.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><Clock size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No follow-ups today</span></td></tr>
                ) : filteredFollowups.map((followup) => (
                  <tr key={followup.display_activity_id} className="hover:bg-red-50/30 transition-colors group">
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
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="w-[18%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise</th>
                  <th className="w-[13%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="w-[12%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="w-[12%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</th>
                  <th className="w-[12%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline</th>
                  <th className="w-[11%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
                  <th className="w-[11%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                  <th className="w-[15%] px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><div className="flex flex-col items-center gap-2"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading...</span></div></td></tr>
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-16 text-center"><Briefcase size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Records</span></td></tr>
                ) : filteredLeads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-red-50/20 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                        {hasUpcomingFollowup(lead._id) && <CalendarCheck size={14} className="text-red-600 animate-pulse" />}
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-0.5 uppercase truncate">
                        <MapPin size={8} className="text-red-400" /> {lead.location}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs font-bold text-slate-700 truncate">{lead.contact_person}</div>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <a href={`mailto:${lead.email}`} className="text-[9px] font-bold text-slate-400 hover:text-red-600 transition-colors uppercase truncate max-w-[150px]">{lead.email}</a>
                        <a href={`tel:${lead.phone}`} className="text-[9px] font-bold text-slate-400 hover:text-red-600 transition-colors uppercase">{lead.phone}</a>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{lead.category}</span>
                    </td>
                    <td className="px-5 py-3"><PriorityBadge priority={lead.priority} score={lead.lead_score} /></td>
                    <td className="px-5 py-3"><StatusBadge status={lead.lead_status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-[8px] font-black text-white">{lead.assigned_user?.name ? lead.assigned_user.name[0] : 'U'}</div>
                        <span className="text-[10px] font-bold text-slate-700 truncate">{lead.assigned_user?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Brain size={12} className="text-red-500" />
                        <span className="text-[9px] font-bold text-slate-600">{lead.lead_score || 0}/100</span>
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{lead.priority || 'Cold'}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.assignment_status === 'pending' && (
                          <button
                            onClick={async () => {
                              try {
                                await axios.patch(`${API_URL}/leads/${lead._id}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                toast.success('Assignment accepted');
                                refetchLeads();
                              } catch (err) {
                                toast.error(err.response?.data?.message || 'Failed to accept');
                              }
                            }}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Accept"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <a href={`tel:${lead.phone}`} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-all" title="Call" onClick={(e) => { e.preventDefault(); handleCallWithTel(lead); }}>
                          <Phone size={14} />
                        </a>
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-all" title="WhatsApp">
                          <MessageCircle size={14} />
                        </a>
                        <button onClick={() => handleDetail(lead)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><ExternalLink size={14} /></button>
                        <button onClick={() => handleAction(lead)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><MoreVertical size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reduxLoadingMore && (
                  <tr><td colSpan="8" className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loading more...</span></div></td></tr>
                )}
                {hasMore && !loading && <tr ref={desktopSentinelRef}><td colSpan="8" className="h-1" /></tr>}
                {!hasMore && allLeads.length > 0 && !loading && (
                  <tr><td colSpan="8" className="px-6 py-3 text-center"><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">No more leads</span></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Card View */}
        {activeTab !== 'followup' ? (
          <div className="block lg:hidden">
            {loading ? (
              <div className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 block">Loading...</span></div>
            ) : filteredLeads.length === 0 ? (
              <div className="px-4 py-12 text-center"><Briefcase size={32} className="text-slate-200 mx-auto mb-2" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Records</span></div>
            ) : filteredLeads.map((lead) => (
              <div key={lead._id} className="p-4 border-b border-slate-50 last:border-b-0 active:bg-red-50/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="font-bold text-slate-900 text-sm truncate">{lead.business_name}</div>
                      {hasUpcomingFollowup(lead._id) && <CalendarCheck size={14} className="text-red-600 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                      <MapPin size={8} className="text-red-400 shrink-0" />
                      <span className="truncate">{lead.location}</span>
                    </div>
                  </div>
                  <div className="ml-2 shrink-0"><StatusBadge status={lead.lead_status} /></div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0">{lead.assigned_user?.name ? lead.assigned_user.name[0] : 'U'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-700 truncate">{lead.contact_person}</div>
                    <div className="text-[10px] font-bold text-slate-400">{lead.phone}</div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded shrink-0">{lead.category}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <PriorityBadge priority={lead.priority} score={lead.lead_score} />
                  <div className="flex items-center gap-1">
                    {lead.assignment_status === 'pending' && (
                      <button onClick={async () => { try { await axios.patch(`${API_URL}/leads/${lead._id}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } }); toast.success('Assignment accepted'); refetchLeads(); } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept'); } }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><CheckCircle size={14} /></button>
                    )}
                    <button onClick={() => handleCallWithTel(lead)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"><Phone size={14} /></button>
                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"><MessageCircle size={14} /></a>
                    <button onClick={() => handleDetail(lead)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><ExternalLink size={14} /></button>
                    <button onClick={() => handleAction(lead)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><MoreVertical size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {reduxLoadingMore && (
              <div className="p-4 text-center"><div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
            )}
            {hasMore && !loading && filteredLeads.length > 0 && <div ref={mobileSentinelRef} className="h-1" />}
            {!hasMore && filteredLeads.length > 0 && <div className="p-4 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">All leads loaded</span></div>}
          </div>
        ) : (
          <div className="lg:hidden divide-y divide-slate-50">
            {followupLoading ? (
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
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {activeTab === 'followup'
              ? `${todayFollowups.length} follow-ups today`
              : activeTab === 'database'
                ? `${filteredLeads.length} results`
                : `${filteredLeads.length} of ${pagination?.total || allLeads.length} records`
            }
          </span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-red-600 border border-slate-200 rounded-lg uppercase tracking-wider">Prev</button>
            <button className="px-3 py-1.5 text-[10px] font-bold text-red-600 border border-red-200 bg-red-50 rounded-lg uppercase tracking-wider">Next</button>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Bulk Upload Leads</h2>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Assign leads to team members</p>
                </div>
              </div>
              <button onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }} className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {bulkUploadResults ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 text-center">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Created</p>
                      <h3 className="text-3xl font-black text-emerald-700">{bulkUploadResults.created}</h3>
                    </div>
                    <div className="bg-red-50 p-5 rounded-xl border border-red-100 text-center">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Skipped</p>
                      <h3 className="text-3xl font-black text-red-700">{bulkUploadResults.skipped}</h3>
                    </div>
                  </div>

                  {bulkUploadResults.errors.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500" /> Errors
                      </h4>
                      <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden max-h-40 overflow-y-auto">
                        {bulkUploadResults.errors.map((err, idx) => (
                          <div key={idx} className="p-3 flex items-start gap-3">
                            <div className="w-6 h-6 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 text-[9px] font-bold text-slate-400">{idx + 1}</div>
                            <p className="text-xs font-bold text-slate-900">{err}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign to User</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select
                        value={selectedBulkUser}
                        onChange={(e) => setSelectedBulkUser(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all appearance-none"
                      >
                        <option value="">Select User...</option>
                        {bulkUsers.map(user => (
                          <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Excel File</label>
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer group">
                      <div className="flex flex-col items-center justify-center">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300 group-hover:text-red-500 transition-colors mb-3" />
                        <p className="text-sm font-bold text-slate-900">{bulkFile ? bulkFile.name : 'Click to select Excel file'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">XLSX, XLS or CSV</p>
                      </div>
                      <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkFileChange} />
                    </label>
                  </div>

                  {bulkPreviewData.length > 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">File loaded: {bulkPreviewData.length} records</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {!bulkUploadResults && (
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button onClick={() => { setIsBulkUploadOpen(false); resetBulkUpload(); }} className="flex-1 px-5 py-3 bg-white text-slate-500 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-200 hover:text-slate-900 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkLoading || !bulkFile || !selectedBulkUser}
                  className="flex-[2] px-5 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all active:scale-[0.98] shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span>Upload</span>
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

// Follow-up confirmation modal component
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
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed z-[101] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-2xl outline-none bottom-4 left-1/2 -translate-x-1/2 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:left-1/2 lg:translate-x-[-50%]"
              >
                <div className="px-5 py-4 bg-red-50 border-b border-red-100 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-600" />
                    <DialogPrimitive.Title className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Follow-up Confirmation
                    </DialogPrimitive.Title>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs font-medium text-slate-600 mb-4">
                    This lead has a scheduled follow-up. Do you want to keep it or cancel it?
                  </p>
                  {followupInfo && (
                    <div className="bg-slate-50 p-3 rounded-xl mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Scheduled for:</p>
                      <p className="text-xs font-bold text-slate-900">
                        {new Date(followupInfo.scheduled_for).toLocaleDateString()} at {followupInfo.scheduled_time || 'No Time'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 mb-1">Note:</p>
                      <p className="text-xs font-medium text-slate-900 italic">"{followupInfo.message}"</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onDecision('cancel')}
                      className="flex-1 text-xs font-bold uppercase tracking-wider border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Cancel It
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => onDecision('continue')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider"
                    >
                      Keep It
                    </Button>
                  </div>
                </div>
                <DialogPrimitive.Close asChild>
                  <button className="absolute top-3 right-3 p-1 opacity-50 hover:opacity-100 text-slate-400 hover:text-slate-600">
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
