import { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, Mail, Landmark, FileCheck, ShieldCheck, CreditCard, User, Globe, Hash, ChevronDown } from 'lucide-react';
import { API_URL } from '../config/api';
import { cn } from '../utils/cn';

const ONBOARDING_STAGES = [
  { value: 'documents_pending', label: 'Documents Pending' },
  { value: 'documents_submitted', label: 'Documents Submitted' },
  { value: 'verification_pending', label: 'Verification Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'account_created', label: 'Account Created' },
  { value: 'product_upload_pending', label: 'Product Upload Pending' },
  { value: 'product_review_pending', label: 'Product Review Pending' },
  { value: 'seller_activated', label: 'Seller Activated' }
];

const VendorActionModal = ({ isOpen, onClose, vendor, token, onSuccess }) => {
  const [formData, setFormData] = useState({
    onboarding_stage: '',
    onboarding_completion_percentage: 0,
    business_details: { legal_name: '', tax_id: '', office_address: '', registration_type: '' },
    pickup_address: { address: '', city: '', state: '', zip_code: '', contact_person: '', phone: '' },
    bank_details: { bank_name: '', account_number: '', account_holder: '', branch: '', ifsc_code: '' },
    document_status: 'pending',
    verification_status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen && vendor) {
      setShouldRender(true);
      setIsAnimatingOut(false);
      const lead = vendor.lead_id || {};
      setFormData({
        onboarding_stage: vendor.onboarding_stage || 'documents_pending',
        onboarding_completion_percentage: vendor.onboarding_completion_percentage || 0,
        business_details: {
          legal_name: vendor.business_details?.legal_name || lead.business_name || '',
          tax_id: vendor.business_details?.tax_id || vendor.pan_vat?.number || '',
          office_address: vendor.business_details?.office_address || '',
          registration_type: vendor.business_details?.registration_type || ''
        },
        pickup_address: {
          address: vendor.pickup_address?.address || '',
          city: vendor.pickup_address?.city || '',
          state: vendor.pickup_address?.state || '',
          zip_code: vendor.pickup_address?.zip_code || '',
          contact_person: vendor.pickup_address?.contact_person || '',
          phone: vendor.pickup_address?.phone || ''
        },
        bank_details: {
          bank_name: vendor.bank_details?.bank_name || '',
          account_number: vendor.bank_details?.account_number || '',
          account_holder: vendor.bank_details?.account_holder || '',
          branch: vendor.bank_details?.branch || '',
          ifsc_code: vendor.bank_details?.ifsc_code || ''
        },
        document_status: vendor.document_status || 'pending',
        verification_status: vendor.verification_status || 'pending'
      });
      setTimeout(() => { setIsAnimatingIn(false); }, 10);
    } else if (shouldRender) {
      setIsAnimatingOut(true);
      setIsAnimatingIn(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
        setIsAnimatingIn(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, vendor]);

  if (!shouldRender) return null;

  const handleChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: { ...prev[section], [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/vendors/${vendor._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.status === 'success') {
        onSuccess && onSuccess();
        handleClose();
      } else {
        alert(data.message || 'Update failed');
      }
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsAnimatingOut(true);
    setIsAnimatingIn(false);
    setTimeout(() => {
      setShouldRender(false);
      setIsAnimatingOut(false);
      setIsAnimatingIn(true);
      onClose();
    }, 300);
  };

  const backdropClass = isAnimatingOut
    ? 'bg-slate-900/0'
    : isAnimatingIn
      ? 'bg-slate-900/0'
      : 'bg-slate-900/60 backdrop-blur-sm';

  const modalClass = isAnimatingOut
    ? 'translate-y-full opacity-0'
    : isAnimatingIn
      ? 'translate-y-8 opacity-0'
      : 'translate-y-0 opacity-100';

  const lead = vendor?.lead_id || {};

  return (
    <div className={`fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center p-0 lg:p-4 transition-all duration-300 ${backdropClass}`} onClick={handleClose}>
      <div className={`w-full lg:max-w-4xl lg:rounded-[2.5rem] bg-white shadow-2xl overflow-hidden transition-all duration-300 ${modalClass} max-h-[95vh] flex flex-col`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 lg:px-8 lg:py-6 bg-red-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center text-red-600 shadow-xl">
              <Building2 size={24} className="lg:w-8 lg:h-8" />
            </div>
            <div className="text-white">
              <h2 className="text-lg lg:text-2xl font-black uppercase tracking-tight">{lead?.business_name || 'Vendor'}</h2>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Edit Profile & Pipeline</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 lg:p-3 hover:bg-white/10 rounded-full text-white transition-all hover:rotate-90">
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 lg:p-8 space-y-6 lg:space-y-8">
          {/* Pipeline Stage */}
          <div className="bg-slate-50 p-4 lg:p-6 rounded-2xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Onboarding Pipeline Stage</label>
            <div className="relative">
              <select
                value={formData.onboarding_stage}
                onChange={e => handleChange(null, 'onboarding_stage', e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              >
                {ONBOARDING_STAGES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion</span>
                <span className="text-lg font-black text-red-600">{formData.onboarding_completion_percentage}%</span>
              </div>
              <input
                type="range"
                min="0" max="100" step="5"
                value={formData.onboarding_completion_percentage}
                onChange={e => handleChange(null, 'onboarding_completion_percentage', Number(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>

          {/* Business Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck size={16} className="text-red-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corporate Identity</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Legal Name</label>
                <input value={formData.business_details.legal_name} onChange={e => handleChange('business_details', 'legal_name', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tax ID / PAN</label>
                <input value={formData.business_details.tax_id} onChange={e => handleChange('business_details', 'tax_id', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Registration Type</label>
                <input value={formData.business_details.registration_type} onChange={e => handleChange('business_details', 'registration_type', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Office Address</label>
                <input value={formData.business_details.office_address} onChange={e => handleChange('business_details', 'office_address', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Document & Verification Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Status</label>
              <select value={formData.document_status} onChange={e => handleChange(null, 'document_status', e.target.value)} className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white focus:ring-2 focus:ring-red-500 outline-none">
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Status</label>
              <select value={formData.verification_status} onChange={e => handleChange(null, 'verification_status', e.target.value)} className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold bg-white focus:ring-2 focus:ring-red-500 outline-none">
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Pickup Address */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <MapPin size={16} className="text-red-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logistics & Pickup</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Person</label>
                <input value={formData.pickup_address.contact_person} onChange={e => handleChange('pickup_address', 'contact_person', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
                <input value={formData.pickup_address.phone} onChange={e => handleChange('pickup_address', 'phone', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Address</label>
                <input value={formData.pickup_address.address} onChange={e => handleChange('pickup_address', 'address', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                <input value={formData.pickup_address.city} onChange={e => handleChange('pickup_address', 'city', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
                <input value={formData.pickup_address.state} onChange={e => handleChange('pickup_address', 'state', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Zip Code</label>
                <input value={formData.pickup_address.zip_code} onChange={e => handleChange('pickup_address', 'zip_code', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Landmark size={16} className="text-red-600" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Settlement</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</label>
                <input value={formData.bank_details.bank_name} onChange={e => handleChange('bank_details', 'bank_name', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Account Holder</label>
                <input value={formData.bank_details.account_holder} onChange={e => handleChange('bank_details', 'account_holder', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Account Number</label>
                <input value={formData.bank_details.account_number} onChange={e => handleChange('bank_details', 'account_number', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Branch</label>
                <input value={formData.bank_details.branch} onChange={e => handleChange('bank_details', 'branch', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</label>
                <input value={formData.bank_details.ifsc_code} onChange={e => handleChange('bank_details', 'ifsc_code', e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
          <button type="button" onClick={handleClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</>
            ) : (
              <>Update Vendor</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorActionModal;
