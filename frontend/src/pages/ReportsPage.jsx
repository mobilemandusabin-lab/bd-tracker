import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FileText, Plus, Eye, Edit3, Trash2, Calendar,
  Loader2, AlertCircle, AlertTriangle, ChevronRight, Download,
  Target, Store, ShieldCheck, Package, ArrowRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targetCheckLoading, setTargetCheckLoading] = useState(false);
  const [targetCheckError, setTargetCheckError] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports?limit=50`, { headers });
      setReports(res.data.data.reports);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleNewReport = async () => {
    setTargetCheckLoading(true);
    setTargetCheckError(null);
    try {
      const res = await axios.get(`${API_URL}/reports/auto-fill`, { headers });
      const sections = res.data.data?.sections || [];
      const requiredKeys = ['totalListings', 'dailyAverageListings', 'totalSpecificationsAdded', 'totalVendors', 'verifiedVendors'];
      const missing = [];
      for (const section of sections) {
        for (const v of section.values) {
          if (requiredKeys.includes(v.headingKey) && v.targetValue == null) {
            missing.push(`${section.departmentName} → ${v.headingName}`);
          }
        }
      }
      if (missing.length > 0) {
        setTargetCheckError(
          `Set targets first in Listing/Vendor Snapshots for:\n${missing.join('\n')}`
        );
        return;
      }
      navigate('/reports/new');
    } catch (err) {
      setTargetCheckError('Failed to check targets. Please try again.');
    } finally {
      setTargetCheckLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return;
    try {
      await axios.delete(`${API_URL}/reports/${id}`, { headers });
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="text-red-500 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <FileText size={20} className="text-white/80" />
              <h1 className="text-xl lg:text-2xl font-extrabold text-white">Weekly Reports</h1>
            </div>
            <p className="text-red-200 text-xs font-medium">Manage weekly department reports</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleNewReport} disabled={targetCheckLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-red-700 rounded-xl text-sm font-bold hover:bg-red-50 transition-all shadow-sm disabled:opacity-50">
              {targetCheckLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {targetCheckLoading ? 'Checking...' : 'New Report'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-xl">
            <Target size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Set weekly targets</p>
            <p className="text-xs text-amber-700">Targets are configured in snapshot pages and auto-filled into reports</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/vendor-snapshots')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-50 transition-all shadow-sm border border-amber-200">
            <Store size={14} /> Vendor <ArrowRight size={12} />
          </button>
          <button onClick={() => navigate('/listing-snapshots')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-50 transition-all shadow-sm border border-amber-200">
            <Package size={14} /> Listing <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {targetCheckError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-800">Targets not set</p>
              <p className="text-xs text-red-700 mt-1 whitespace-pre-line">{targetCheckError}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => navigate('/vendor-snapshots')}
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all">
                  Vendor Snapshots
                </button>
                <button onClick={() => navigate('/listing-snapshots')}
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all">
                  Listing Snapshots
                </button>
                <button onClick={() => setTargetCheckError(null)}
                  className="px-4 py-1.5 bg-white text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-all">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Week</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Title</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Created By</th>
                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map(r => (
                <tr key={r._id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-900">{r.nepaliDate}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.title}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'published' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{r.createdBy?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/reports/${r._id}`)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => navigate(`/reports/${r._id}/edit`)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleDelete(r._id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <FileText size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-bold text-slate-400">No reports yet</p>
                    <p className="text-xs text-slate-400 mt-1">Create your first weekly report</p>
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
