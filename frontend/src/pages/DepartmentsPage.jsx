import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Building2, Plus, Edit3, Trash2, Save, X, Loader2,
  AlertCircle, ArrowUp, ArrowDown
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: ''
  });

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/departments`, { headers });
      setDepartments(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setEditId(null);
    setEditForm({ name: '' });
  };

  const startEdit = (dept) => {
    setEditId(dept._id);
    setEditForm({ name: dept.name });
  };

  const handleSave = async () => {
    try {
      const payload = { ...editForm };
      if (editId) {
        await axios.put(`${API_URL}/departments/${editId}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/departments`, payload, { headers });
      }
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this department? This will remove all users from this department. Please reassign users first.')) return;
    try {
      await axios.delete(`${API_URL}/departments/${id}`, { headers });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 size={20} className="text-white/80" />
            <h1 className="text-xl lg:text-2xl font-extrabold text-white">Departments</h1>
          </div>
          <p className="text-red-200 text-xs font-medium">Manage organizational departments</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">
          {editId ? 'Edit Department' : 'Add New Department'}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Department Name</label>
            <input type="text" value={editForm.name}
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Business Development"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
            <Save size={14} /> {editId ? 'Update' : 'Add'} Department
          </button>
          {editId && (
            <button onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {departments.map(dept => (
                <tr key={dept._id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">{dept.name}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(dept)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(dept._id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-12 text-center">
                    <Building2 size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No departments yet</p>
                    <p className="text-xs text-slate-400 mt-1">Add your first department above</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}