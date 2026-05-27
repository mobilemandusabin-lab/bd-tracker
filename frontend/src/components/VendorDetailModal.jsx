import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  X, Calendar, User, Tag, MapPin, Phone, Mail, History, Clock,
  MessageSquare, ShieldCheck, AlertCircle, Loader2, Send,
  Landmark, CreditCard, Building2, GitBranch, ArrowRightLeft
} from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const VendorDetailModal = ({ isOpen, onClose, vendor, token, user, onSuccess }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newActivity, setNewActivity] = useState({ description: '', activity_type: 'call', follow_up_required: false, follow_up_date: '', follow_up_time: '' });

  const lead = vendor?.lead_id || vendor;
  const vendorId = vendor?.lead_id?._id || vendor?.lead_id || vendor?._id;

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_URL}/activities/lead/${vendorId}`, { headers: { Authorization: `Bearer ${token}` } });
      setActivities(res.data.data.activities);
    } catch (err) { console.error('Error fetching activities:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen && vendorId) fetchActivities(); }, [isOpen, vendorId, token]);

  const handleSubmitActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.description.trim()) { toast.error('Please leave a comment first'); return; }
    setSubmitting(true);
    const loadingToast = toast.loading('Logging activity...');
    try {
      await axios.post(`${API_URL}/activities`, { lead_id: vendorId, ...newActivity }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Activity logged!', { id: loadingToast });
      setNewActivity({ description: '', activity_type: 'call', follow_up_required: false, follow_up_date: '', follow_up_time: '' });
      fetchActivities();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed', { id: loadingToast }); }
    finally { setSubmitting(false); }
  };

  if (!isOpen || !vendor) return null;

  const getActivityIcon = (type) => {
    const map = { call: <Phone size={14} />, whatsapp: <MessageSquare size={14} />, email: <Mail size={14} />, meeting: <Calendar size={14} />, follow_up: <Clock size={14} />, status_change: <ArrowRightLeft size={14} /> };
    return map[type] || <Tag size={14} />;
  };
  const getActivityColor = (type) => {
    const map = { call: 'bg-blue-50 text-blue-600', whatsapp: 'bg-emerald-50 text-emerald-600', email: 'bg-indigo-50 text-indigo-600', meeting: 'bg-amber-50 text-amber-600', follow_up: 'bg-red-50 text-red-600', status_change: 'bg-purple-50 text-purple-600' };
    return map[type] || 'bg-slate-50 text-slate-600';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[95vh] lg:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-white min-w-0">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20 shrink-0">
                <Building2 size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-extrabold uppercase tracking-tight truncate">{lead?.business_name || 'Vendor'}</h2>
                  {(() => {
                    const VENDOR_STATUSES = ['Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost', 'Self Registered', 'Proposal Dropped'];
                    const isVendor = VENDOR_STATUSES.includes(lead?.lead_status);
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${isVendor ? 'bg-red-500/30 text-red-100 border border-red-400/30' : 'bg-blue-500/30 text-blue-100 border border-blue-400/30'}`}>
                        {isVendor ? 'Vendor' : 'Lead'}
                      </span>
                    );
                  })()}
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 shrink-0">
                    {vendor.onboarding_stage?.replace('_', ' ') || lead?.lead_status}
                  </span>
                </div>
                <p className="text-xs text-red-200 mt-0.5">Record: {vendorId?.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors shrink-0"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#fafafa]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-red-600 rounded-full" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Identity</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: User, label: 'Contact', value: lead?.contact_person, color: 'text-blue-500' },
                    { icon: Phone, label: 'Phone', value: lead?.phone, color: 'text-emerald-500', href: `tel:${lead?.phone}` },
                    { icon: Mail, label: 'Email', value: lead?.email, color: 'text-indigo-500', href: `mailto:${lead?.email}` },
                    { icon: MapPin, label: 'Location', value: vendor.business_details?.office_address || lead?.location, color: 'text-rose-500' },
                  ].map((item, i) => (
                    item.href ? (
                      <a key={i} href={item.href} className="flex items-start gap-3 group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-red-50 transition-colors shrink-0">
                          <item.icon size={14} className={cn(item.color, "group-hover:text-red-600 transition-colors")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{item.label}</p>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors truncate">{item.value || 'N/A'}</p>
                        </div>
                      </a>
                    ) : (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <item.icon size={14} className={item.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{item.label}</p>
                          <p className="text-sm font-bold text-slate-900 truncate">{item.value || 'N/A'}</p>
                        </div>
                      </div>
                    )
                  ))}
                  {/* Service Branches */}
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Service Branches</p>
                    {lead?.service_branches?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {lead.service_branches.map((branch, i) => (
                          <span key={branch.branchId || i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-[10px] font-bold border border-red-100">
                            <MapPin size={10} />
                            {branch.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">None assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {vendor.onboarding_completion_percentage != null && (
                <div className="bg-white p-5 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 bg-red-600 rounded-full" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Onboarding Progress</h3>
                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-slate-400">Progress</span>
                    <span className="text-lg font-extrabold text-red-600">{vendor.onboarding_completion_percentage}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 rounded-full transition-all duration-1000" style={{ width: `${vendor.onboarding_completion_percentage}%` }} />
                  </div>
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-red-600 rounded-full" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Financial Summary</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Bank', value: vendor.bank_details?.bank_name, icon: Landmark },
                    { label: 'Verification', value: vendor.verification_status?.toUpperCase() || 'PENDING', icon: ShieldCheck },
                    { label: 'Documents', value: vendor.document_status?.toUpperCase() || 'PENDING', icon: CreditCard },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <item.icon size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Main Content */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-red-600 rounded-full" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Logger</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['call', 'whatsapp', 'meeting', 'email'].map((type) => (
                      <button key={type} onClick={() => setNewActivity({ ...newActivity, activity_type: type })}
                        className={cn("p-2 rounded-lg transition-all border",
                          newActivity.activity_type === type ? "bg-red-600 text-white border-red-600" : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                        )} title={`Log ${type}`}>
                        {getActivityIcon(type)}
                      </button>
                    ))}
                  </div>
                </div>
                <form onSubmit={handleSubmitActivity} className="space-y-3">
                  <textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    placeholder="Leave a comment about this interaction..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm min-h-[80px] resize-none" />
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setNewActivity({ ...newActivity, follow_up_required: !newActivity.follow_up_required })}
                        className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
                          newActivity.follow_up_required ? "bg-red-600 border-red-600" : "border-slate-200"
                        )}>
                        {newActivity.follow_up_required && <ShieldCheck size={12} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold text-slate-500">Follow-up Required</span>
                    </label>
                    {newActivity.follow_up_required && (
                      <div className="flex items-center gap-2 animate-in fade-in">
                        <input type="date" value={newActivity.follow_up_date} onChange={(e) => setNewActivity({ ...newActivity, follow_up_date: e.target.value })}
                          className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-100" />
                        <input type="time" value={newActivity.follow_up_time} onChange={(e) => setNewActivity({ ...newActivity, follow_up_time: e.target.value })}
                          className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-100" />
                      </div>
                    )}
                    <button type="submit" disabled={submitting}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-red-700 hover:shadow-red-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      <span>Log Activity</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Timeline Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 border border-red-100">
                    <History size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Activity Timeline</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chronological Log</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase">Loading...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
                  <Clock size={32} className="text-slate-200 mx-auto mb-3" />
                  <h4 className="text-sm font-extrabold text-slate-900 mb-1">No Records Found</h4>
                  <p className="text-xs font-bold text-slate-400">Start logging activities to build the timeline</p>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {activities.map((activity) => (
                    <div key={activity._id} className="relative pl-12 group">
                      <div className="absolute left-0 top-0 w-10 h-10 rounded-xl bg-white border-2 border-slate-100 flex items-center justify-center group-hover:border-red-300 transition-all z-10">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", getActivityColor(activity.activity_type))}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 group-hover:shadow-md transition-all relative overflow-hidden">
                        {activity.follow_up_date && (
                          <div className="absolute top-0 right-0">
                            <div className="px-3 py-2 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-bl-xl shadow-sm">
                              <div className="flex items-center gap-1 mb-0.5">
                                <AlertCircle size={10} className="animate-pulse" />
                                <span className="text-[10px] font-bold uppercase">Follow-up Due</span>
                              </div>
                              <span className="text-[9px] font-bold">{new Date(activity.follow_up_date).toLocaleDateString()}</span>
                              {activity.follow_up_time && <span className="text-[9px] font-bold ml-2">{activity.follow_up_time}</span>}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(activity.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] font-bold text-red-600 uppercase">{activity.activity_type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-4">{activity.description}</p>
                        <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
                          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white">
                            {activity.user_id?.name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{activity.user_id?.name || 'System'}</p>
                            <p className="text-[10px] text-slate-400">Field Officer</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-red-glow transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailModal;
