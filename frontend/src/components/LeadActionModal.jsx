import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, RefreshCcw, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const LeadActionModal = ({ isOpen, onClose, lead, token, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('New');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [activityType, setActivityType] = useState('call');

  useEffect(() => {
    if (lead) {
      setStatus(lead.lead_status || 'New');
      setNotes('');
      setFollowUpDate('');
      setFollowUpTime('');
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleUpdateStatus = async () => {
    setLoading(true);
    const loadingToast = toast.loading('Updating...');
    try {
      await axios.patch(`${API_URL}/leads/${lead._id}`, {
        lead_status: status, notes: notes || lead.notes,
        follow_up_date: followUpDate || null, follow_up_time: followUpTime || null,
        activity_type: activityType
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Lead updated!', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed', { id: loadingToast });
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this lead permanently?')) return;
    setLoading(true);
    const loadingToast = toast.loading('Deleting...');
    try {
      await axios.delete(`${API_URL}/leads/${lead._id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Lead deleted', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Delete failed', { id: loadingToast });
    } finally { setLoading(false); }
  };

  const leadStatuses = ['New', 'Contacted', 'Interested', 'Meeting Scheduled'];
  const vendorStatuses = ['Negotiation', 'Document Pending', 'Verification', 'Onboarding', 'Activated', 'Active Seller', 'Lost', 'Self Registered'];
  const isVendor = lead.type === 'vendor' || vendorStatuses.includes(lead.lead_status);
  const statuses = isVendor ? vendorStatuses : leadStatuses;
  const activityTypes = [
    { value: 'call', label: 'Call' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'follow_up', label: 'Follow Up' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <RefreshCcw size={18} />
            <h2 className="text-lg font-extrabold uppercase tracking-wider">Execute Action</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Lead Info */}
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0">
              {lead.business_name?.[0] || 'L'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-slate-900 truncate">{lead.business_name || 'Unnamed'}</h3>
              <p className="text-xs text-red-500 font-bold">Current: {lead.lead_status}</p>
            </div>
          </div>

          {/* Pipeline Stage */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Stage</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {statuses.map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn("px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    status === s ? "bg-red-600 border-red-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
                  )}>{s}</button>
              ))}
            </div>
          </div>

          {/* Activity Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Type</label>
            <div className="flex flex-wrap gap-2">
              {activityTypes.map(t => (
                <button key={t.value} onClick={() => setActivityType(t.value)}
                  className={cn("px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    activityType === t.value ? "bg-red-600 border-red-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-red-300"
                  )}>{t.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Note</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Log the details..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm h-20 resize-none" />
          </div>

          {/* Follow-up */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-up Date</label>
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-up Time</label>
              <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center gap-3 shrink-0">
          <button onClick={handleUpdateStatus} disabled={loading}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            <span>Update</span>
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadActionModal;
