import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, ArrowRight, Loader2, AlertTriangle, Users } from 'lucide-react';
import { API_URL } from '../config/api';

const TransferModal = ({ isOpen, onClose, onSuccess, token, currentUser, users }) => {
  const [step, setStep] = useState(1);
  const [toUserId, setToUserId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setToUserId('');
      setPreview(null);
    }
  }, [isOpen]);

  const fetchPreview = async () => {
    if (!toUserId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/leads/handover-preview?from_user_id=${currentUser._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreview(res.data.data);
      setStep(2);
    } catch (err) {
      toast.error('Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    setTransferring(true);
    try {
      const res = await axios.post(`${API_URL}/leads/bulk-transfer`, {
        from_user_id: currentUser._id,
        to_user_id: toUserId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Transferred ${res.data.data.transferred} leads`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  const targetUser = users.find(u => u._id === toUserId);
  const availableUsers = users.filter(u => u._id !== currentUser?._id && u.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Users size={16} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transfer Leads</h3>
              <p className="text-[10px] text-slate-400">Handover all leads to another user</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Transferring From</label>
                <div className="mt-1 px-3 py-2 bg-slate-50 rounded-lg text-sm font-semibold text-slate-900">
                  {currentUser?.name}
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRight size={16} className="text-slate-300 mt-5" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Transfer To</label>
                <select
                  value={toUserId}
                  onChange={e => setToUserId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role?.replace('_', ' ')})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchPreview}
                disabled={!toUserId || loading}
                className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                Preview Transfer
              </button>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Confirm Transfer</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">This action cannot be undone. All leads will be reassigned immediately.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg px-4 py-3 text-center">
                  <div className="text-lg font-black text-slate-900">{preview.leadCount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Leads</div>
                </div>
                <div className="bg-slate-50 rounded-lg px-4 py-3 text-center">
                  <div className="text-xs font-bold text-slate-600 truncate">{preview.fromUser?.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">From</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400">
                <ArrowRight size={14} />
              </div>

              <div className="bg-emerald-50 rounded-lg px-4 py-3 text-center">
                <div className="text-xs font-bold text-emerald-700">{targetUser?.name}</div>
                <div className="text-[10px] font-bold text-emerald-500 uppercase mt-0.5">New Owner</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {transferring ? <Loader2 size={14} className="animate-spin" /> : null}
                  Transfer {preview.leadCount} Leads
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
