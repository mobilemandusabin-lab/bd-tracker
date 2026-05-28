import { MessageCircle, Briefcase } from 'lucide-react';

export default function WhatsAppModal({ onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-[340px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Open WhatsApp</h3>
        <p className="text-sm text-slate-500 mb-5">Choose which WhatsApp to use</p>
        <div className="flex gap-3">
          <button
            onClick={() => onSelect('personal')}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
          >
            <MessageCircle size={28} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">WhatsApp</span>
          </button>
          <button
            onClick={() => onSelect('business')}
            className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all"
          >
            <Briefcase size={28} className="text-blue-600" />
            <span className="text-sm font-bold text-blue-700">Business</span>
          </button>
        </div>
      </div>
    </div>
  );
}
