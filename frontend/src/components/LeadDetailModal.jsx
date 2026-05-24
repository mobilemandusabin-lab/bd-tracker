import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  X, Calendar, User, Tag, MapPin, Phone, Mail, History, Clock,
  Briefcase, MessageSquare, ChevronRight, ChevronDown, TrendingUp, ShieldCheck,
  AlertCircle, Loader2, Send, Edit2, Check, X as XIcon
} from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const LeadDetailModal = ({ isOpen, onClose, lead, token, user, onSuccess }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ business_name: '', contact_person: '', phone: '', email: '', location: '', category: '', lead_source: '' });
  const [phoneError, setPhoneError] = useState('');
  const [zoneGroups, setZoneGroups] = useState([]);
  const [showBranches, setShowBranches] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [newActivity, setNewActivity] = useState({ description: '', activity_type: 'call', follow_up_required: false, follow_up_date: '', follow_up_time: '' });

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_URL}/activities/lead/${lead._id}`, { headers: { Authorization: `Bearer ${token}` } });
      setActivities(res.data.data.activities);
    } catch (err) { console.error('Error fetching activities:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen && lead) {
      fetchActivities();
      setEditData({ business_name: lead.business_name || '', contact_person: lead.contact_person || '', phone: lead.phone || '', email: lead.email || '', location: lead.location || '', category: lead.category || '', lead_source: lead.lead_source || '' });
      setSelectedBranches(lead.service_branches || []);
      setShowBranches(false);
      setEditing(false);
      axios.get(`${API_URL}/delivery-zones`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setZoneGroups(res.data.data.groups || []))
        .catch(() => {});
    }
  }, [isOpen, lead, token]);

  const toggleBranch = (branchId, name) => {
    setSelectedBranches(prev => {
      const exists = prev.find(b => b.branchId === branchId);
      if (exists) return prev.filter(b => b.branchId !== branchId);
      return [...prev, { branchId, name }];
    });
  };

  const handleSubmitActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.description.trim()) { toast.error('Please leave a comment first'); return; }
    setSubmitting(true);
    const loadingToast = toast.loading('Logging activity...');
    try {
      await axios.post(`${API_URL}/activities`, { lead_id: lead._id, ...newActivity }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Activity logged!', { id: loadingToast });
      setNewActivity({ description: '', activity_type: 'call', follow_up_required: false, follow_up_date: '', follow_up_time: '' });
      fetchActivities();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed', { id: loadingToast }); }
    finally { setSubmitting(false); }
  };

  if (!isOpen || !lead) return null;

  const getActivityIcon = (type) => {
    const map = { call: <Phone size={14} />, whatsapp: <MessageSquare size={14} />, email: <Mail size={14} />, meeting: <Calendar size={14} />, follow_up: <Clock size={14} /> };
    return map[type] || <Tag size={14} />;
  };

  const getActivityColor = (type) => {
    const map = { call: 'bg-blue-50 text-blue-600', whatsapp: 'bg-emerald-50 text-emerald-600', email: 'bg-indigo-50 text-indigo-600', meeting: 'bg-amber-50 text-amber-600', follow_up: 'bg-red-50 text-red-600' };
    return map[type] || 'bg-slate-50 text-slate-600';
  };

  const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm";

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[95vh] lg:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-white min-w-0">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center font-extrabold text-xl border border-white/20 shrink-0">
                {lead.business_name?.[0] || 'V'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-extrabold uppercase tracking-tight truncate">{lead.business_name}</h2>
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 shrink-0">{lead.lead_status}</span>
                </div>
                <p className="text-xs text-red-200 mt-0.5">Record: {lead._id?.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors shrink-0"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#fafafa]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Corporate Identity */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-red-600 rounded-full" />
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Identity</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.assignment_status === 'pending' && (
                      <button onClick={async () => {
                        try {
                          const res = await axios.patch(`${API_URL}/leads/${lead._id}/accept`, {}, { headers: { Authorization: `Bearer ${token}` } });
                          toast.success('Assignment accepted!');
                          if (onSuccess && res.data?.data?.lead) onSuccess(res.data.data.lead);
                        } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
                      }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-red-700 transition-all flex items-center gap-1">
                        <Check size={12} /> Accept
                      </button>
                    )}
                    {!editing && (
                      <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                        <Edit2 size={14} className="text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: User, label: 'Contact', key: 'contact_person', value: lead.contact_person, color: 'text-blue-500' },
                    { icon: Phone, label: 'Phone', key: 'phone', value: lead.phone, color: 'text-emerald-500', href: `tel:${editing ? editData.phone : lead.phone}`, isPhone: true },
                    { icon: Mail, label: 'Email', key: 'email', value: lead.email, color: 'text-indigo-500', href: editing ? '' : `mailto:${lead.email}` },
                    { icon: MapPin, label: 'Location', key: 'location', value: lead.location, color: 'text-rose-500' },
                    { icon: Tag, label: 'Category', key: 'category', value: lead.category, color: 'text-amber-500' },
                  ].map((item, i) => (
                    editing ? (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <item.icon size={14} className={item.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{item.label}</p>
                          <input type={item.isPhone ? "tel" : "text"} value={editData[item.key] ?? ''}
                            onChange={(e) => {
                              let value = e.target.value;
                              if (item.isPhone) { value = value.replace(/\D/g, '').slice(0, 10); setPhoneError(value.length > 0 && value.length < 10 ? 'Must be 10 digits' : ''); }
                              setEditData({ ...editData, [item.key]: value });
                            }}
                            className={cn(inputClass, item.isPhone && phoneError ? "border-red-500" : "")} />
                          {item.isPhone && phoneError && <p className="text-[10px] font-bold text-red-500 mt-0.5">{phoneError}</p>}
                        </div>
                      </div>
                    ) : item.href ? (
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
                    {editing ? (
                      <div className="relative">
                        <button type="button" onClick={() => setShowBranches(!showBranches)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs font-medium text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <MapPin size={12} className="text-slate-400" />
                            {selectedBranches.length > 0 ? `${selectedBranches.length} branch${selectedBranches.length > 1 ? 'es' : ''} selected` : 'Select service branches'}
                          </span>
                          <ChevronDown size={12} className={`text-slate-400 transition-transform ${showBranches ? 'rotate-180' : ''}`} />
                        </button>
                        {showBranches && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {zoneGroups.length === 0 ? (
                              <p className="p-3 text-xs text-slate-400">No zones available</p>
                            ) : zoneGroups.map(group => (
                              <div key={group._id}>
                                <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase bg-slate-50">{group.name}</p>
                                {group.branches.map(branch => (
                                  <label key={branch.nepalcanId} className="flex items-center gap-2 px-3 py-2 hover:bg-red-50/50 cursor-pointer">
                                    <input type="checkbox" checked={selectedBranches.some(b => b.branchId === branch.nepalcanId)}
                                      onChange={() => toggleBranch(branch.nepalcanId, branch.name)}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                                    <span className="text-xs font-medium text-slate-700">{branch.name}</span>
                                  </label>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedBranches.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedBranches.map(b => (
                              <span key={b.branchId} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-[10px] font-bold">
                                {b.name}
                                <button type="button" onClick={() => toggleBranch(b.branchId, b.name)} className="hover:text-red-900"><X size={10} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : lead.service_branches?.length > 0 ? (
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
                  {editing && (
                    <div className="flex items-center gap-2 pt-2">
                      <button onClick={async () => {
                        if (editData.phone && !/^\d{10}$/.test(editData.phone)) { setPhoneError('Must be 10 digits'); return; }
                        setPhoneError('');
                        try {
                          await axios.patch(`${API_URL}/leads/${lead._id}`, { ...editData, service_branches: selectedBranches }, { headers: { Authorization: `Bearer ${token}` } });
                          toast.success('Lead updated!');
                          const res = await axios.get(`${API_URL}/leads/${lead._id}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (onSuccess && res.data?.data?.lead) onSuccess(res.data.data.lead);
                          setEditing(false);
                        } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
                      }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-red-700 transition-all flex items-center justify-center gap-1">
                        <Check size={12} /> Save
                      </button>
                      <button onClick={() => setEditing(false)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-1">
                        <XIcon size={12} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline Meta */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-red-600 rounded-full" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline Meta</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Created', value: new Date(lead.created_at).toLocaleDateString(), icon: Calendar },
                    { label: 'Source', value: lead.lead_source, icon: TrendingUp, color: 'text-red-600' },
                    { label: 'Owner', value: lead.assigned_user?.name || 'Unassigned', icon: Briefcase },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <item.icon size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                      </div>
                      <span className={cn("text-xs font-bold", item.color || "text-slate-700")}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Main Content */}
            <div className="lg:col-span-8 space-y-4">
              {/* Activity Logger */}
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
                      className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-red-700 hover:shadow-lg hover:shadow-red-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-100">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Live</span>
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
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold">{new Date(activity.follow_up_date).toLocaleDateString()}</span>
                                {activity.follow_up_time && <span className="text-[9px] font-bold">{activity.follow_up_time}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(activity.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] font-bold text-red-600 uppercase">{activity.activity_type.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed mb-4">{activity.description}</p>

                        {user?.role === 'super_admin' && activity.early_call_status && (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Early Call Intel</p>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div><span className="text-slate-400">Schedule:</span> <span className="font-bold text-slate-700">{activity.original_follow_up_date ? new Date(activity.original_follow_up_date).toLocaleDateString() : 'N/A'} at {activity.original_follow_up_time || 'N/A'}</span></div>
                              <div><span className="text-slate-400">Status:</span> <span className={cn("font-bold", activity.early_call_status === 'continued' ? "text-blue-600" : "text-red-600")}>{activity.early_call_status.replace('_', ' ')}</span></div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex items-center gap-2">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-red-200 transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailModal;
