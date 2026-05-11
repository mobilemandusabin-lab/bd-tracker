import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { 
  PhoneCall, 
  History,
  Calendar,
  ExternalLink,
  Clock,
  ShieldCheck
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

  // Mobile-first compact header
  const MobileHeader = () => (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-1 w-6 bg-red-600 rounded-full" />
            <span className="text-[8px] font-black text-red-600 uppercase tracking-[0.2em]">Team Performance</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Daily Call Report</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
          <Calendar size={14} className="text-red-600" />
          <span className="text-[9px] font-black text-slate-900">
            {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );

  // Mobile user card - more compact
  const MobileUserCard = ({ userPerf }) => (
    <div className="p-3 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs font-black">
            {userPerf.user?.name?.[0] || 'U'}
          </div>
          <div className="min-w-0">
            <div className="font-black text-slate-900 text-sm truncate">{userPerf.user?.name}</div>
            <div className="text-[8px] text-slate-400 truncate">{userPerf.user?.email}</div>
          </div>
        </div>
        <button 
          onClick={() => handleUserClick(userPerf)}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
        >
          <ExternalLink size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-lg font-black text-slate-900">{userPerf.total_calls}</div>
          <div className="text-[7px] font-black text-slate-400 uppercase">Calls</div>
        </div>
        <div className="flex-1 bg-slate-50 rounded-lg p-2 text-center">
          <div className="text-lg font-black text-slate-900">{userPerf.total_vendors_touched}</div>
          <div className="text-[7px] font-black text-slate-400 uppercase">Vendors</div>
        </div>
      </div>
    </div>
  );

  // Mobile call card - optimized for phone
  const MobileCallCard = ({ call }) => (
    <div className="p-3 border-b border-slate-100 last:border-b-0 active:bg-slate-50">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-900 text-sm truncate">{call.lead_id?.business_name}</div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
            <Clock size={10} className="text-red-600" />
            {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase border shrink-0",
          getStatusColor(call.lead_id?.lead_status)
        )}>
          {call.lead_id?.lead_status}
        </span>
      </div>
      <p className="text-xs text-slate-600 italic line-clamp-2">"{call.description}"</p>
    </div>
  );

return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Container - Original Layout */}
      <div className="hidden lg:block max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Desktop Header */}
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
          <div className="space-y-6 animate-in fade-in duration-300">
            <button 
              onClick={() => setSelectedLeadUser(null)}
              className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest"
            >
              <History size={14} className="rotate-180" />
              <span>Back to Overview</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-slate-900 p-6 rounded-3xl text-white">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center font-black text-2xl">
                      {selectedUser.user?.name?.[0] || 'U'}
                    </div>
                    <div>
                      <div className="font-black text-xl">{selectedUser.user?.name}</div>
                      <div className="text-sm text-slate-400">{selectedUser.user?.email}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-black">{selectedUser.total_calls}</div>
                      <div className="text-xs uppercase">Total Calls</div>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 text-center">
                      <div className="text-3xl font-black text-red-600">{selectedUser.total_vendors_touched}</div>
                      <div className="text-xs uppercase">Vendors Touched</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-black text-slate-900 text-lg">Call Logs</h3>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {detailsLoading ? (
                      <div className="p-8 text-center">
                        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs font-black text-slate-400 uppercase">Loading...</p>
                      </div>
                    ) : userCalls.length === 0 ? (
                      <div className="p-8 text-center">
                        <ShieldCheck size={32} className="text-slate-200 mx-auto mb-2" />
                        <p className="text-xs font-black text-slate-400 uppercase">No call logs found</p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase">Business</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-slate-400 uppercase">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userCalls.map(call => (
                            <tr key={call._id} className="border-b border-slate-50 last:border-b-0">
                              <td className="px-4 py-3 font-bold text-slate-900">{call.lead_id?.business_name}</td>
                              <td className="px-4 py-3 text-sm text-slate-400">
                                {new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-black uppercase",
                                  getStatusColor(call.lead_id?.lead_status)
                                )}>
                                  {call.lead_id?.lead_status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">{call.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg">Officer Activity</h3>
              <p className="text-xs text-slate-400 uppercase">Today's performance overview</p>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs font-black text-slate-400 uppercase">Loading...</p>
              </div>
            ) : performance.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-black text-slate-400 uppercase">No activity today</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-black text-slate-400 uppercase">Officer</th>
                    <th className="px-6 py-3 text-center text-xs font-black text-slate-400 uppercase">Calls</th>
                    <th className="px-6 py-3 text-center text-xs font-black text-slate-400 uppercase">Vendors</th>
                    <th className="px-6 py-3 text-right text-xs font-black text-slate-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map(userPerf => (
                    <tr key={userPerf._id} className="border-b border-slate-50 last:border-b-0">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black">
                            {userPerf.user?.name?.[0] || 'U'}
                          </div>
                          <div>
                            <div className="font-black text-slate-900">{userPerf.user?.name}</div>
                            <div className="text-xs text-slate-400">{userPerf.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-900">{userPerf.total_calls}</td>
                      <td className="px-6 py-4 text-center font-black text-red-600">{userPerf.total_vendors_touched}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleUserClick(userPerf)}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-red-600 transition-colors"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Mobile Container - Optimized */}
      <div className="block lg:hidden max-w-lg mx-auto px-3 py-4 space-y-4">
        <MobileHeader />

        {selectedUser ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <button 
              onClick={() => setSelectedLeadUser(null)}
              className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest"
            >
              <History size={14} className="rotate-180" />
              <span>Back</span>
            </button>

            <div className="bg-slate-900 p-4 rounded-2xl text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center font-black text-xl">
                  {selectedUser.user?.name?.[0] || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-lg truncate">{selectedUser.user?.name}</div>
                  <div className="text-[9px] text-slate-400 truncate">{selectedUser.user?.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <div className="text-2xl font-black">{selectedUser.total_calls}</div>
                  <div className="text-[8px] uppercase">Calls</div>
                </div>
                <div className="bg-white/10 rounded-xl p-2 text-center">
                  <div className="text-2xl font-black text-red-600">{selectedUser.total_vendors_touched}</div>
                  <div className="text-[8px] uppercase">Vendors</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                <PhoneCall size={18} className="text-red-600" />
                <h3 className="font-black text-slate-900">Call Logs</h3>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {detailsLoading ? (
                  <div className="p-8 text-center">
                    <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                    <p className="text-[9px] font-black text-slate-400 uppercase">Loading...</p>
                  </div>
                ) : userCalls.length === 0 ? (
                  <div className="p-8 text-center">
                    <PhoneCall size={28} className="text-slate-200 mx-auto mb-1" />
                    <p className="text-[9px] font-black text-slate-400 uppercase">No logs</p>
                  </div>
                ) : (
                  <>
                    <div className="block">
                      {userCalls.map(call => (
                        <MobileCallCard key={call._id} call={call} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50">
              <h3 className="font-black text-slate-900 text-sm">Officer Activity</h3>
              <p className="text-[8px] text-slate-400 uppercase">Today's calls</p>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                <p className="text-[9px] font-black text-slate-400 uppercase">Loading...</p>
              </div>
            ) : performance.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck size={28} className="text-slate-200 mx-auto mb-1" />
                <p className="text-[9px] font-black text-slate-400 uppercase">No activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {performance.map(userPerf => (
                  <MobileUserCard key={userPerf._id} userPerf={userPerf} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReportPage;