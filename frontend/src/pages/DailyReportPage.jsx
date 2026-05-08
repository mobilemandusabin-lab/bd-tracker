import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { 
  PhoneCall, 
  ArrowRight, 
  User, 
  Building2, 
  Clock, 
  Calendar,
  ShieldCheck,
  TrendingUp,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '../utils/cn';

import { API_URL } from '../config/api';

const DailyReportPage = () => {
  const [performance, setPerformance] = useState([]);
  const [selectedUser, setSelectedLeadUser] = useState(null);
  const [userCalls, setUserCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { token } = useSelector((state) => state.auth);

  const fetchPerformance = async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboard/user-performance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPerformance(res.data.data.performance);
    } catch (err) {
      console.error('Error fetching performance report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, [token]);

  const fetchUserDetails = async (userId) => {
    setDetailsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/dashboard/daily-call-report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter for the specific user
      const filteredCalls = res.data.data.report.filter(call => call.user_id?._id === userId);
      setUserCalls(filteredCalls);
    } catch (err) {
      console.error('Error fetching user details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUserClick = (userPerf) => {
    setSelectedLeadUser(userPerf);
    fetchUserDetails(userPerf._id);
  };

  const getStatusCount = (stats, status) => {
    // Count occurrences of status in the stats array
    return stats.filter(s => s.status === status).length;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Activated':
      case 'Active Seller': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'Negotiation':
      case 'Interested': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'Meeting Scheduled': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'Document Pending':
      case 'Verification': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'Lost': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const stages = [
    'Contacted', 
    'Interested', 
    'Meeting Scheduled', 
    'Negotiation', 
    'Document Pending', 
    'Verification', 
    'Activated', 
    'Active Seller'
  ];

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-8 bg-red-600 rounded-full" />
            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Super Admin Intelligence</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Team Performance Audit</h1>
          <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Collective pipeline movement per officer</p>
        </div>
        <div className="flex items-center gap-4 px-6 py-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <Calendar size={20} className="text-red-600" />
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase">Report Date</p>
            <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
          </div>
        </div>
      </div>

      {selectedUser ? (
        // ... (rest of the selectedUser view remains similar but ensure width is consistent)
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => setSelectedLeadUser(null)}
            className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest transition-colors"
          >
            <History size={14} className="rotate-180" />
            <span>Back to Performance Overview</span>
          </button>

          <div className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center font-black text-3xl shadow-xl ring-4 ring-white/10">
                  {selectedUser.user?.name?.[0] || 'U'}
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">{selectedUser.user?.name}</h2>
                  <p className="text-slate-400 font-bold tracking-widest uppercase text-xs mt-1">{selectedUser.user?.email}</p>
                </div>
              </div>
              <div className="flex gap-10 text-right">
                <div>
                  <p className="text-4xl font-black text-white">{selectedUser.total_calls}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calls Today</p>
                </div>
                <div className="w-px h-12 bg-slate-800" />
                <div>
                  <p className="text-4xl font-black text-red-600">{selectedUser.total_vendors_touched}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unique Vendors</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
              <PhoneCall size={24} className="text-red-600" />
              <h3 className="text-xl font-black text-slate-900">Today's Call Intelligence</h3>
            </div>
            
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Discussion Details</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pipeline Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {detailsLoading ? (
                    <tr><td colSpan="4" className="px-10 py-20 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest">Retrieving logs...</td></tr>
                  ) : userCalls.length === 0 ? (
                    <tr><td colSpan="4" className="px-10 py-20 text-center text-slate-400 font-black uppercase tracking-widest">No detailed logs found</td></tr>
                  ) : userCalls.map(call => (
                    <tr key={call._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                          <Clock size={14} className="text-red-600" />
                          {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="font-black text-slate-900">{call.lead_id?.business_name}</div>
                      </td>
                      <td className="px-10 py-8 max-w-md">
                        <p className="text-sm font-bold text-slate-600 leading-relaxed italic">"{call.description}"</p>
                      </td>
                      <td className="px-10 py-8">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          getStatusColor(call.lead_id?.lead_status)
                        )}>
                          {call.lead_id?.lead_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Only visible on small screens */}
            <div className="block lg:hidden">
              {detailsLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retrieving logs...</p>
                </div>
              ) : userCalls.length === 0 ? (
                <div className="p-8 text-center">
                  <PhoneCall size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No detailed logs found</p>
                </div>
              ) : userCalls.map(call => (
                <div key={call._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-900 text-sm truncate">{call.lead_id?.business_name}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <Clock size={10} className="text-red-600" />
                        {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ml-2",
                      getStatusColor(call.lead_id?.lead_status)
                    )}>
                      {call.lead_id?.lead_status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 leading-relaxed italic line-clamp-2">"{call.description}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-slate-100">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Officer Performance Matrix</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live synchronization of today's field activity</p>
              </div>
            </div>
          </div>

          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden lg:block overflow-x-auto overflow-y-visible">
            <table className="w-full text-left min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50/50 z-10">Field Officer</th>
                  <th className="px-6 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Total Calls</th>
                  {stages.map(stage => (
                    <th key={stage} className="px-4 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">{stage}</th>
                  ))}
                  <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={stages.length + 3} className="px-10 py-32 text-center text-slate-400 animate-pulse font-black uppercase tracking-widest">Syncing Performance Matrix...</td></tr>
                ) : performance.length === 0 ? (
                  <tr><td colSpan={stages.length + 3} className="px-10 py-32 text-center text-slate-400 font-black uppercase tracking-widest">No activity recorded for today</td></tr>
                ) : performance.map(userPerf => (
                  <tr key={userPerf._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-8 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xs font-black shadow-xl ring-4 ring-slate-50">
                          {userPerf.user?.name?.[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 group-hover:text-red-600 transition-colors text-base">{userPerf.user?.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{userPerf.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-8 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-xl font-black text-slate-900">{userPerf.total_calls}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Calls</span>
                      </div>
                    </td>
                    {stages.map(stage => (
                      <td key={stage} className="px-4 py-8 text-center">
                        {getStatusCount(userPerf.stats, stage) > 0 ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border shadow-sm transition-transform group-hover:scale-110",
                              getStatusColor(stage)
                            )}>
                              {getStatusCount(userPerf.stats, stage)}
                            </span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Vendors</span>
                          </div>
                        ) : (
                          <span className="text-slate-100 font-black">-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-10 py-8 text-right">
                      <button 
                        onClick={() => handleUserClick(userPerf)}
                        className="p-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[1.5rem] transition-all group-hover:rotate-12"
                        title="View Detailed Call Logs"
                      >
                        <ExternalLink size={24} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Only visible on small screens */}
          <div className="block lg:hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Syncing Performance Matrix...</p>
              </div>
            ) : performance.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No activity recorded for today</p>
              </div>
            ) : performance.map(userPerf => (
              <div key={userPerf._id} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0">
                    {userPerf.user?.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-900 text-sm truncate">{userPerf.user?.name}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate">{userPerf.user?.email}</div>
                  </div>
                  <button 
                    onClick={() => handleUserClick(userPerf)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    title="View Detailed Call Logs"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-black text-slate-900">{userPerf.total_calls}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Calls</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Stages</div>
                    <div className="flex flex-wrap gap-1">
                      {stages.map(stage => (
                        getStatusCount(userPerf.stats, stage) > 0 && (
                          <span key={stage} className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase",
                            getStatusColor(stage)
                          )}>
                            {stage}: {getStatusCount(userPerf.stats, stage)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReportPage;