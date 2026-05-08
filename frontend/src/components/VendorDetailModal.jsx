import { X, Building2, MapPin, Phone, Mail, Landmark, FileCheck, ShieldCheck, CreditCard, User, Globe, Hash } from 'lucide-react';
import { cn } from '../utils/cn';

const VendorDetailModal = ({ isOpen, onClose, vendor }) => {
  if (!isOpen || !vendor) return null;

  const lead = vendor.lead_id;

  const DetailSection = ({ title, icon: Icon, children }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Icon size={16} className="text-red-600" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );

  const DataItem = ({ label, value, icon: Icon, href }) => (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</label>
      <div className="flex items-center gap-2 group">
        {Icon && <Icon size={14} className="text-slate-300 group-hover:text-red-500 transition-colors" />}
        {href ? (
          <a href={href} className="text-sm font-black text-slate-900 hover:text-red-600 transition-colors">
            {value || 'N/A'}
          </a>
        ) : (
          <span className="text-sm font-black text-slate-900">{value || 'N/A'}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-8 py-8 bg-red-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-xl">
              <Building2 size={32} />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-black uppercase tracking-tight">{lead?.business_name || 'Vendor Profile'}</h2>
              <div className="flex items-center gap-2 mt-1 opacity-80">
                <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-widest">
                  ID: {vendor._id.slice(-8).toUpperCase()}
                </span>
                <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-widest">
                  {vendor.onboarding_stage.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full text-white transition-all hover:rotate-90">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-10">
          {/* Progress Overview */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
            <div className="space-y-2 flex-1 max-w-md">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Onboarding Velocity</span>
                <span className="text-lg font-black text-red-600">{vendor.onboarding_completion_percentage}%</span>
              </div>
              <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-red-600 transition-all duration-1000" 
                  style={{ width: `${vendor.onboarding_completion_percentage}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 pl-10">
              <div className="text-center">
                <div className="text-lg font-black text-slate-900">{vendor.verification_status.toUpperCase()}</div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verification</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-center">
                <div className="text-lg font-black text-slate-900">{vendor.document_status.toUpperCase()}</div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Documents</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Business & Contact */}
            <div className="space-y-10">
              <DetailSection title="Corporate Identity" icon={ShieldCheck}>
                <DataItem label="Legal Name" value={vendor.business_details?.legal_name} />
                <DataItem label="Registration Type" value={vendor.business_details?.registration_type} />
                <DataItem label="Tax ID / PAN" value={vendor.business_details?.tax_id || vendor.pan_vat?.number} icon={Hash} />
                <DataItem label="Office Address" value={vendor.business_details?.office_address} icon={MapPin} />
              </DetailSection>

              <DetailSection title="Primary Contact" icon={User}>
                <DataItem label="Contact Person" value={lead?.contact_person} />
                <DataItem label="Category" value={lead?.category} />
                <DataItem label="Email Address" value={lead?.email} icon={Mail} href={`mailto:${lead?.email}`} />
                <DataItem label="Phone Number" value={lead?.phone} icon={Phone} href={`tel:${lead?.phone}`} />
              </DetailSection>
            </div>

            {/* Right Column: Logistics & Banking */}
            <div className="space-y-10">
              <DetailSection title="Logistics & Pickup" icon={MapPin}>
                <DataItem label="Contact Person" value={vendor.pickup_address?.contact_person} />
                <DataItem label="Phone" value={vendor.pickup_address?.phone} href={`tel:${vendor.pickup_address?.phone}`} />
                <DataItem label="Pickup Address" value={`${vendor.pickup_address?.address}, ${vendor.pickup_address?.city}`} />
                <DataItem label="State / Zip" value={`${vendor.pickup_address?.state} - ${vendor.pickup_address?.zip_code}`} />
              </DetailSection>

              <DetailSection title="Financial Settlement" icon={Landmark}>
                <DataItem label="Bank Name" value={vendor.bank_details?.bank_name} icon={Landmark} />
                <DataItem label="Account Holder" value={vendor.bank_details?.account_holder} />
                <DataItem label="Account Number" value={vendor.bank_details?.account_number} icon={CreditCard} />
                <DataItem label="Branch / IFSC" value={`${vendor.bank_details?.branch} / ${vendor.bank_details?.ifsc_code}`} />
              </DetailSection>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
          >
            Dismiss Profile
          </button>
          <button className="px-8 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100">
            Audit Documentation
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailModal;