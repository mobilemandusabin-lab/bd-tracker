import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { X, Upload, Loader2, User, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';

import { API_URL } from '../config/api';

const BulkUploadModal = ({ isOpen, onClose, token, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [uploadResults, setUploadResults] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const res = await axios.get(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUsers(res.data.data.users);
        } catch (err) {
          toast.error('Failed to fetch user list');
        }
      };
      fetchUsers();
    }
  }, [isOpen, token]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setPreviewData(data);
      toast.success(`${data.length} records detected in file`);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async () => {
    if (!selectedUser) {
      toast.error('Please select an officer to assign these leads');
      return;
    }
    if (!previewData.length) {
      toast.error('Please upload a valid Excel file with lead data');
      return;
    }

    setLoading(true);
    setUploadResults(null);
    const loadingToast = toast.loading(`Uploading ${previewData.length} intelligence assets...`);
    try {
      const res = await axios.post(`${API_URL}/dashboard/bulk-upload`, {
        leads: previewData,
        assigned_user: selectedUser
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { processed, failed, errors } = res.data.data;
      setUploadResults({ processed, failed, errors });
      
      if (failed === 0) {
        toast.success(`Successfully uploaded ${processed} records!`, { id: loadingToast });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        toast.error(`Ingestion incomplete: ${failed} records failed.`, { id: loadingToast });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk upload failed', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="px-10 py-8 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-white">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest">Bulk Intelligence Ingestion</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Mass lead synchronization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
          {uploadResults ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Processed</p>
                  <h3 className="text-3xl font-black text-emerald-700">{uploadResults.processed}</h3>
                </div>
                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 text-center">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Failed</p>
                  <h3 className="text-3xl font-black text-rose-700">{uploadResults.failed}</h3>
                </div>
              </div>

              {uploadResults.errors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} className="text-rose-500" />
                    Error Intelligence Report
                  </h4>
                  <div className="bg-slate-50 rounded-[2rem] border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {uploadResults.errors.map((err, idx) => (
                      <div key={idx} className="p-4 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 text-[10px] font-black text-slate-400">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{err.vendor || 'Unknown Vendor'}</p>
                          <p className="text-[10px] font-bold text-rose-500 mt-0.5">{err.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setUploadResults(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
              >
                Reset & Upload New File
              </button>
            </div>
          ) : (
            <>
              <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-start gap-4">
                <AlertCircle className="text-red-600 shrink-0 mt-1" size={20} />
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">Enterprise Ingestion Format</h4>
<p className="text-xs font-bold text-red-700/70 mt-1 leading-relaxed">
                        Excel must include: <span className="text-red-900">Vendor Name</span> and <span className="text-red-900">Remark</span>. Optional fields: <span className="text-red-900">Contact Name, Phone, Email, Location, Category</span>.
                      </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign to Officer</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-red-600/20 focus:border-red-600 outline-none transition-all appearance-none"
                  >
                    <option value="">Select Target Officer...</option>
                    {users.map(user => (
                      <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excel Data Source</label>
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50 hover:bg-slate-100 hover:border-red-200 transition-all cursor-pointer group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileSpreadsheet className="w-12 h-12 text-slate-300 group-hover:text-red-600 transition-colors mb-4" />
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      {file ? file.name : 'Click to select Excel file'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">XLSX or XLS supported</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                </label>
              </div>

              {previewData.length > 0 && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Payload Ready: {previewData.length} records</span>
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-emerald-200" />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!uploadResults && (
          <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
            <button 
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100 hover:text-slate-900 transition-all"
            >
              Cancel Ingestion
            </button>
            <button 
              onClick={handleUpload}
              disabled={loading || !file || !selectedUser}
              className="flex-[2] px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              <span>Execute Bulk Ingestion</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadModal;