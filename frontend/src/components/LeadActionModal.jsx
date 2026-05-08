import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  X, 
  Loader2, 
  RefreshCcw, 
  MessageSquare, 
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { cn } from '../utils/cn';

import { API_URL } from '../config/api';

const LeadActionModal = ({ isOpen, onClose, lead, token, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('New');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [activityType, setActivityType] = useState('call');

  // Sync state when lead changes
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
    const loadingToast = toast.loading('Synchronizing updates...');
    try {
      await axios.patch(`${API_URL}/leads/${lead._id}`, {
        lead_status: status,
        notes: notes || lead.notes,
        follow_up_date: followUpDate || null,
        follow_up_time: followUpTime || null,
        activity_type: activityType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Enterprise profile synchronized successfully!', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Synchronization failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this lead permanently?')) return;
    setLoading(true);
    const loadingToast = toast.loading('Revoking lead access...');
    try {
      await axios.delete(`${API_URL}/leads/${lead._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Lead access revoked permanently', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Revoke operation failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const statuses = [
    'New', 'Contacted', 'Interested', 'Meeting Scheduled', 
    'Negotiation', 'Document Pending', 'Verification', 
    'Onboarding', 'Activated', 'Active Seller', 'Lost'
  ];

  const activityTypes = [
    { value: 'call', label: 'Phone Call' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'follow_up', label: 'Follow Up' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full sm:w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        <div className="px-6 sm:px-8 py-4 sm:py-6 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <RefreshCcw size={20} />
            <h2 className="text-base sm:text-lg font-black uppercase tracking-widest">Execute Action</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
          <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 font-black shrink-0">
                  {lead.business_name ? lead.business_name[0] : 'L'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base truncate">{lead.business_name || 'Unnamed Lead'}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">Current: {lead.lead_status}</p>
                </div>
              </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pipeline Stage</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "px-2 sm:px-3 py-2.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-tighter border transition-all",
                      status === s 
                        ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-100" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-red-200 hover:text-red-600"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Type</label>
              <div className="flex flex-wrap gap-2">
                {activityTypes.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setActivityType(t.value)}
                    className={cn(
                      "px-3 py-2.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-tighter border transition-all",
                      activityType === t.value 
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-100" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-900"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Note</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log the details of this transition..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm h-20 sm:h-24 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Follow-up Date</label>
                <input 
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Follow-up Time</label>
                <input 
                  type="time"
                  value={followUpTime}
                  onChange={(e) => setFollowUpTime(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={handleUpdateStatus} disabled={loading}
              className="flex-1 py-3 sm:py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95 min-h-[48px]"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              <span>Commit Update</span>
            </button>
            <button 
              onClick={handleDelete} disabled={loading}
              className="p-3 sm:p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100 active:scale-95 min-h-[48px] min-w-[48px]"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadActionModal;
