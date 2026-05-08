import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Edit, 
  UserCheck, 
  AlertCircle,
  Loader2,
  X,
  Plus,
  FileSpreadsheet,
  Upload
} from 'lucide-react';
import { cn } from '../utils/cn';
import BulkUploadModal from '../components/BulkUploadModal';
import { API_URL } from '../config/api';

const UserModal = ({ isOpen, onClose, onSuccess, token, editingUser = null, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active'
  });

  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name,
        email: editingUser.email,
        password: '', // Don't show password
        role: editingUser.role,
        status: editingUser.status
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'user',
        status: 'active'
      });
    }
  }, [editingUser, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading(editingUser ? 'Synchronizing profile...' : 'Provisioning new account...');
    try {
      if (editingUser) {
        // Remove password if empty for update
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        
        await axios.patch(`${API_URL}/users/${editingUser._id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Officer profile updated', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/users`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('New officer commissioned', { id: loadingToast });
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter roles based on current user's role
  const availableRoles = [
    { value: 'user', label: 'User (BD Team)' },
    { value: 'admin', label: 'Admin (Manager)' },
    { value: 'viewer', label: 'Viewer (Finance)' },
    { value: 'super_admin', label: 'Super Admin' }
  ].filter(role => {
    if (currentUser?.role === 'admin') {
      // Admins cannot create/manage Super Admins or Viewers (Finance)
      return role.value !== 'super_admin' && role.value !== 'viewer';
    }
    return true; // Super Admins can see all
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-8 py-6 bg-red-600 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <UserPlus size={24} />
            <h2 className="text-xl font-black uppercase tracking-widest">
              {editingUser ? 'Update User' : 'Add New Member'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
            <input 
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</label>
            <input 
              type="email" required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Password {editingUser && '(Leave blank to keep current)'}
            </label>
            <input 
              type="password" required={!editingUser}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Role</label>
              <select 
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              >
                {availableRoles.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" disabled={loading}
              className="w-full py-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
              <span>{editingUser ? 'Commit Changes' : 'Activate Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { token, user: currentUser } = useSelector((state) => state.auth);

  const handleExport = async () => {
    setExportLoading(true);
    const loadingToast = toast.loading('Generating Intelligence Report...');
    try {
      const res = await axios.get(`${API_URL}/dashboard/export-report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = res.data.data.report;
      
      if (data.length === 0) {
        toast.error('No activity records found to export', { id: loadingToast });
        return;
      }

      // Excel Generation
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Call Intelligence");
      
      // Auto-size columns
      const max_width = data.reduce((w, r) => Math.max(w, r['Vendor Name']?.length || 10), 10);
      worksheet["!cols"] = [ { wch: max_width }, { wch: 20 }, { wch: 20 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 20 } ];

      XLSX.writeFile(workbook, `BD_Tracker_Intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Enterprise Report downloaded successfully!', { id: loadingToast });
    } catch (err) {
      toast.error('Failed to generate report', { id: loadingToast });
    } finally {
      setExportLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data.users);
    } catch (err) {
      toast.error('Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this officer?')) return;
    try {
      await axios.delete(`${API_URL}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }} 
        onSuccess={fetchUsers} 
        token={token}
        editingUser={editingUser}
        currentUser={currentUser}
      />
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-8 bg-red-600 rounded-full" />
            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Enterprise Control</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Team Management</h1>
        </div>
        <div className="flex items-center gap-3">
            {currentUser?.role === 'super_admin' && (
              <>
                <button 
                  onClick={() => setIsBulkModalOpen(true)}
                  className="flex items-center gap-3 px-6 py-4 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
                >
                  <Upload size={18} />
                  <span>Bulk Upload</span>
                </button>
                <button 
                  onClick={handleExport}
                  disabled={exportLoading}
                  className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
                >
                  {exportLoading ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                  <span>Export Audit Log</span>
                </button>
              </>
            )}
            <button 
              onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
              className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-200"
            >
              <UserPlus size={18} />
              <span>Onboard Member</span>
            </button>
          </div>
        </div>

        <BulkUploadModal 
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          token={token}
          onSuccess={fetchUsers}
        />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-red-600" size={40} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronizing Directory...</p>
          </div>
        ) : users.map(user => (
          <div key={user._id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
            <div className={cn(
              "absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110",
              user.role === 'super_admin' ? 'bg-red-600' : 'bg-slate-900'
            )} />
            
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-xl shadow-slate-100">
                {user.name ? user.name[0] : 'U'}
              </div>
              <div className={cn(
                "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                user.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
              )}>
                {user.status}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 truncate">{user.name}</h3>
              <div className="flex items-center gap-2 text-slate-400">
                <Mail size={12} />
                <span className="text-xs font-bold truncate">{user.email}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{user.role}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Managers cannot edit or delete Super Admins or Finance roles */}
                {!(currentUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'viewer')) && (
                  <>
                    <button 
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Edit size={16} />
                    </button>
                    {currentUser?._id !== user._id && (
                      <button 
                        onClick={() => handleDelete(user._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersPage;
