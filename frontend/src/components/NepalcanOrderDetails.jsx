import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  ArrowLeft, Loader2, AlertCircle, User, Store, Package, CreditCard,
  Truck, Clock, MapPin, Phone, Hash, CircleDollarSign, CheckCircle2,
  PackageCheck, Warehouse, TruckIcon, Navigation
} from 'lucide-react';
import { API_URL } from '../config/api';
import { formatDuration } from '../utils/formatDuration';

const STATUS_COLORS = {
  Delivered: 'bg-emerald-100 text-emerald-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped: 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-red-100 text-red-700',
  Returned: 'bg-violet-100 text-violet-700',
  Pending: 'bg-slate-100 text-slate-600',
};

const PROCESS_ICONS = {
  'Pickup Scheduled': Truck,
  'Pickup Arrived': PackageCheck,
  'Warehousing Initiated': Warehouse,
  'Warehouse Stored': Warehouse,
  'Transport Initiated': TruckIcon,
  'Transit Confirmed': CheckCircle2,
  'Transit Assigned': TruckIcon,
  'Transit Loaded': TruckIcon,
  'Transit Unloaded': PackageCheck,
  'Last Mile Initiated': Navigation,
  'Delivery Assigned': Truck,
  'Delivered': CheckCircle2,
  'Delivery Failed': AlertCircle,
  'Returned': PackageCheck,
};

const PROCESS_COLORS = {
  'Pickup Scheduled': 'bg-blue-100 text-blue-600 border-blue-300',
  'Pickup Arrived': 'bg-blue-100 text-blue-600 border-blue-300',
  'Warehousing Initiated': 'bg-violet-100 text-violet-600 border-violet-300',
  'Warehouse Stored': 'bg-violet-100 text-violet-600 border-violet-300',
  'Transport Initiated': 'bg-amber-100 text-amber-600 border-amber-300',
  'Transit Confirmed': 'bg-amber-100 text-amber-600 border-amber-300',
  'Transit Assigned': 'bg-amber-100 text-amber-600 border-amber-300',
  'Transit Loaded': 'bg-amber-100 text-amber-600 border-amber-300',
  'Transit Unloaded': 'bg-amber-100 text-amber-600 border-amber-300',
  'Last Mile Initiated': 'bg-emerald-100 text-emerald-600 border-emerald-300',
  'Delivery Assigned': 'bg-emerald-100 text-emerald-600 border-emerald-300',
  'Delivered': 'bg-emerald-100 text-emerald-600 border-emerald-300',
  'Delivery Failed': 'bg-red-100 text-red-600 border-red-300',
  'Returned': 'bg-violet-100 text-violet-600 border-violet-300',
};

const Section = ({ icon: Icon, title, children, badge }) => (
  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
      <Icon size={16} className="text-red-600" />
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {badge && <span className="ml-auto">{badge}</span>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const InfoRow = ({ label, value, highlight = false }) => (
  <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
    <span className={`text-sm font-bold text-right max-w-[60%] ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value || '-'}</span>
  </div>
);

const NepalcanOrderDetails = ({ orderId, onBack }) => {
  const { token } = useSelector((state) => state.auth);

  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [branchMap, setBranchMap] = useState({});
  const [pricingInfo, setPricingInfo] = useState(null);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await axios.get(`${API_URL}/delivery-zones`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const map = {};
        (res.data.data.groups || []).forEach(group => {
          group.branches.forEach(b => { map[b.nepalcanId] = b.name; });
        });
        setBranchMap(map);
      } catch (err) { /* silent */ }
    };
    fetchZones();
  }, [token]);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const res = await axios.get(`${API_URL}/nepalcan-orders/tracking/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTracking(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchTracking();
  }, [orderId, token]);

  useEffect(() => {
    if (!tracking?.destinationBranch || !tracking?.shippingType) return;
    const fetchPricing = async () => {
      try {
        const total = tracking.totalAmount !== undefined
          ? tracking.totalAmount
          : (tracking.items || []).reduce((s, i) => s + (i.price * i.quantity), 0);
        const res = await axios.get(`${API_URL}/provider-pricing/resolve`, {
          params: { branchId: tracking.destinationBranch, serviceType: tracking.shippingType, totalValue: total },
          headers: { Authorization: `Bearer ${token}` }
        });
        setPricingInfo(res.data.data);
      } catch (err) { /* silent */ }
    };
    fetchPricing();
  }, [tracking, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="text-red-600 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading order details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-600 font-semibold">{error}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            Back to Sales
          </button>
        )}
      </div>
    );
  }

  if (!tracking) return null;

  const statusClass = STATUS_COLORS[tracking.orderStatus] || 'bg-slate-100 text-slate-600';

  // Get latest delivery status from marketplaceProcesses
  const processes = tracking.marketplaceProcesses || [];
  const latestProcess = processes.length > 0 ? processes[0] : null;

  // Calculate product total — prefer updated DB totalAmount; items are a fallback
  const itemSum = (tracking.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingCost = tracking.shippingAmount || 0;
  const productTotal = tracking.totalAmount !== undefined ? tracking.totalAmount - shippingCost : itemSum;
  const grandTotal = tracking.totalAmount !== undefined ? tracking.totalAmount : productTotal + shippingCost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="relative z-10">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg transition-all text-xs font-bold mb-4"
            >
              <ArrowLeft size={14} />
              Back to Sales
            </button>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-extrabold text-white">{tracking.orderId}</h1>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${statusClass}`}>
                  {tracking.orderStatus}
                </span>
                {latestProcess && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/20 text-white">
                    {latestProcess.process}
                  </span>
                )}
              </div>
              {tracking.orderRefId && (
                <p className="text-red-200 text-xs font-semibold">Ref: {tracking.orderRefId}</p>
              )}
              {latestProcess && (
                <p className="text-red-100 text-xs mt-1">{latestProcess.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/15 text-white">
                {tracking.paymentMethod} / {tracking.paymentStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Package size={14} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Product Total</span>
          </div>
          <p className="text-xl font-extrabold text-slate-900">NPR {productTotal.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{(tracking.items || []).length} item(s)</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-amber-50 p-2 rounded-lg">
              <Truck size={14} className="text-amber-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Shipping Cost</span>
          </div>
          <p className="text-xl font-extrabold text-slate-900">NPR {shippingCost.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{tracking.shippingType?.toUpperCase() || 'D2D'}</p>
        </div>
        <div className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-red-50 p-2 rounded-lg">
              <CircleDollarSign size={14} className="text-red-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grand Total</span>
          </div>
          <p className="text-xl font-extrabold text-red-600">NPR {grandTotal.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Product + Shipping</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer */}
        <Section icon={User} title="Customer">
          {tracking.customerProfile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 font-extrabold text-sm">
                  {tracking.customerProfile.name?.[0] || 'C'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{tracking.customerProfile.name}</p>
                  <p className="text-xs text-slate-400">Customer</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {tracking.customerProfile.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span className="font-semibold">{tracking.customerProfile.phone}</span>
                  </div>
                )}
                {tracking.customerProfile.address && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="font-semibold">{tracking.customerProfile.address}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No customer data</p>
          )}
        </Section>

        {/* Vendor */}
        <Section icon={Store} title="Vendor">
          {tracking.vendor ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-extrabold text-sm">
                  {tracking.vendor.name?.[0] || 'V'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{tracking.vendor.name}</p>
                  <p className="text-xs text-slate-400">Vendor</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {tracking.vendor.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span className="font-semibold">{tracking.vendor.phone}</span>
                  </div>
                )}
                {tracking.vendor.address && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="font-semibold">{tracking.vendor.address}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No vendor data</p>
          )}
        </Section>
      </div>

      {/* Items */}
      <Section icon={Package} title={`Items (${tracking.items?.length || 0})`}>
        {!tracking.items || tracking.items.length === 0 ? (
          <p className="text-sm text-slate-400">No items</p>
        ) : (
          <div className="space-y-4">
            {tracking.items.map((item, i) => {
              const product = item.product;
              const imageUrl = product?.productImages?.[0]?.url;
              const lineTotal = item.price * item.quantity;
              return (
                <div key={item._id || i} className="flex gap-4 p-3 bg-slate-50 rounded-xl hover:bg-red-50/30 transition-colors">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product?.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={24} className="text-slate-200" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2">{product?.productName || 'Unknown Product'}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-slate-500">Qty: <span className="font-bold text-slate-700">{item.quantity}</span></span>
                      <span className="text-xs text-slate-500">Unit Price: <span className="font-bold text-slate-700">NPR {item.price?.toLocaleString()}</span></span>
                      <span className="text-xs text-red-500 font-bold">NPR {lineTotal?.toLocaleString()}</span>
                    </div>
                    {item.status && item.status !== 'None' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">{item.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Delivery Tracking (marketplaceProcesses) */}
      {processes.length > 0 && (
        <Section icon={Truck} title="Delivery Tracking" badge={
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{processes[0].process}</span>
        }>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-100" />
            {processes.map((proc, i) => {
              const Icon = PROCESS_ICONS[proc.process] || Truck;
              const colorClass = PROCESS_COLORS[proc.process] || 'bg-slate-100 text-slate-600 border-slate-300';
              const isFirst = i === 0;
              const prevProc = processes[i + 1];
              const durationHours = (prevProc && proc.createdAt && prevProc.createdAt)
                ? Math.round((new Date(proc.createdAt) - new Date(prevProc.createdAt)) / (1000 * 60 * 60))
                : null;
              return (
                <div key={proc._id || i}>
                  <div className="relative">
                    <div className={`absolute -left-4 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 ${isFirst ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                      <Icon size={10} className={isFirst ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div className={`rounded-xl p-3 transition-colors ${isFirst ? 'bg-emerald-50/50 border border-emerald-100' : 'bg-slate-50 hover:bg-red-50/30'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colorClass}`}>
                          {proc.process}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {proc.createdAt ? new Date(proc.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{proc.description}</p>
                    </div>
                  </div>
                  {durationHours !== null && (
                    <div className="flex items-center gap-2 pl-4 py-1.5">
                      <div className="w-px h-3 bg-slate-200" />
                      <span className="text-[9px] text-slate-400 font-bold">{formatDuration(durationHours)} since previous</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment & Shipping */}
        <Section icon={CreditCard} title="Payment & Shipping">
          <div className="space-y-1">
            <InfoRow label="Payment Method" value={tracking.paymentMethod} />
            <InfoRow label="Payment Status" value={tracking.paymentStatus} />
            <InfoRow label="Shipping Type" value={tracking.shippingType?.toUpperCase()} />
            <InfoRow label="Product Total" value={`NPR ${productTotal.toLocaleString()}`} />
            <InfoRow label="Shipping Cost" value={`NPR ${shippingCost.toLocaleString()}`} />
            <InfoRow label="Grand Total" value={`NPR ${grandTotal.toLocaleString()}`} highlight />
            {tracking.deliveryChargeBreakdown && (
              <>
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1">Delivery Breakdown</p>
                </div>
                <InfoRow label="Customer Delivery Charge" value={`NPR ${tracking.deliveryChargeBreakdown.customerDeliveryCharge?.toLocaleString()}`} />
                <InfoRow label="Vendor Drop Charge" value={`NPR ${tracking.deliveryChargeBreakdown.vendorDropCharge?.toLocaleString()}`} />
                <InfoRow label="Vendor Pickup Charge" value={`NPR ${tracking.deliveryChargeBreakdown.vendorPickupCharge?.toLocaleString()}`} />
                <InfoRow label="Return Charge (Delivered)" value={`NPR ${tracking.deliveryChargeBreakdown.returnChargeDelivered?.toLocaleString()}`} />
                <InfoRow label="Return Charge (Not Delivered)" value={`NPR ${tracking.deliveryChargeBreakdown.returnChargeNotDelivered?.toLocaleString()}`} />
              </>
            )}
          </div>
        </Section>

        {/* Pricing Information */}
        <Section icon={CircleDollarSign} title="Pricing Information">
          {pricingInfo ? (
            <div className="space-y-1">
              <InfoRow label="Zone Group" value={pricingInfo.zoneGroupName} />
              <InfoRow label="Service Type" value={pricingInfo.serviceType} />
              <InfoRow label="Order Total" value={`NPR ${pricingInfo.totalValue.toLocaleString()}`} />
              {pricingInfo.slab ? (
                <>
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-1">Applicable Slab</p>
                  </div>
                  <InfoRow label="Customer Delivery Charge" value={`NPR ${pricingInfo.slab.customerDeliveryCharge?.toLocaleString()}`} />
                  <InfoRow label="Vendor Drop Charge" value={`NPR ${pricingInfo.slab.vendorDropCharge?.toLocaleString()}`} />
                  <InfoRow label="Vendor Pickup Charge" value={`NPR ${pricingInfo.slab.vendorPickupCharge?.toLocaleString()}`} />
                  <InfoRow label="Return Charge (Delivered)" value={`NPR ${pricingInfo.returnChargeDelivered?.toLocaleString()}`} />
                  <InfoRow label="Return Charge (Not Delivered)" value={`NPR ${pricingInfo.returnChargeNotDelivered?.toLocaleString()}`} />
                </>
              ) : (
                <InfoRow label="Slab" value="No matching slab — using fallback" />
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-semibold">Pricing data not available — sync provider pricing in Settings</p>
          )}
        </Section>

        {/* Order Info */}
        <Section icon={Hash} title="Order Information">
          <div className="space-y-1">
            <InfoRow label="Order ID" value={tracking.orderId} />
            <InfoRow label="Order Ref ID" value={tracking.orderRefId} />
            <InfoRow label="Source" value={tracking.source} />
            <InfoRow label="Origin Branch" value={branchMap[tracking.originBranch] || tracking.originBranch || '-'} />
            <InfoRow label="Destination Branch" value={branchMap[tracking.destinationBranch] || tracking.destinationBranch || '-'} />
            <InfoRow label="Delivery Status" value={tracking.deliveryStatus} />
            <InfoRow label="Cancelled By" value={tracking.cancelledBy} />
            <InfoRow label="Delivery Note" value={tracking.deliveryNote} />
            <InfoRow label="Multi-Vendor" value={tracking.isMultipleVendors ? 'Yes' : 'No'} />
            <InfoRow label="Unattended Count" value={tracking.unAttendedCount} />
            <InfoRow label="Total Duration" value={formatDuration(
              tracking.createdAt && tracking.updatedAt
                ? Math.round((new Date(tracking.updatedAt) - new Date(tracking.createdAt)) / (1000 * 60 * 60))
                : null
            )} highlight />
            <InfoRow label="Created" value={tracking.createdAt ? new Date(tracking.createdAt).toLocaleString() : '-'} />
            <InfoRow label="Updated" value={tracking.updatedAt ? new Date(tracking.updatedAt).toLocaleString() : '-'} />
          </div>
        </Section>
      </div>

      {/* Order Notes Timeline */}
      {tracking.notes && tracking.notes.length > 0 && (
        <Section icon={Clock} title="Order Notes">
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-100" />
            {tracking.notes.map((note, i) => (
              <div key={note._id || i} className="relative mb-4 last:mb-0">
                <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-red-100 border-2 border-red-500" />
                <div className="bg-slate-50 rounded-xl p-3 hover:bg-red-50/30 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{note.type} · {note.addedBy}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700" dangerouslySetInnerHTML={{ __html: note.comment }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export default NepalcanOrderDetails;
