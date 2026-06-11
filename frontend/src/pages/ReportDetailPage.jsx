import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FileText, Calendar, Store, Loader2, AlertCircle,
  ArrowLeft, Edit3, Download, FileDown, Eye
} from 'lucide-react';
import PptxPreview from '../components/PptxPreview';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const REQUIRED_HEADINGS = {
  'Business Development': ['totalVendors', 'verifiedVendors'],
  'Listing': ['totalMarketplaceProducts', 'dailyAverageListings', 'backlogProducts', 'totalSpecificationsAdded', 'specificationCompletionPercent'],
  'Quality Control': ['productsApproved', 'productsRejected', 'productsPending'],
};

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const isFormReady = useMemo(() => {
    if (!report) return false;
    for (const [deptName, headingKeys] of Object.entries(REQUIRED_HEADINGS)) {
      const section = report.sections.find(s =>
        s.departmentName.toLowerCase().includes(deptName.toLowerCase().split(' ')[0])
      );
      if (!section) return false;
      for (const key of headingKeys) {
        const value = section.values.find(v => v.headingKey === key);
        if (!value) return false;
        if (value.previousValue === null || value.previousValue === undefined) return false;
        if (value.currentValue === null || value.currentValue === undefined) return false;
        if (value.targetValue === null || value.targetValue === undefined) return false;
      }
    }
    return true;
  }, [report]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/${id}`, { headers });
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="text-red-500 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
        <AlertCircle size={16} className="text-red-500 shrink-0" />
        <p className="text-xs text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">{report.title}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Calendar size={12} />
              {report.nepaliDate} ({formatDate(report.weekStart)} - {formatDate(report.weekEnd)})
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
              setDownloading(true);
              try {
                const res = await axios.post(`${API_URL}/reports/${id}/generate-pptx`, {}, {
                  headers: { Authorization: `Bearer ${token}` },
                  responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${report.title.replace(/\s+/g, '_')}.pptx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                let msg = 'Failed to generate PPTX';
                if (err.response?.data instanceof Blob) {
                  try { const t = await err.response.data.text(); const j = JSON.parse(t); msg = j.message || msg; } catch (e) {}
                } else if (err.response?.data?.message) {
                  msg = err.response.data.message;
                }
                setError(msg);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading || !isFormReady}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
            <FileDown size={14} /> {downloading ? 'Generating...' : 'Download PPTX'}
          </button>
          <button onClick={async () => {
              setDownloading(true);
              try {
                const res = await axios.post(`${API_URL}/reports/${id}/generate-pdf`, {}, {
                  headers: { Authorization: `Bearer ${token}` },
                  responseType: 'blob'
                });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `${report.title.replace(/\s+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                let msg = 'Failed to generate PDF';
                if (err.response?.data instanceof Blob) {
                  try { const t = await err.response.data.text(); const j = JSON.parse(t); msg = j.message || msg; } catch (e) {}
                } else if (err.response?.data?.message) {
                  msg = err.response.data.message;
                }
                setError(msg);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading || !isFormReady}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
            <FileText size={14} /> {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={() => navigate(`/reports/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
            <Edit3 size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Department Sections */}
      {report.sections?.map((section, sIdx) => (
        <div key={sIdx} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-4 lg:p-5 border-b border-slate-50">
            <div className="bg-red-50 p-2 rounded-xl">
              <Store size={16} className="text-red-600" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{section.departmentName}</h3>
          </div>
          <div className="p-4 lg:p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 rounded-xl">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Metric</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Previous Week</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Status</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {section.values?.map((val, vIdx) => (
                    <tr key={vIdx}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{val.headingName}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-500">{val.previousValue ?? '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-extrabold text-slate-900">{val.currentValue ?? '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-red-600">{val.targetValue ?? '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {section.notes && (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{section.notes}</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Summary */}
      {report.summary && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4">Summary</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'totalVendors', label: 'Total Vendors' },
              { key: 'totalVerifiedVendors', label: 'Verified Vendors' },
              { key: 'totalMarketplaceProducts', label: 'Marketplace Products' },
              { key: 'dailyAverageListings', label: 'Daily Avg Listings' }
            ].map(m => (
              <div key={m.key} className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{m.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{report.summary?.[m.key] ?? '-'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
            showPreview ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <Eye size={14} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showPreview && (
        <PptxPreview sections={report.sections} summary={report.summary} />
      )}
    </div>
  );
}
