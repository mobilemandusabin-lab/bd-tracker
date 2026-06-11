import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  FileText, Save, Loader2, AlertCircle, ArrowLeft, Store,
  CheckSquare, Package, CheckCircle, ChevronDown, ChevronUp, FileDown,
  Edit3, Trash2, X, Plus, ArrowUp, ArrowDown, GripVertical, Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../components/ui/dialog';
import PptxPreview from '../components/PptxPreview';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const DEPT_ICONS = { 'Store': Store, 'CheckSquare': CheckSquare, 'Package': Package, 'CheckCircle': CheckCircle };

const REQUIRED_HEADINGS = {
  'Business Development': ['totalVendors', 'verifiedVendors'],
  'Listing': ['totalMarketplaceProducts', 'dailyAverageListings', 'backlogProducts', 'totalSpecificationsAdded', 'specificationCompletionPercent'],
  'Quality Control': ['productsApproved', 'productsRejected', 'productsPending'],
};

export default function ReportFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showAddHeading, setShowAddHeading] = useState(false);
  const [editingHeading, setEditingHeading] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [headingForm, setHeadingForm] = useState({
    name: '', key: '', dataType: 'number', order: 0,
    hasChart: false, hasPrevValue: true, hasCurrentValue: true,
    hasTargetValue: true, hasNotes: false, suffix: ''
  });

  const [form, setForm] = useState({
    weekStart: '',
    weekEnd: '',
    nepaliDate: '',
    title: '',
    sections: [],
    summary: { totalVendors: 0, totalVerifiedVendors: 0, totalMarketplaceProducts: 0, dailyAverageListings: 0 }
  });
  const [expandedSections, setExpandedSections] = useState({});
  const [headingsByDept, setHeadingsByDept] = useState({});
  const [editingHeadingDeptId, setEditingHeadingDeptId] = useState(null);
  const [loadingHeadings, setLoadingHeadings] = useState({});
  const [missingFields, setMissingFields] = useState(new Set());

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const isFormReady = useMemo(() => {
    for (const [deptName, headingKeys] of Object.entries(REQUIRED_HEADINGS)) {
      const section = form.sections.find(s =>
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
  }, [form.sections]);

  const fetchAutoFill = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/auto-fill`, { headers });
      const data = res.data.data;
      const ws = data.weekStart ? data.weekStart.split('T')[0] : '';
      const we = data.weekEnd ? data.weekEnd.split('T')[0] : '';
      setForm(prev => ({
        ...prev,
        weekStart: ws,
        weekEnd: we,
        nepaliDate: data.nepaliDate || '',
        title: data.nepaliDate ? `Weekly Report ${data.nepaliDate}` : '',
        sections: data.sections || [],
        summary: data.summary || prev.summary
      }));
      setMissingFields(new Set());
      const expanded = {};
      (data.sections || []).forEach(s => { expanded[s.departmentName] = true; });
      setExpandedSections(expanded);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load auto-fill data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/reports/${id}`, { headers });
      const r = res.data.data;
      setForm({
        weekStart: r.weekStart ? r.weekStart.split('T')[0] : '',
        weekEnd: r.weekEnd ? r.weekEnd.split('T')[0] : '',
        nepaliDate: r.nepaliDate || '',
        title: r.title || '',
        sections: r.sections || [],
        summary: r.summary || {}
      });
      setMissingFields(new Set());
      const expanded = {};
      (r.sections || []).forEach(s => { expanded[s.departmentName] = true; });
      setExpandedSections(expanded);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchHeadings = useCallback(async (departmentId) => {
    setLoadingHeadings(prev => ({ ...prev, [departmentId]: true }));
    try {
      const res = await axios.get(`${API_URL}/report-headings?departmentId=${departmentId}`, { headers });
      setHeadingsByDept(prev => ({
        ...prev,
        [departmentId]: res.data.data
      }));
    } catch (err) {
      console.error('Failed to load headings:', err);
    } finally {
      setLoadingHeadings(prev => ({ ...prev, [departmentId]: false }));
    }
  }, []);

  useEffect(() => {
    if (isEdit) fetchReport();
    else fetchAutoFill();
  }, [isEdit, fetchReport, fetchAutoFill]);

  useEffect(() => {
    if (form.sections.length > 0) {
      form.sections.forEach(section => {
        if (!headingsByDept[section.departmentId]) {
          fetchHeadings(section.departmentId);
        }
      });
    }
  }, [form.sections, headingsByDept, fetchHeadings]);

  const updateValue = (sectionIdx, valueIdx, field, val) => {
    const sections = [...form.sections];
    sections[sectionIdx] = { ...sections[sectionIdx] };
    sections[sectionIdx].values = [...sections[sectionIdx].values];
    sections[sectionIdx].values[valueIdx] = { ...sections[sectionIdx].values[valueIdx], [field]: val };
    setForm(prev => ({ ...prev, sections }));
    setMissingFields(prev => {
      const next = new Set(prev);
      next.delete(`${sectionIdx}:${valueIdx}:${field}`);
      return next;
    });
  };

  const scrollToFirstMissing = (keySet) => {
    for (const key of keySet) {
      const el = document.querySelector(`[data-field="${key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        break;
      }
    }
  };

  const updateNotes = (sectionIdx, val) => {
    const sections = [...form.sections];
    sections[sectionIdx] = { ...sections[sectionIdx], notes: val };
    setForm(prev => ({ ...prev, sections }));
  };

  const resetHeadingForm = () => {
    setEditingHeading(null);
    setEditingHeadingDeptId(null);
    setHeadingForm({
      name: '', key: '', dataType: 'number', order: 0,
      hasChart: false, hasPrevValue: true, hasCurrentValue: true,
      hasTargetValue: true, hasNotes: false, suffix: ''
    });
    setShowAddHeading(false);
  };

  const startEditHeading = (heading, departmentId) => {
    setEditingHeading(heading);
    setEditingHeadingDeptId(departmentId);
    setHeadingForm({
      name: heading.name,
      key: heading.key,
      dataType: heading.dataType,
      order: heading.order,
      hasChart: heading.hasChart,
      hasPrevValue: heading.hasPrevValue,
      hasCurrentValue: heading.hasCurrentValue,
      hasTargetValue: heading.hasTargetValue,
      hasNotes: heading.hasNotes,
      suffix: heading.suffix || ''
    });
    setShowAddHeading(true);
  };

  const handleSaveHeading = async () => {
    if (!headingForm.name || !headingForm.key) {
      setError('Name and Key are required');
      return;
    }

    const departmentId = editingHeadingDeptId || (editingHeading?.departmentId) || form.sections[0]?.departmentId;
    if (!departmentId) {
      setError('Department not found');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...headingForm,
        departmentId
      };

      if (editingHeading) {
        await axios.put(`${API_URL}/report-headings/${editingHeading._id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/report-headings`, payload, { headers });
      }

      resetHeadingForm();
      await fetchHeadings(departmentId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save heading');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHeading = async (headingId, departmentId) => {
    if (!confirm('Delete this heading?')) return;
    try {
      await axios.delete(`${API_URL}/report-headings/${headingId}`, { headers });
      await fetchHeadings(departmentId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete heading');
    }
  };

  const handleReorderHeadings = async (departmentId, items) => {
    try {
      await axios.patch(`${API_URL}/report-headings/reorder`, { items }, { headers });
      await fetchHeadings(departmentId);
    } catch (err) {
      setError('Failed to reorder headings');
    }
  };

  const getMissingFields = useCallback(() => {
    const missing = [];
    const missingSet = new Set();
    for (const [deptName, headingKeys] of Object.entries(REQUIRED_HEADINGS)) {
      const section = form.sections.find(s =>
        s.departmentName.toLowerCase().includes(deptName.toLowerCase().split(' ')[0])
      );
      if (!section) {
        missing.push(`${deptName}: section not found`);
        continue;
      }
      const sIdx = form.sections.indexOf(section);
      for (const key of headingKeys) {
        const vIdx = section.values.findIndex(v => v.headingKey === key);
        const label = headingsByDept[section.departmentId]?.find(h => h.key === key)?.name || key;
        if (vIdx === -1) {
          missing.push(`${section.departmentName} → ${label}: row missing`);
          continue;
        }
        const value = section.values[vIdx];
        if (value.previousValue === null || value.previousValue === undefined) {
          missing.push(`${section.departmentName} → ${label}: Previous Week missing`);
          missingSet.add(`${sIdx}:${vIdx}:previousValue`);
        }
        if (value.currentValue === null || value.currentValue === undefined) {
          missing.push(`${section.departmentName} → ${label}: Current Status missing`);
          missingSet.add(`${sIdx}:${vIdx}:currentValue`);
        }
        if (value.targetValue === null || value.targetValue === undefined) {
          missing.push(`${section.departmentName} → ${label}: Next Week Target missing`);
          missingSet.add(`${sIdx}:${vIdx}:targetValue`);
        }
      }
    }
    return { messages: missing, keySet: missingSet };
  }, [form.sections, headingsByDept]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMissingFields(new Set());

    const { messages: missing, keySet } = getMissingFields();
    if (missing.length > 0) {
      setMissingFields(keySet);
      setError(`Fill required fields first:\n• ${missing.join('\n• ')}`);
      scrollToFirstMissing(keySet);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        weekStart: form.weekStart,
        weekEnd: form.weekEnd,
        nepaliDate: form.nepaliDate,
        title: form.title,
        sections: form.sections,
        summary: form.summary
      };

      if (isEdit) {
        await axios.put(`${API_URL}/reports/${id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/reports`, payload, { headers });
      }

      setSuccess(true);
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={28} className="text-red-500 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {isEdit ? 'Loading report...' : 'Preparing auto-fill...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">
              {isEdit ? 'Edit Report' : 'New Weekly Report'}
            </h1>
            <p className="text-xs text-slate-400">{form.nepaliDate}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEdit && id && (<>
            <button onClick={async () => {
                const { messages: missing, keySet } = getMissingFields();
                if (missing.length > 0) {
                  setMissingFields(keySet);
                  setError(`Cannot generate PPTX — fill required fields first:\n• ${missing.join('\n• ')}`);
                  scrollToFirstMissing(keySet);
                  return;
                }
                setDownloading(true);
                try {
                  const res = await axios.post(`${API_URL}/reports/${id}/generate-pptx`, {}, { headers, responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${form.title.replace(/\s+/g, '_')}.pptx`;
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
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
              <FileDown size={14} /> {downloading ? 'Generating...' : 'Download PPTX'}
            </button>
            <button onClick={async () => {
                const { messages: missing, keySet } = getMissingFields();
                if (missing.length > 0) {
                  setMissingFields(keySet);
                  setError(`Cannot generate PDF — fill required fields first:\n• ${missing.join('\n• ')}`);
                  scrollToFirstMissing(keySet);
                  return;
                }
                setDownloading(true);
                try {
                  const res = await axios.post(`${API_URL}/reports/${id}/generate-pdf`, {}, { headers, responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${form.title.replace(/\s+/g, '_')}.pdf`;
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
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50">
              <FileText size={14} /> {downloading ? 'Generating...' : 'Download PDF'}
            </button>
            </>)}
          <button onClick={handleSave} disabled={saving || success}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              success ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
            }`}>
            {success ? <><CheckCircle size={15} /> Saved</> :
             saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> :
             <><Save size={15} /> {isEdit ? 'Update Report' : 'Publish Report'}</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      {!isFormReady && form.sections.length > 0 && !error && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800 mb-1">Required fields missing</p>
            <p className="text-xs text-amber-700">Fill all fields marked with <span className="text-red-500 font-bold">*</span> (Previous Week, Current Status, Next Week Target) for all required departments to enable publish and download.</p>
          </div>
        </div>
      )}

      {/* Report Details Card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-4">Report Details</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Week Start (Sat)</label>
            <input type="date" value={form.weekStart}
              onChange={e => setForm(prev => ({ ...prev, weekStart: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Week End (Fri)</label>
            <input type="date" value={form.weekEnd}
              onChange={e => setForm(prev => ({ ...prev, weekEnd: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Title</label>
            <input type="text" value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
        </div>
      </div>

      {/* Department Sections */}
      {form.sections.map((section, sIdx) => {
        const deptRequiredKeys = [];
        for (const [name, keys] of Object.entries(REQUIRED_HEADINGS)) {
          if (section.departmentName.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
            deptRequiredKeys.push(...keys);
          }
        }
        const isRequired = (key) => deptRequiredKeys.includes(key);

        return (
        <div key={sIdx} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setExpandedSections(prev => ({ ...prev, [section.departmentName]: !prev[section.departmentName] }))}
            className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-red-50 p-2 rounded-xl">
                <Store size={16} className="text-red-600" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">{section.departmentName}
                {deptRequiredKeys.length > 0 && <span className="text-red-500 ml-1">*</span>}
              </h3>
            </div>
            {expandedSections[section.departmentName] ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>

          {expandedSections[section.departmentName] && (
            <div className="px-4 lg:px-5 pb-5 space-y-4">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-700">Metrics</h4>
               <button
                   onClick={() => {
                     setEditingHeadingDeptId(section.departmentId);
                     setShowAddHeading(true);
                   }}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-100"
                 >
                   <Plus size={14} /> Add Metric
                 </button>
              </div>

              {/* Values Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 rounded-xl">
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Metric</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Previous Week</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Status</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Week Target</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {section.values.map((val, vIdx) => (
                      <tr key={vIdx}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">
                          {val.headingName}
                          {isRequired(val.headingKey) && <span className="text-red-500 ml-0.5">*</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" value={val.previousValue ?? ''}
                            data-field={`${sIdx}:${vIdx}:previousValue`}
                            onChange={e => updateValue(sIdx, vIdx, 'previousValue', e.target.value ? Number(e.target.value) : null)}
                            className={`w-full text-right px-3 py-2 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-200 ${
                              isRequired(val.headingKey) && (val.previousValue === null || val.previousValue === undefined)
                                ? missingFields.has(`${sIdx}:${vIdx}:previousValue`) ? 'border-red-400 bg-red-50 text-slate-700 animate-[field-pulse_1.5s_ease-in-out_infinite]' : 'border-red-300 bg-red-50 text-slate-700'
                                : 'border-slate-200 text-slate-700'
                            }`} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" value={val.currentValue ?? ''}
                            data-field={`${sIdx}:${vIdx}:currentValue`}
                            onChange={e => updateValue(sIdx, vIdx, 'currentValue', e.target.value ? Number(e.target.value) : null)}
                            className={`w-full text-right px-3 py-2 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-200 ${
                              isRequired(val.headingKey) && (val.currentValue === null || val.currentValue === undefined)
                                ? missingFields.has(`${sIdx}:${vIdx}:currentValue`) ? 'border-red-400 bg-red-50 text-slate-900 animate-[field-pulse_1.5s_ease-in-out_infinite]' : 'border-red-300 bg-red-50 text-slate-900'
                                : 'border-slate-200 text-slate-900'
                            }`} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" value={val.targetValue ?? ''}
                            data-field={`${sIdx}:${vIdx}:targetValue`}
                            onChange={e => updateValue(sIdx, vIdx, 'targetValue', e.target.value ? Number(e.target.value) : null)}
                            className={`w-full text-right px-3 py-2 border rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-200 ${
                              isRequired(val.headingKey) && (val.targetValue === null || val.targetValue === undefined)
                                ? missingFields.has(`${sIdx}:${vIdx}:targetValue`) ? 'border-red-400 bg-red-50 text-amber-700 animate-[field-pulse_1.5s_ease-in-out_infinite]' : 'border-red-300 bg-red-50 text-amber-700'
                                : val.targetValue != null ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'border-slate-200 text-slate-700'
                            }`} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                             <button
                               onClick={() => {
                                 const headings = [...(headingsByDept[section.departmentId] || [])];
                                 const currentIndex = headings.findIndex(h => h._id === val.headingId);
                                 if (currentIndex > 0) {
                                   const temp = headings[currentIndex];
                                   headings[currentIndex] = headings[currentIndex - 1];
                                   headings[currentIndex - 1] = temp;
                                   const reordered = headings.map((h, idx) => ({ ...h, order: idx }));
                                   handleReorderHeadings(section.departmentId, reordered);
                                 }
                               }}
                               disabled={vIdx === 0}
                               className="p-1.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30 transition-all"
                             >
                               <ArrowUp size={14} />
                             </button>
                             <button
                               onClick={() => {
                                 const headings = [...(headingsByDept[section.departmentId] || [])];
                                 const currentIndex = headings.findIndex(h => h._id === val.headingId);
                                 if (currentIndex < headings.length - 1) {
                                   const temp = headings[currentIndex];
                                   headings[currentIndex] = headings[currentIndex + 1];
                                   headings[currentIndex + 1] = temp;
                                   const reordered = headings.map((h, idx) => ({ ...h, order: idx }));
                                   handleReorderHeadings(section.departmentId, reordered);
                                 }
                               }}
                               disabled={vIdx === section.values.length - 1}
                               className="p-1.5 rounded hover:bg-slate-100 text-slate-400 disabled:opacity-30 transition-all"
                             >
                               <ArrowDown size={14} />
                             </button>
                             <button
                               onClick={() => startEditHeading(val, section.departmentId)}
                               className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                             >
                               <Edit3 size={14} />
                             </button>
                             <button
                               onClick={() => handleDeleteHeading(val.headingId, section.departmentId)}
                               className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                             >
                               <Trash2 size={14} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Narrative / Notes</label>
                <textarea value={section.notes || ''}
                  onChange={e => updateNotes(sIdx, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                  placeholder="Add narrative about this department's performance this week..." />
              </div>
            </div>
          )}
        </div>
      )})}

      {/* Summary */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 mb-4">Summary (Slide 9 KPI Cards)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'totalVendors', label: 'Total Vendors' },
            { key: 'totalVerifiedVendors', label: 'Total Verified Vendors' },
            { key: 'totalMarketplaceProducts', label: 'Marketplace Products' },
            { key: 'dailyAverageListings', label: 'Daily Avg Listings' }
          ].map(m => (
            <div key={m.key}>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{m.label}</label>
              <input type="number" value={form.summary?.[m.key] ?? ''}
                onChange={e => setForm(prev => ({
                  ...prev,
                  summary: { ...prev.summary, [m.key]: e.target.value ? Number(e.target.value) : 0 }
                }))}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Save & Preview */}
      <div className="flex items-center justify-between">
        <button onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
            showPreview ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <Eye size={14} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
        <button onClick={handleSave} disabled={saving || success}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
            success ? 'bg-emerald-500 text-white' : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
          }`}>
          {success ? <><CheckCircle size={16} /> Published</> :
           saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> :
           <><Save size={16} /> {isEdit ? 'Update Report' : 'Publish Report'}</>}
        </button>
      </div>

      {showPreview && (
        <PptxPreview sections={form.sections} summary={form.summary} />
      )}

      {/* Heading Modal */}
      <Dialog open={showAddHeading} onOpenChange={setShowAddHeading}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editingHeading ? 'Edit Metric' : 'Add New Metric'}</DialogTitle>
            <DialogDescription>
              {editingHeading
                ? 'Update the metric configuration for this department'
                : 'Add a new metric to track for this department'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</label>
                <input
                  type="text"
                  value={headingForm.name}
                  onChange={e => setHeadingForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Total Vendors"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Key</label>
                <input
                  type="text"
                  value={headingForm.key}
                  onChange={e => setHeadingForm(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="totalVendors"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data Type</label>
                <select
                  value={headingForm.dataType}
                  onChange={e => setHeadingForm(prev => ({ ...prev, dataType: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="number">Number</option>
                  <option value="percentage">Percentage</option>
                  <option value="text">Text</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</label>
                <input
                  type="number"
                  value={headingForm.order}
                  onChange={e => setHeadingForm(prev => ({ ...prev, order: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Suffix</label>
                <input
                  type="text"
                  value={headingForm.suffix}
                  onChange={e => setHeadingForm(prev => ({ ...prev, suffix: e.target.value }))}
                  placeholder="/day, %"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headingForm.hasChart}
                    onChange={e => setHeadingForm(prev => ({ ...prev, hasChart: e.target.checked }))}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-200"
                  />
                  <span className="text-xs font-bold text-slate-500">Has Chart</span>
                </label>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={headingForm.hasNotes}
                    onChange={e => setHeadingForm(prev => ({ ...prev, hasNotes: e.target.checked }))}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-200"
                  />
                  <span className="text-xs font-bold text-slate-500">Has Notes</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter showCloseButton={false}>
            <DialogClose asChild>
              <button
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                onClick={resetHeadingForm}
              >
                Cancel
              </button>
            </DialogClose>
            <button
              onClick={handleSaveHeading}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editingHeading ? 'Update Metric' : 'Add Metric'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
