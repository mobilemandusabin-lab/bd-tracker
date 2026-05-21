import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Loader2, Save, Store, MapPin, ChevronDown } from 'lucide-react';
import { API_URL } from '../config/api';

const VendorModal = ({ isOpen, onClose, onSuccess, token }) => {
  const [users, setUsers] = useState([]);
  const [zoneGroups, setZoneGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [formData, setFormData] = useState({
    business_name: '', contact_person: '', phone: '', email: '',
    category: 'Wholesale', location: '', lead_source: 'Inbound',
    assigned_user: '', expected_product_count: 0, expected_monthly_sales: 0,
    lead_status: 'New', notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUsers(res.data.data.users))
        .catch(err => console.error('Error fetching users:', err));
      axios.get(`${API_URL}/delivery-zones`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setZoneGroups(res.data.data.groups || []))
        .catch(err => console.error('Error fetching zones:', err));
      setSelectedBranches([]);
      setShowBranches(false);
    }
  }, [isOpen, token]);

  const toggleBranch = (branchId, name) => {
    setSelectedBranches(prev => {
      const exists = prev.find(b => b.branchId === branchId);
      if (exists) return prev.filter(b => b.branchId !== branchId);
      return [...prev, { branchId, name }];
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading('Creating vendor...');
    try {
      await axios.post(`${API_URL}/leads`, { ...formData, type: 'vendor', service_branches: selectedBranches }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Vendor created!', { id: loadingToast });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create vendor', { id: loadingToast });
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <Store size={20} />
            <h2 className="text-lg font-extrabold uppercase tracking-wider">Add New Vendor</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Business Name</label>
              <input name="business_name" required onChange={handleChange} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Contact Person</label>
              <input name="contact_person" required onChange={handleChange} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Email Address</label>
              <input type="email" name="email" onChange={handleChange} placeholder="TBD if not available" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Phone Number</label>
              <input name="phone" required onChange={handleChange} maxLength={10} pattern="\d{10}" className={inputClass}
                onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Category</label>
              <select name="category" required onChange={handleChange} className={inputClass}>
                <option value="Wholesale">Wholesale</option>
                <option value="Retail">Retail</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Services">Services</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Location</label>
              <input name="location" required onChange={handleChange} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Assign To</label>
              <select name="assigned_user" onChange={handleChange} className={inputClass}>
                <option value="">Select Manager</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Lead Source</label>
              <select name="lead_source" required onChange={handleChange} className={inputClass}>
                <option value="Inbound">Inbound</option>
                <option value="Outbound">Outbound</option>
                <option value="Referral">Referral</option>
                <option value="Field Visit">Field Visit</option>
              </select>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-500">Service Branches</label>
            <div className="relative">
              <button type="button" onClick={() => setShowBranches(!showBranches)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-sm font-medium text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" />
                  {selectedBranches.length > 0 ? `${selectedBranches.length} branch${selectedBranches.length > 1 ? 'es' : ''} selected` : 'Select service branches'}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showBranches ? 'rotate-180' : ''}`} />
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
            </div>
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
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-500">Notes</label>
            <textarea name="notes" onChange={handleChange} rows="3" className={`${inputClass} resize-none`} />
          </div>
        </form>

        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>Save Vendor</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorModal;
