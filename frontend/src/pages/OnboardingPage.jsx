import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  Phone,
  Mail,
  MoreVertical,
  ShieldCheck,
  Building2,
  Pencil
} from 'lucide-react';
import { cn } from '../utils/cn';
import VendorDetailModal from '../components/VendorDetailModal';
import VendorActionModal from '../components/VendorActionModal';

import { API_URL } from '../config/api';

const OnboardingPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const { token } = useSelector((state) => state.auth);

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(res.data.data.vendors);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [token]);

  const handleDetail = (vendor) => {
    setSelectedVendor(vendor);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (vendor) => {
    setSelectedVendor(vendor);
    setIsActionModalOpen(true);
  };

  const handleActionSuccess = () => {
    setIsActionModalOpen(false);
    setSelectedVendor(null);
    fetchVendors();
  };

  const getStageColor = (stage) => {
    switch(stage) {
      case 'documents_pending': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'verified': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'seller_activated': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 lg:space-y-10 max-w-[1600px] mx-auto">
      <VendorDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedVendor(null); }}
        vendor={selectedVendor}
      />
      <VendorActionModal
        isOpen={isActionModalOpen}
        onClose={() => { setIsActionModalOpen(false); setSelectedVendor(null); }}
        vendor={selectedVendor}
        token={token}
        onSuccess={handleActionSuccess}
      />
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Compliance & Activation</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Vendor Onboarding</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-6">
        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-4">
            <div className="p-1.5 lg:p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform"><Clock size={16} /></div>
            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">Incomplete Docs</span>
          </div>
          <div className="text-lg lg:text-2xl font-black text-slate-900">
            {vendors.filter(v => v.onboarding_stage === 'documents_pending').length}
          </div>
        </div>
        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-4">
            <div className="p-1.5 lg:p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><FileText size={16} /></div>
            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">Under Review</span>
          </div>
          <div className="text-lg lg:text-2xl font-black text-slate-900">
            {vendors.filter(v => v.onboarding_stage === 'verification_pending').length}
          </div>
        </div>
        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-4">
            <div className="p-1.5 lg:p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform"><ShieldCheck size={16} /></div>
            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-slate-400">Verified</span>
          </div>
          <div className="text-lg lg:text-2xl font-black text-slate-900">
            {vendors.filter(v => v.onboarding_stage === 'verified').length}
          </div>
        </div>
        <div className="bg-red-600 p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-xl shadow-red-100 hover:scale-[1.02] transition-all group">
          <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-4">
            <div className="p-1.5 lg:p-2 bg-white/20 text-white rounded-lg group-hover:scale-110 transition-transform"><CheckCircle size={16} /></div>
            <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-red-100">Activated</span>
          </div>
          <div className="text-lg lg:text-2xl font-black text-white">
            {vendors.filter(v => v.onboarding_stage === 'seller_activated').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="w-[25%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise Profile</th>
                <th className="w-[20%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Gateway</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Onboarding Status</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Velocity</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Compliance</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Synchronizing Directory...</td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">No Vendors in Pipeline</td></tr>
              ) : vendors.map(vendor => (
                <tr key={vendor._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0">
                        {vendor.lead_id?.business_name?.[0] || 'B'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{vendor.lead_id?.business_name}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-tight truncate">{vendor.lead_id?.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-xs font-bold text-slate-700 truncate">{vendor.lead_id?.contact_person}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a href={`tel:${vendor.lead_id?.phone}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 uppercase">Call</a>
                      <a href={`mailto:${vendor.lead_id?.email}`} className="text-[9px] font-black text-slate-400 hover:text-red-600 uppercase">Mail</a>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter border", getStageColor(vendor.onboarding_stage))}>
                      {vendor.onboarding_stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="bg-red-600 h-full" style={{ width: `${vendor.onboarding_completion_percentage}%` }} />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 tracking-widest shrink-0">{vendor.onboarding_completion_percentage}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 tracking-widest uppercase truncate">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", vendor.verification_status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500')} />
                      {vendor.verification_status}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleEdit(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Edit Vendor">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDetail(vendor)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="View Details">
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-slate-50">
          {loading ? (
            <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing...</div>
          ) : vendors.length === 0 ? (
            <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">No Vendors</div>
          ) : vendors.map(vendor => (
            <div key={vendor._id} className="p-4 active:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-lg">
                    {vendor.lead_id?.business_name?.[0] || 'B'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 text-sm truncate">{vendor.lead_id?.business_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border", getStageColor(vendor.onboarding_stage))}>
                        {vendor.onboarding_stage.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleEdit(vendor)} className="p-2 bg-slate-50 text-slate-400 rounded-xl active:bg-red-50" title="Edit Vendor">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => handleDetail(vendor)} className="p-2 bg-slate-50 text-slate-400 rounded-xl active:bg-red-50" title="View Details">
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Compliance</p>
                  <p className="text-[10px] font-bold text-slate-700 truncate uppercase">{vendor.verification_status}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Velocity</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="bg-red-600 h-full" style={{ width: `${vendor.onboarding_completion_percentage}%` }} />
                    </div>
                    <span className="text-[9px] font-black text-slate-900">{vendor.onboarding_completion_percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 truncate">{vendor.lead_id?.contact_person}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`tel:${vendor.lead_id?.phone}`} className="p-2 bg-red-50 text-red-600 rounded-lg active:scale-95 transition-all">
                    <Phone size={16} />
                  </a>
                  <a href={`mailto:${vendor.lead_id?.email}`} className="p-2 bg-slate-100 text-slate-600 rounded-lg active:scale-95 transition-all">
                    <Mail size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
