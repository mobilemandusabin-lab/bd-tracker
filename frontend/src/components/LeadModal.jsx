import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Save, UserPlus } from 'lucide-react';
import { cn } from '../utils/cn';

import { API_URL } from '../config/api';

const LeadModal = ({ isOpen, onClose, onSuccess, token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [duplicity, setDuplicity] = useState({ business_name: false, phone: false });
  const [formData, setFormData] = useState({
    business_name: '',
    contact_person: '',
    phone: '',
    email: '',
    category: '',
    location: '',
    lead_source: 'Inbound',
    assigned_user: '',
    expected_product_count: 0,
    expected_monthly_sales: 0,
    lead_status: 'New',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const res = await axios.get(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(res.data.data.users);
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      };
      fetchUsers();
    }
  }, [isOpen, token]);

  const checkDuplicity = async (field, value) => {
    if (!value) return;
    try {
      const res = await axios.get(`${API_URL}/leads/check-duplicity?field=${field}&value=${value}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDuplicity(prev => ({ ...prev, [field]: res.data.exists }));
    } catch (err) {
      console.error('Duplicity check failed:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === 'business_name' || (name === 'phone' && /^\d{10}$/.test(value))) {
      checkDuplicity(name, value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (duplicity.business_name || duplicity.phone) {
      toast.error('Cannot save: Duplicate record detected in enterprise directory');
      return;
    }
    setLoading(true);
    const loadingToast = toast.loading('Capturing new lead intelligence...');
    try {
      await axios.post(`${API_URL}/leads`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Lead captured successfully!', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to capture lead', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 bg-red-600 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <UserPlus size={24} />
            <h2 className="text-xl font-black uppercase tracking-widest">Capture New Lead</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name</label>
              <input 
                name="business_name" required onChange={handleChange} onBlur={handleBlur}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none font-bold text-sm transition-all",
                  duplicity.business_name ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 focus:ring-red-600"
                )}
              />
              {duplicity.business_name && <p className="text-[10px] font-bold text-red-500 uppercase">Business already exists!</p>}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contact Person</label>
              <input 
                name="contact_person" required onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
              <input 
                type="email" name="email" onChange={handleChange} placeholder="TBD if not available"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              />
            </div>
<div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</label>
               <input 
                 name="phone" required onChange={handleChange} onBlur={handleBlur} maxLength={10} pattern="\d{10}"
                 className={cn(
                   "w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none font-bold text-sm transition-all",
                   duplicity.phone ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 focus:ring-red-600"
                 )}
                 onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }}
               />
               {duplicity.phone && <p className="text-[10px] font-bold text-red-500 uppercase">Phone number already exists!</p>}
             </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category</label>
              <input 
                name="category" required onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</label>
              <input 
                name="location" required onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign Account Manager</label>
              <select 
                name="assigned_user" onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              >
                <option value="">Select Manager</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lead Source</label>
              <select 
                name="lead_source" required onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              >
                <option value="Inbound">Inbound</option>
                <option value="Outbound">Outbound</option>
                <option value="Referral">Referral</option>
                <option value="Field Visit">Field Visit</option>
              </select>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</label>
            <textarea 
              name="notes" onChange={handleChange} rows="3"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
            ></textarea>
          </div>
        </form>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">
            Cancel
          </button>
          <button 
            onClick={handleSubmit} disabled={loading}
            className="px-8 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>Save Enterprise Lead</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadModal;
