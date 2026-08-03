import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Loader2, AlertCircle, RefreshCw, Search, X, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, HelpCircle, ShoppingBag, EyeOff
} from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const STATUS_STYLES = {
  OK: 'bg-emerald-100 text-emerald-700',
  MISMATCH: 'bg-red-100 text-red-700',
  NO_PRICING: 'bg-amber-100 text-amber-700',
  NO_ZONE: 'bg-purple-100 text-purple-700',
  MISSING_BRANCH: 'bg-slate-100 text-slate-600',
  ERROR: 'bg-rose-100 text-rose-700'
};

const NepalcanOrderAudit = () => {
  const { token } = useSelector((state) => state.auth);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [dismissedOrders, setDismissedOrders] = useState([]);
  const [showDismissed, setShowDismissed] = useState(false);

  const fetchDismissed = async () => {
    try {
      const res = await axios.get(`${API_URL}/nepalcan-orders/audit/dismissed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDismissedOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch dismissed:', err);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await axios.get(`${API_URL}/nepalcan-orders/audit`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAudit(res.data.data);
    } catch (err) {
      console.error('Failed to fetch audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); fetchDismissed(); }, [token]);

  const dismissOrder = async (orderId) => {
    try {
      await axios.post(`${API_URL}/nepalcan-orders/audit/dismiss`, { orderId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDismissedOrders(prev => [...prev, orderId]);
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  };

  const undismissOrder = async (orderId) => {
    try {
      await axios.delete(`${API_URL}/nepalcan-orders/audit/dismiss/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDismissedOrders(prev => prev.filter(id => id !== orderId));
    } catch (err) {
      console.error('Failed to undismiss:', err);
    }
  };

  const runAudit = async () => {
    setRunning(true);
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/nepalcan-orders/audit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Poll for completion
      const poll = setInterval(async () => {
        const r = await axios.get(`${API_URL}/nepalcan-orders/audit`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = r.data.data;
        if (data && data.status !== 'running') {
          setAudit(data);
          setRunning(false);
          setLoading(false);
          clearInterval(poll);
        }
      }, 3000);
    } catch (err) {
      console.error('Audit trigger failed:', err);
      setRunning(false);
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!audit?.items) return [];
    let items = audit.items;
    if (!showDismissed) items = items.filter(i => !dismissedOrders.includes(i.orderId));
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.orderId || '').toLowerCase().includes(q) ||
        (i.zoneGroup || '').toLowerCase().includes(q) ||
        (i.originBranchName || '').toLowerCase().includes(q) ||
        (i.destinationBranchName || '').toLowerCase().includes(q) ||
        (i.error || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [audit, statusFilter, search, dismissedOrders, showDismissed]);

  const statusCounts = useMemo(() => {
    if (!audit?.items) return {};
    const counts = {};
    audit.items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  }, [audit]);

  if (loading && !audit) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-red-600" />
      </div>
    );
  }

  const StatusIcon = ({ status }) => {
    if (status === 'OK') return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === 'MISMATCH') return <AlertTriangle size={14} className="text-red-500" />;
    return <HelpCircle size={14} className="text-amber-500" />;
  };

  const chargeLabel = (key) => {
    const map = { customer: 'Customer Charge', drop: 'Drop Charge', pickup: 'Pickup Charge', retD: 'Return Delivered', retND: 'Return Not Delivered' };
    return map[key] || key;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {audit ? `Last audit: ${new Date(audit.runAt).toLocaleString()}` : 'No audit run yet'}
        </p>
        <button
          onClick={runAudit}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {running ? 'Running...' : 'Run Audit'}
        </button>
      </div>

      {running && !audit?.items?.length && (
        <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Audit in progress — checking all orders against provider pricing...
        </div>
      )}

      {!audit && !running && (
        <div className="text-center py-12 text-sm text-slate-400 font-semibold">
          <ShoppingBag size={40} className="mx-auto mb-3 text-slate-200" />
          No audit data. Click "Run Audit" to analyze delivery charge discrepancies.
        </div>
      )}

      {audit && (
        <>
          {/* Summary Cards */}
          {audit.summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Checked</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{audit.summary.total}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">OK</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{audit.summary.ok}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-red-100">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">MISMATCH</p>
                <p className="text-2xl font-extrabold text-red-600 mt-1">{audit.summary.mismatch}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">No Pricing</p>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">{audit.summary.noPricing}</p>
              </div>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {['all', 'MISMATCH', 'OK', 'NO_PRICING', 'NO_ZONE', 'MISSING_BRANCH', 'ERROR'].map(status => {
              const count = status === 'all' ? (audit.items || []).length : (statusCounts[status] || 0);
              if (count === 0 && status !== 'all') return null;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                    statusFilter === status
                      ? status === 'all' ? 'bg-red-600 text-white' : `${STATUS_STYLES[status]} border`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {status.replace('_', ' ')} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Dismissed toggle + Search */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-200" />
              Show dismissed ({dismissedOrders.length})
            </label>
          </div>
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search by order, branch, zone..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full py-2 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"><X size={12} /></button>}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-8 px-3 py-3"></th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order ID</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zone Group</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service</th>
                    <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin → Destination</th>
                    <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="w-10 px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-xs font-bold text-slate-400">No results</td></tr>
                  ) : filteredItems.map((item, i) => (
                    <Fragment key={item.orderId}>
                      <tr
                        className={cn(
                          "hover:bg-red-50/50 transition-colors cursor-pointer",
                          expanded === i && "bg-red-50/30",
                          dismissedOrders.includes(item.orderId) && "opacity-40"
                        )}
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        <td className="px-3 py-3">
                          {expanded === i ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-red-600">{item.orderId}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>
                            <StatusIcon status={item.status} />
                            {item.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{item.zoneGroup || '-'}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{item.serviceType || '-'}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {(item.originBranchName || item.originBranch || '?')} → {(item.destinationBranchName || item.destinationBranch || '?')}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-900 text-right">
                          {item.totalValue != null ? `NPR ${item.totalValue.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {dismissedOrders.includes(item.orderId) ? (
                            <button
                              onClick={e => { e.stopPropagation(); undismissOrder(item.orderId); }}
                              className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-400 hover:text-emerald-600"
                              title="Undo remove"
                            >
                              <EyeOff size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); dismissOrder(item.orderId); }}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-slate-300 hover:text-red-600"
                              title="Remove from audit view"
                            >
                              <EyeOff size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === i && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-slate-50/50">
                            {item.status === 'ERROR' || item.status === 'MISSING_BRANCH' || item.status === 'NO_ZONE' ? (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <AlertCircle size={14} className="text-rose-500" />
                                {item.error}
                              </div>
                            ) : item.status === 'NO_PRICING' ? (
                              <div className="text-sm text-slate-600">
                                <p className="font-semibold text-amber-600 mb-1">No matching pricing found</p>
                                <p>{item.error || `Zone group "${item.zoneGroup}" + service "${item.serviceType}" has no provider pricing record`}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivery Charges: Actual vs Expected</p>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                                  {['customer', 'drop', 'pickup', 'retD', 'retND'].map(key => {
                                    const a = item.actual?.[key];
                                    const e = item.expected?.[key];
                                    const diff = a !== e;
                                    return (
                                      <div key={key} className={cn("p-3 rounded-xl border", diff ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100')}>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{chargeLabel(key)}</p>
                                        <div className="flex items-center gap-2">
                                          <span className={cn("text-sm font-bold", diff ? 'text-red-600' : 'text-slate-700')}>NPR {a?.toLocaleString() || 0}</span>
                                          {diff && (
                                            <>
                                              <span className="text-xs text-slate-400">→</span>
                                              <span className="text-sm font-bold text-emerald-600">NPR {e?.toLocaleString() || 0}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  <span className="text-red-600 font-bold">Red</span> = actual differs from expected |
                                  Actual from logistics API | Expected from provider pricing
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NepalcanOrderAudit;
