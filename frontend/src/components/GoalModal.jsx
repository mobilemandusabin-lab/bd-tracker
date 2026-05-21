import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Save, Target } from 'lucide-react';
import { API_URL } from '../config/api';

const GoalModal = ({ isOpen, onClose, onSuccess, token, goal }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const isEdit = !!goal;
  const [formData, setFormData] = useState({
    title: '', description: '', target_value: 0, unit: 'leads',
    pipeline_stage: 'all', period: 'monthly', start_date: '', end_date: '',
    assigned_to: '', priority: 'medium'
  });

  useEffect(() => {
    if (isOpen && token) {
      axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUsers(res.data.data.users))
        .catch(err => console.error('Error fetching users:', err));
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (goal && isOpen) {
      setFormData({
        title: goal.title || '',
        description: goal.description || '',
        target_value: goal.target_value || 0,
        unit: goal.unit || 'leads',
        pipeline_stage: goal.pipeline_stage || 'all',
        period: goal.period || 'monthly',
        start_date: goal.start_date ? new Date(goal.start_date).toISOString().split('T')[0] : '',
        end_date: goal.end_date ? new Date(goal.end_date).toISOString().split('T')[0] : '',
        assigned_to: goal.assigned_to?._id || goal.assigned_to || '',
        priority: goal.priority || 'medium'
      });
    } else if (!goal && isOpen) {
      setFormData({
        title: '', description: '', target_value: 0, unit: 'leads',
        pipeline_stage: 'all', period: 'monthly', start_date: '', end_date: '',
        assigned_to: '', priority: 'medium'
      });
    }
  }, [goal, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading(isEdit ? 'Updating goal...' : 'Creating goal...');
    try {
      if (isEdit) {
        await axios.patch(`${API_URL}/goals/${goal._id}`, formData, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Goal updated!', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/goals`, formData, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Goal created!', { id: loadingToast });
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} goal`, { id: loadingToast });
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <Target size={20} />
            <h2 className="text-lg font-extrabold uppercase tracking-wider">{isEdit ? 'Edit Goal' : 'Set New Goal'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Goal Title</label>
              <input name="title" required value={formData.title} onChange={handleChange} placeholder="e.g., Monthly Lead Target" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Assign To</label>
              <select name="assigned_to" required value={formData.assigned_to} onChange={handleChange} className={inputClass}>
                <option value="">Select User</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Target Value</label>
              <input type="number" name="target_value" required value={formData.target_value} onChange={handleChange} min="0" placeholder="e.g., 50" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Unit</label>
              <select name="unit" required value={formData.unit} onChange={handleChange} className={inputClass}>
                <option value="leads">Leads</option>
                <option value="conversions">Conversions</option>
                <option value="revenue">Revenue</option>
                <option value="activated_vendors">Activated Vendors</option>
                <option value="activities">Activities</option>
                <option value="calls">Calls</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Pipeline Stage</label>
              <select name="pipeline_stage" required value={formData.pipeline_stage} onChange={handleChange} className={inputClass}>
                <option value="all">All Stages</option>
                {['New','Contacted','Interested','Meeting Scheduled','Negotiation','Document Pending','Verification','Onboarding','Activated','Active Seller'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Period</label>
              <select name="period" required value={formData.period} onChange={handleChange} className={inputClass}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Priority</label>
              <select name="priority" required value={formData.priority} onChange={handleChange} className={inputClass}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Start Date</label>
              <input type="date" name="start_date" required value={formData.start_date} onChange={handleChange} className={inputClass} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500">End Date</label>
              <input type="date" name="end_date" required value={formData.end_date} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-500">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Describe the goal..." className={`${inputClass} resize-none`} />
          </div>
        </form>

        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>{isEdit ? 'Update Goal' : 'Create Goal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalModal;
