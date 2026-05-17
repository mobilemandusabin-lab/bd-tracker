import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  X, 
  Calendar, 
  User, 
  Tag, 
  MapPin, 
  Phone, 
  Mail, 
  History, 
  Clock,
  Briefcase,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Send,
  Landmark,
  CreditCard,
  Hash,
  Building2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const DetailSection = ({ title, icon: Icon, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
      <Icon size={16} className="text-red-600" />
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

const DataItem = ({ label, value, icon: Icon, href }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
    <div className="flex items-center gap-2 group">
      {Icon && <Icon size={14} className="text-slate-300 group-hover:text-red-500 transition-colors" />}
      {href ? (
        <a href={href} className="text-sm font-black text-slate-900 hover:text-red-600 transition-colors">
          {value || 'N/A'}
        </a>
      ) : (
        <span className="text-sm font-black text-slate-900">{value || 'N/A'}</span>
      )}
    </div>
  </div>
);

const VendorDetailModal = ({ isOpen, onClose, vendor, token, user, onSuccess }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newActivity, setNewActivity] = useState({
    description: '',
    activity_type: 'call',
    follow_up_required: false,
    follow_up_date: '',
    follow_up_time: ''
  });

  // Handle both old Vendor collection format (with lead_id) and Lead collection format (type: 'vendor')
  const lead = vendor?.lead_id || vendor;
  // Use lead_id._id if populated, lead_id string if not, or vendor._id as fallback
  const vendorId = vendor?.lead_id?._id || vendor?.lead_id || vendor?._id;

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${API_URL}/activities/lead/${vendorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(res.data.data.activities);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && vendorId) {
      fetchActivities();
    }
  }, [isOpen, vendorId, token]);

  const handleSubmitActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.description.trim()) {
      toast.error('Please leave a comment first');
      return;
    }

    setSubmitting(true);
    const loadingToast = toast.loading('Logging activity intelligence...');
    try {
      await axios.post(`${API_URL}/activities`, {
        lead_id: vendorId,
        ...newActivity
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Activity synchronized successfully!', { id: loadingToast });
      setNewActivity({
        description: '',
        activity_type: 'call',
        follow_up_required: false,
        follow_up_date: '',
        follow_up_time: ''
      });
      fetchActivities();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Synchronization failed', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !vendor) return null;

  const getActivityIcon = (type) => {
    switch(type) {
      case 'call': return <Phone size={14} />;
      case 'whatsapp': return <MessageSquare size={14} />;
      case 'email': return <Mail size={14} />;
      case 'meeting': return <Calendar size={14} />;
      case 'follow_up': return <Clock size={14} />;
      default: return <Tag size={14} />;
    }
  };

  const getActivityColor = (type) => {
    switch(type) {
      case 'call': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'whatsapp': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'email': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'meeting': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'follow_up': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-5xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[96vh] sm:max-h-[92vh] border border-white/20">
        {/* Modern Glass Header */}
        <div className="px-6 py-6 sm:px-10 sm:py-8 bg-red-600 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl -ml-24 -mb-24" />
          
          <div className="relative flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 text-white min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center text-red-600 shadow-xl">
                <Building2 size={32} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                  <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight truncate">{lead?.business_name || 'Vendor Profile'}</h2>
                  <span className="inline-block w-fit px-2 py-0.5 sm:px-3 sm:py-1 bg-white/20 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-white/10">
                    {vendor.onboarding_stage ? vendor.onboarding_stage.replace('_', ' ') : lead?.lead_status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={10} className="text-red-500 sm:w-3 sm:h-3" />
                    <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Vendor Intelligence</span>
                  </div>
                  <div className="hidden sm:block w-1 h-1 bg-slate-700 rounded-full" />
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="sm:w-3 sm:h-3" />
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Record: {vendorId ? vendorId.slice(-6).toUpperCase() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 sm:p-3 hover:bg-white/10 rounded-full text-white transition-all hover:rotate-90 shrink-0"
            >
              <X size={20} className="sm:w-7 sm:h-7" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-10 bg-slate-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10">
            {/* Sidebar Info - 4 Columns */}
            <div className="lg:col-span-4 space-y-6 sm:space-y-8">
              <section className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-6 bg-red-600 rounded-full" />
                  <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Corporate Identity</h3>
                </div>
                
                <div className="space-y-4 sm:space-y-5">
                  {[
                    { icon: User, label: 'Primary Contact', value: lead?.contact_person, color: 'text-blue-500' },
                    { icon: Phone, label: 'Phone Number', value: lead?.phone, color: 'text-emerald-500', href: `tel:${lead?.phone}` },
                    { icon: Mail, label: 'Email Address', value: lead?.email, color: 'text-indigo-500', href: `mailto:${lead?.email}` },
                    { icon: MapPin, label: 'Business Location', value: vendor.business_details?.office_address || lead?.location, color: 'text-rose-500' },
                  ].map((item, i) => (
                    item.href ? (
                      <a key={i} href={item.href} className="flex items-start gap-3 sm:gap-4 group cursor-pointer">
                        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center transition-all group-hover:bg-red-600 group-hover:scale-110 shrink-0", item.color.replace('text', 'bg').replace('500', '50'))}>
                          <item.icon size={14} className={cn("sm:w-[18px] sm:h-[18px] group-hover:text-white transition-colors", item.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-red-600 transition-colors truncate block">
                            {item.value || 'N/A'}
                          </p>
                        </div>
                      </a>
                    ) : (
                      <div key={i} className="flex items-start gap-3 sm:gap-4 group">
                        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center transition-all group-hover:scale-110 shrink-0", item.color.replace('text', 'bg').replace('500', '50'))}>
                          <item.icon size={14} className={cn("sm:w-[18px] sm:h-[18px]", item.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                          <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{item.value || 'N/A'}</p>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </section>

              {/* Progress Overview */}
              {vendor.onboarding_completion_percentage && (
                <section className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-6 bg-red-600 rounded-full" />
                    <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Onboarding Progress</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Velocity</span>
                      <span className="text-lg font-black text-red-600">{vendor.onboarding_completion_percentage}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-red-600 transition-all duration-1000"
                        style={{ width: `${vendor.onboarding_completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </section>
              )}

              <section className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-6 bg-red-600 rounded-full" />
                  <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial Summary</h3>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { label: 'Bank', value: vendor.bank_details?.bank_name, icon: Landmark },
                    { label: 'Verification', value: vendor.verification_status?.toUpperCase() || 'PENDING', icon: ShieldCheck },
                    { label: 'Documents', value: vendor.document_status?.toUpperCase() || 'PENDING', icon: CreditCard },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl sm:rounded-2xl">
                      <div className="flex items-center gap-2">
                        <item.icon size={10} className="text-slate-400 sm:w-3 sm:h-3" />
                        <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-black text-slate-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Main Timeline - 8 Columns */}
            <div className="lg:col-span-8 space-y-6 sm:space-y-8">
              {/* Activity Logger Form */}
              <section className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-6 bg-red-600 rounded-full" />
                    <h3 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity Logger</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {['call', 'whatsapp', 'meeting', 'email'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewActivity({...newActivity, activity_type: type})}
                        className={cn(
                          "p-2 rounded-lg transition-all border",
                          newActivity.activity_type === type 
                            ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-100" 
                            : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                        )}
                        title={`Log ${type}`}
                      >
                        {getActivityIcon(type)}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmitActivity} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors">
                      <MessageSquare size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </div>
                    <textarea
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
                      placeholder="Leave a detailed comment about this interaction..."
                      className="w-full pl-10 sm:pl-12 pr-4 pt-4 pb-3 sm:pt-4 sm:pb-3 bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-red-600 focus:bg-white focus:border-transparent outline-none transition-all font-bold text-xs sm:text-sm text-slate-800 min-h-[80px] sm:min-h-[100px] resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        onClick={() => setNewActivity({...newActivity, follow_up_required: !newActivity.follow_up_required})}
                        className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 rounded sm:rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                          newActivity.follow_up_required ? "bg-red-600 border-red-600" : "border-slate-200 group-hover:border-red-200"
                        )}
                      >
                        {newActivity.follow_up_required && <ShieldCheck size={12} className="text-white sm:w-3.5 sm:h-3.5" />}
                      </div>
                      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">Follow-up Required</span>
                    </label>

                    {newActivity.follow_up_required && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                        <input 
                          type="date" 
                          value={newActivity.follow_up_date}
                          onChange={(e) => setNewActivity({...newActivity, follow_up_date: e.target.value})}
                          className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-red-600"
                        />
                        <input 
                          type="time" 
                          value={newActivity.follow_up_time}
                          onChange={(e) => setNewActivity({...newActivity, follow_up_time: e.target.value})}
                          className="flex-1 sm:flex-none px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-red-600"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-red-600 text-white rounded-lg sm:rounded-xl font-black text-[8px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={12} className="animate-spin sm:w-3.5 sm:h-3.5" /> : <Send size={12} className="sm:w-3.5 sm:h-3.5" />}
                      <span>Synchronize Log</span>
                    </button>
                  </div>
                </form>
              </section>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                    <History size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Intelligence Timeline</h3>
                    <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chronological Activity Log</p>
                  </div>
                </div>
                <div className="w-fit flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white rounded-full border border-slate-100 shadow-sm">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest">Live Sync Active</span>
                </div>
              </div>

              {loading ? (
                <div className="py-16 sm:py-24 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin shadow-xl shadow-red-100" />
                  <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Intelligence Assets...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="bg-white p-12 sm:p-20 rounded-[1.5rem] sm:rounded-[3rem] border border-dashed border-slate-200 text-center shadow-sm">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <Clock size={32} className="text-slate-200 sm:w-10 sm:h-10" />
                  </div>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 mb-1 sm:mb-2">No Records Found</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start logging activities to build the intelligence timeline</p>
                </div>
              ) : (
                <div className="relative space-y-4 sm:space-y-6 before:absolute before:left-[19px] sm:before:left-[23px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {activities.map((activity) => (
                    <div key={activity._id} className="relative pl-10 sm:pl-14 group">
                      {/* Timeline Node */}
                      <div className="absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center group-hover:border-red-600 group-hover:shadow-lg group-hover:shadow-red-50 transition-all z-10">
                        <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors", getActivityColor(activity.activity_type))}>
                          {getActivityIcon(activity.activity_type)}
                        </div>
                      </div>

                      <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm group-hover:shadow-xl group-hover:shadow-slate-200/50 transition-all relative overflow-hidden">
                        {activity.follow_up_date && (
                          <div className="absolute top-0 right-0 p-0.5 sm:p-1">
                            <div className="px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-bl-[1rem] sm:rounded-bl-[1.5rem] shadow-lg flex flex-col items-end gap-0.5 sm:gap-1">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <AlertCircle size={10} className="animate-pulse sm:w-3 sm:h-3" />
                                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Follow-up Due</span>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center gap-1">
                                  <Calendar size={8} className="sm:w-2.5 sm:h-2.5" />
                                  <span className="text-[7px] sm:text-[9px] font-black">{new Date(activity.follow_up_date).toLocaleDateString()}</span>
                                </div>
                                {activity.follow_up_time && (
                                  <div className="flex items-center gap-1">
                                    <Clock size={8} className="sm:w-2.5 sm:h-2.5" />
                                    <span className="text-[7px] sm:text-[9px] font-black">{activity.follow_up_time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {new Date(activity.created_at).toLocaleString(undefined, { 
                              dateStyle: 'medium', 
                              timeStyle: 'short' 
                            })}
                          </span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[8px] sm:text-[10px] font-black text-red-600 uppercase tracking-widest">
                            {activity.activity_type.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-slate-700 leading-relaxed mb-4 sm:mb-6">
                          {activity.description}
                        </p>

                        <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-slate-50">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-900 rounded-lg sm:rounded-xl flex items-center justify-center text-[8px] sm:text-[10px] font-black text-white shadow-sm ring-2 ring-slate-100">
                              {activity.user_id?.name?.[0] || 'U'}
                            </div>
                            <div>
                              <p className="text-[8px] sm:text-[10px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[100px]">{activity.user_id?.name || 'System'}</p>
                              <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase">Field Officer</p>
                            </div>
                          </div>
                          <button className="flex items-center gap-1 sm:gap-2 text-[8px] sm:text-[10px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest transition-colors">
                            <span>Metadata</span>
                            <ChevronRight size={10} className="sm:w-3 sm:h-3" />
                          </button>
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
        <div className="px-6 py-6 sm:px-10 sm:py-8 bg-white border-t border-slate-100 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex -space-x-3 sm:-space-x-3">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border-2 sm:border-4 border-white bg-slate-100 flex items-center justify-center text-[8px] sm:text-[10px] font-black text-slate-400 shadow-sm">
                  U{i}
                </div>
              ))}
            </div>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
              Collaborative Intelligence View
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-2xl shadow-slate-900/20"
          >
            Dismiss Intelligence Asset
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailModal;