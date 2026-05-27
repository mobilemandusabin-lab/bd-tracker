import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  UserPlus, Mail, Shield, Trash2, Edit, UserCheck, AlertCircle,
  Loader2, X, Plus, FileSpreadsheet, Upload, Search
} from 'lucide-react';
import { cn } from '../utils/cn';
import BulkUploadModal from '../components/BulkUploadModal';
import { API_URL } from '../config/api';

const UserModal = ({ isOpen, onClose, onSuccess, token, editingUser = null, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'user', team: '', status: 'active'
  });

  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name,
        email: editingUser.email,
        password: '',
        role: editingUser.role,
        team: editingUser.team || '',
        status: editingUser.status
      });
    } else {
      setFormData({ name: '', email: '', password: '', role: 'user', team: '', status: 'active' });
    }
  }, [editingUser, isOpen]);

  useEffect(() => {
    if (isOpen) {
      axios.get(`${API_URL}/roles`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setRoles(res.data.data.roles || []))
        .catch(() => {});
    }
  }, [isOpen, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading(editingUser ? 'Updating profile...' : 'Creating account...');
    try {
      if (editingUser) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await axios.patch(`${API_URL}/users/${editingUser._id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Profile updated', { id: loadingToast });
      } else {
        await axios.post(`${API_URL}/users`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Account created', { id: loadingToast });
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

  const availableRoles = roles.filter(role => {
    if (currentUser?.role === 'admin') {
      return role.name !== 'super_admin' && role.name !== 'viewer';
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 bg-red-600 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <UserPlus size={20} />
            <h2 className="text-lg font-bold uppercase tracking-wider">
              {editingUser ? 'Update User' : 'Add New Member'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Full Name</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Email Address</label>
            <input
              type="email" required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Password {editingUser && '(Leave blank to keep current)'}
            </label>
            <input
              type="password" required={!editingUser}
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">System Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
              >
                {availableRoles.map(role => (
                  <option key={role.name} value={role.name}>
                    {role.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Team</label>
            <select
              value={formData.team}
              onChange={(e) => setFormData({...formData, team: e.target.value})}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none font-medium text-sm"
            >
              <option value="">No Team</option>
              <option value="listing">Listing</option>
              <option value="qc">QC</option>
              <option value="bd">BD</option>
              <option value="management">Management</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Only QC and Listing teams can use the Chrome extension</p>
          </div>

          <div className="pt-3">
            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2"
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
  const [searchTerm, setSearchTerm] = useState('');
  const { token, user: currentUser } = useSelector((state) => state.auth);

  const handleExport = async () => {
    setExportLoading(true);
    const loadingToast = toast.loading('Generating report...');
    try {
      const res = await axios.get(`${API_URL}/dashboard/export-report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data.data.report;
      if (data.length === 0) {
        toast.error('No activity records found to export', { id: loadingToast });
        return;
      }
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Call Intelligence");
      const max_width = data.reduce((w, r) => Math.max(w, r['Vendor Name']?.length || 10), 10);
      worksheet["!cols"] = [ { wch: max_width }, { wch: 20 }, { wch: 20 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 20 } ];
      XLSX.writeFile(workbook, `BD_Tracker_Intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Report downloaded!', { id: loadingToast });
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
    if (!window.confirm('Are you sure you want to remove this user?')) return;
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

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term) ||
      user.team?.toLowerCase().includes(term) ||
      user.department?.name?.toLowerCase().includes(term) ||
      user.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <UserModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
        onSuccess={fetchUsers}
        token={token}
        editingUser={editingUser}
        currentUser={currentUser}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Enterprise Control</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Team Management</h1>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === 'super_admin' && (
            <>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
              >
                <Upload size={14} />
                <span>Bulk Upload</span>
              </button>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
              >
                {exportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                <span>Export</span>
              </button>
            </>
          )}
          <button
            onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all shadow-sm"
          >
            <UserPlus size={16} />
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

      {/* Search Input */}
      <div className="relative group">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none group-focus-within:text-red-400 transition-colors" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search users..."
          style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
          className="w-full py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading team...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <Search size={20} className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No users found</p>
            <p className="text-xs text-slate-400">Try adjusting your search term</p>
          </div>
        ) : filteredUsers.map(user => (
          <div key={user._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            {/* Decorative circle */}
            <div className={cn(
              "absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full opacity-[0.04] transition-transform group-hover:scale-110",
              user.role === 'super_admin' ? 'bg-red-600' : 'bg-red-400'
            )} />

            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-sm">
                {user.name ? user.name[0] : 'U'}
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                user.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
              )}>
                {user.status}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900 truncate">{user.name}</h3>
              <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                <Mail size={12} />
                <span className="text-xs font-medium truncate">{user.email}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={12} className="text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{user.role?.replace('_', ' ')}</span>
                {user.team && (
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${user.team === 'qc' ? 'bg-blue-50 text-blue-600' : user.team === 'listing' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {user.team}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!(currentUser?.role === 'admin' && (user.role === 'super_admin' || user.role === 'viewer')) && (
                  <>
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Edit size={14} />
                    </button>
                    {currentUser?._id !== user._id && (
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
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
