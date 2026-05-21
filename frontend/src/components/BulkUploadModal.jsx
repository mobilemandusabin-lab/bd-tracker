import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { X, Upload, Loader2, User, FileSpreadsheet, AlertCircle } from 'lucide-react';
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
      axios.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUsers(res.data.data.users))
        .catch(() => toast.error('Failed to fetch user list'));
    }
  }, [isOpen, token]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setPreviewData(data);
      toast.success(`${data.length} records detected`);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async () => {
    if (!selectedUser) { toast.error('Please select an officer'); return; }
    if (!previewData.length) { toast.error('Please upload a valid file'); return; }
    setLoading(true);
    setUploadResults(null);
    const loadingToast = toast.loading(`Uploading ${previewData.length} records...`);
    try {
      const res = await axios.post(`${API_URL}/dashboard/bulk-upload`, { leads: previewData, assigned_user: selectedUser }, { headers: { Authorization: `Bearer ${token}` } });
      const { processed, failed, errors } = res.data.data;
      setUploadResults({ processed, failed, errors });
      if (failed === 0) {
        toast.success(`${processed} records uploaded!`, { id: loadingToast });
        setTimeout(() => { onSuccess(); onClose(); }, 2000);
      } else { toast.error(`${failed} records failed.`, { id: loadingToast }); }
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed', { id: loadingToast }); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom lg:zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-white">
            <Upload size={20} />
            <h2 className="text-lg font-extrabold uppercase tracking-wider">Bulk Upload</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {uploadResults ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Processed</p>
                  <h3 className="text-3xl font-extrabold text-emerald-700">{uploadResults.processed}</h3>
                </div>
                <div className="bg-red-50 p-5 rounded-2xl border border-red-100 text-center">
                  <p className="text-xs font-bold text-red-500 uppercase mb-1">Failed</p>
                  <h3 className="text-3xl font-extrabold text-red-700">{uploadResults.failed}</h3>
                </div>
              </div>
              {uploadResults.errors.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-500" /> Error Report
                  </h4>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {uploadResults.errors.map((err, idx) => (
                      <div key={idx} className="p-3 flex items-start gap-3">
                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-400">{idx + 1}</div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{err.vendor || 'Unknown'}</p>
                          <p className="text-[10px] font-bold text-red-500">{err.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setUploadResults(null)}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm uppercase hover:bg-red-700 transition-all shadow-sm">
                Upload New File
              </button>
            </div>
          ) : (
            <>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-sm font-bold text-red-900">Upload Format</h4>
                  <p className="text-xs text-red-700/70 mt-0.5">
                    Excel must include: <span className="font-bold text-red-900">Vendor Name</span> and <span className="font-bold text-red-900">Remark</span>. Optional: Contact Name, Phone, Email, Location, Category.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assign To Officer</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none appearance-none">
                    <option value="">Select Officer...</option>
                    {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Excel File</label>
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer group">
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 group-hover:text-red-500 transition-colors mb-3" />
                  <p className="text-sm font-bold text-slate-900">{file ? file.name : 'Click to select file'}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">XLSX or XLS</p>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                </label>
              </div>

              {previewData.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700">{previewData.length} records ready</span>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              )}
            </>
          )}
        </div>

        {!uploadResults && (
          <div className="px-6 py-4 bg-white border-t border-slate-100 flex gap-3 shrink-0">
            <button onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold text-sm hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button onClick={handleUpload} disabled={loading || !file || !selectedUser}
              className="flex-[2] px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-red-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>Upload</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadModal;
