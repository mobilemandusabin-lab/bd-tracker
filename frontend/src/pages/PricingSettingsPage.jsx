import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { RefreshCw, DollarSign, Loader2 } from 'lucide-react';
import { API_URL } from '../config/api';

const PricingSettingsPage = () => {
  const { token } = useSelector((state) => state.auth);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchPricing = async () => {
    try {
      const res = await axios.get(`${API_URL}/provider-pricing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPricing(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPricing(); }, [token]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API_URL}/provider-pricing/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPricing(res.data.data.pricing || []);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Provider delivery pricing from Nepalcan API</p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-red-600" />
        </div>
      ) : pricing.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400 font-semibold">No pricing data found. Sync to fetch from Nepalcan.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Zone Group</th>
                <th className="text-left py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Service</th>
                <th className="text-left py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Price From</th>
                <th className="text-left py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Price To</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Drop</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Pickup</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Return D</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Return ND</th>
                <th className="text-right py-3 px-3 font-bold text-slate-400 uppercase tracking-wider">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map(p => (
                p.pricingSlabs.map((slab, i) => (
                  <tr key={`${p.nepalcanId}-${i}`} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.deliveryZoneGroupName || p.deliveryZoneGroup}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700">{p.serviceType}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{slab.productPriceFrom === 0 ? '0' : `NPR ${slab.productPriceFrom.toLocaleString()}`}</td>
                    <td className="py-2.5 px-3 text-slate-600">{slab.productPriceTo === 0 ? '∞' : `NPR ${slab.productPriceTo.toLocaleString()}`}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">NPR {slab.customerDeliveryCharge.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">NPR {slab.vendorDropCharge.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">NPR {slab.vendorPickupCharge.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">NPR {p.returnChargeDelivered.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">NPR {p.returnChargeNotDelivered.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">NPR {p.fallbackPrice.toLocaleString()}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PricingSettingsPage;
