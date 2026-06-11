import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ListChecks, Plus, Edit3, Trash2, Save, X, Loader2,
  AlertCircle, ArrowUp, ArrowDown, GripVertical
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export default function ReportHeadingsPage() {
  const [departments, setDepartments] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', key: '', dataType: 'number', order: 0,
    hasChart: false, hasPrevValue: true, hasCurrentValue: true,
    hasTargetValue: true, hasNotes: false, suffix: ''
  });

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, headingRes] = await Promise.all([
        axios.get(`${API_URL}/departments`, { headers }),
        selectedDept
          ? axios.get(`${API_URL}/report-headings?departmentId=${selectedDept}`, { headers })
          : axios.get(`${API_URL}/report-headings`, { headers })
      ]);
      setDepartments(deptRes.data.data);
      setHeadings(headingRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedDept]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setEditId(null);
    setEditForm({
      name: '', key: '', dataType: 'number', order: 0,
      hasChart: false, hasPrevValue: true, hasCurrentValue: true,
      hasTargetValue: true, hasNotes: false, suffix: ''
    });
  };

  const startEdit = (h) => {
    setEditId(h._id);
    setEditForm({
      name: h.name, key: h.key, dataType: h.dataType, order: h.order,
      hasChart: h.hasChart, hasPrevValue: h.hasPrevValue,
      hasCurrentValue: h.hasCurrentValue, hasTargetValue: h.hasTargetValue,
      hasNotes: h.hasNotes, suffix: h.suffix || ''
    });
  };

  const handleSave = async () => {
    if (!selectedDept) return;
    try {
      const payload = { ...editForm, departmentId: selectedDept };
      if (editId) {
        await axios.put(`${API_URL}/report-headings/${editId}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/report-headings`, payload, { headers });
      }
      resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this heading?')) return;
    try {
      await axios.delete(`${API_URL}/report-headings/${id}`, { headers });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleReorder = async (id, newOrder) => {
    try {
      const updated = headings.map(h => ({
        _id: h._id,
        order: h._id === id ? newOrder : h.order + (h.order >= newOrder ? 1 : -1)
      }));
      await axios.patch(`${API_URL}/report-headings/reorder`, { items: updated }, { headers });
      fetchData();
    } catch (err) {
      alert('Reorder failed');
    }
  };

  const headingKeyToLabel = (key) => {
    const map = {
      totalVendors: 'Total Vendors', verifiedVendors: 'Verified Vendors',
      activeSellers: 'Active Sellers', vendorsAdded: 'Vendors Added',
      vendorsWithLessThan10: 'Vendors with <10 products',
      totalMarketplaceProducts: 'Marketplace Products',
      dailyAverageListings: 'Daily Avg Listings', backlogProducts: 'Backlog',
      totalProductsShown: 'Products Shown in Marketplace',
      totalSpecificationsAdded: 'Specs Added',
      specificationCompletionPercent: 'Spec Completion %',
      productsApproved: 'Products Approved',
      productsRejected: 'Products Rejected', productsPending: 'Products Pending'
    };
    return map[key] || key;
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1.5">
            <ListChecks size={20} className="text-white/80" />
            <h1 className="text-xl lg:text-2xl font-extrabold text-white">Report Headings</h1>
          </div>
          <p className="text-red-200 text-xs font-medium">Configure metrics per department</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Department Selector */}
      <div className="flex gap-2">
        {departments.map(d => (
          <button key={d._id} onClick={() => { setSelectedDept(d._id); resetForm(); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              selectedDept === d._id ? 'bg-red-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:border-red-300'
            }`}>
            {d.name}
          </button>
        ))}
      </div>

      {selectedDept && (
        <>
          {/* Add/Edit Form */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              {editId ? 'Edit Heading' : 'Add New Heading'}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</label>
                <input type="text" value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Total Vendors"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Key</label>
                <input type="text" value={editForm.key}
                  onChange={e => setEditForm(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="totalVendors"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data Type</label>
                <select value={editForm.dataType}
                  onChange={e => setEditForm(prev => ({ ...prev, dataType: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200">
                  <option value="number">Number</option>
                  <option value="percentage">Percentage</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</label>
                <input type="number" value={editForm.order}
                  onChange={e => setEditForm(prev => ({ ...prev, order: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Suffix</label>
                <input type="text" value={editForm.suffix}
                  onChange={e => setEditForm(prev => ({ ...prev, suffix: e.target.value }))}
                  placeholder="/day, %"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.hasChart}
                    onChange={e => setEditForm(prev => ({ ...prev, hasChart: e.target.checked }))}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-200" />
                  <span className="text-xs font-bold text-slate-500">Has Chart</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.hasNotes}
                    onChange={e => setEditForm(prev => ({ ...prev, hasNotes: e.target.checked }))}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-200" />
                  <span className="text-xs font-bold text-slate-500">Has Notes</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              <button onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
                <Save size={14} /> {editId ? 'Update' : 'Add'} Heading
              </button>
              {editId && (
                <button onClick={resetForm}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">
                  <X size={14} /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* Headings List */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Key</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                    <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Chart</th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {headings.filter(h => h.departmentId?._id === selectedDept || h.departmentId === selectedDept)
                    .sort((a, b) => a.order - b.order)
                    .map(h => (
                    <tr key={h._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleReorder(h._id, h.order - 1)}
                            disabled={h.order === 0}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30">
                            <ArrowUp size={12} />
                          </button>
                          <span className="text-sm font-bold text-slate-500 w-4 text-center">{h.order}</span>
                          <button onClick={() => handleReorder(h._id, h.order + 1)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400">
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-900">{h.name}</td>
                      <td className="px-5 py-3 text-sm font-mono text-slate-500">{h.key}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400">{h.dataType}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {h.hasChart ? <span className="text-emerald-600 text-xs">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(h)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(h._id)}
                            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {headings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <ListChecks size={36} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-sm font-bold text-slate-400">No headings for this department</p>
                        <p className="text-xs text-slate-400 mt-1">Add your first metric above</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
