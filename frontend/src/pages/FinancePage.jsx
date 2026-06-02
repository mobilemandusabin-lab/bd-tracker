import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';
import { DollarSign, TrendingUp, Package, Percent, Search, Filter, ChevronLeft, ChevronRight, Trash2, RefreshCw, Download } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const FinancePage = () => {
  const { token } = useSelector((state) => state.auth);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ delivery_type: '', payment_status: '', date_from: '', date_to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50, search, ...filters });
      for (const [k, v] of params.entries()) { if (!v) params.delete(k); }
      const res = await axios.get(`${API_URL}/finance?${params}`, { headers });
      setRecords(res.data.data.records);
      setTotalPages(res.data.data.pages);
      setTotal(res.data.data.total);
    } catch (err) { toast.error('Failed to load finance data'); }
    finally { setLoading(false); }
  }, [page, search, filters, token]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams(filters);
      for (const [k, v] of params.entries()) { if (!v) params.delete(k); }
      const res = await axios.get(`${API_URL}/finance/summary?${params}`, { headers });
      setSummary(res.data.data.summary);
    } catch (err) { console.error(err); }
  }, [filters, token]);

  useEffect(() => { fetchRecords(); fetchSummary(); }, [fetchRecords, fetchSummary]);

  const handleSync = async () => {
    setSyncing(true);
    const loadingToast = toast.loading('Syncing delivered orders...');
    try {
      const res = await axios.post(`${API_URL}/finance/sync`, {}, { headers });
      const { synced, skipped, errors } = res.data.data;
      toast.success(`Synced ${synced} orders${skipped ? `, ${skipped} skipped` : ''}`, { id: loadingToast });
      if (errors.length > 0) console.warn('Sync errors:', errors);
      fetchRecords(); fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed', { id: loadingToast });
    } finally { setSyncing(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      await axios.delete(`${API_URL}/finance/${id}`, { headers });
      toast.success('Deleted');
      fetchRecords(); fetchSummary();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const fmt = (n) => n != null ? `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  const summaryCards = summary ? [
    { label: 'Total Revenue', value: fmt(summary.total_revenue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Profit', value: fmt(summary.total_profit), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Orders', value: summary.total_orders, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg Profit Margin', value: summary.total_revenue > 0 ? `${((summary.total_profit / summary.total_revenue) * 100).toFixed(1)}%` : '—', icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50' },
  ] : [];

  return (
    <div className="space-y-4 lg:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Nepalcan Commerce</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Finance</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 border border-red-600 rounded-xl text-xs font-bold text-white hover:bg-red-700 transition-all disabled:opacity-50">
            <Download size={14} /> {syncing ? 'Syncing...' : 'Sync from Nepalcan'}
          </button>
          <button onClick={() => { fetchRecords(); fetchSummary(); }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg", card.bg)}>
                  <card.icon size={14} className={card.color} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
              </div>
              <p className={cn("text-lg lg:text-xl font-extrabold", card.color)}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Search by Order ID, Product, Customer..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all", showFilters ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
            <Filter size={14} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <select value={filters.delivery_type} onChange={e => { setFilters(f => ({ ...f, delivery_type: e.target.value })); setPage(1); }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none">
              <option value="">All Types</option>
              <option value="D2D">D2D</option>
              <option value="D2B">D2B</option>
              <option value="B2B">B2B</option>
            </select>
            <select value={filters.payment_status} onChange={e => { setFilters(f => ({ ...f, payment_status: e.target.value })); setPage(1); }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none">
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
            </select>
            <input type="date" value={filters.date_from} onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none" />
            <input type="date" value={filters.date_to} onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none" />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Group headers */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <th colSpan={3} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Order Details</th>
                <th colSpan={3} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Payment Receipt</th>
                <th colSpan={3} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Cash Inflow From Customer</th>
                <th colSpan={3} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Receipt Verified By Fin</th>
                <th colSpan={1} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Cost</th>
                <th colSpan={8} className="px-3 py-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Payment to Vendor</th>
                <th colSpan={8} className="px-3 py-2 text-center text-[9px] font-bold text-red-500 uppercase tracking-wider border-r border-slate-200">Nepal Can Commerce</th>
                <th className="px-3 py-2"></th>
              </tr>
              {/* Column headers */}
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Delivery Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Product Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Received At</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Received Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Product Price</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Del. Charge Contrib.</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Total</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Received At</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Received Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Del. Charge Contrib.</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Cost to Vendor</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">.Com Commission</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Vendor Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">PAN</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">TDS</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Bank Fee</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Net Payment</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Payment Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total Rev. Inc. VAT</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Delivery Type</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Service Cost</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Pick Up Charge</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total Charge</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Revenue Recognized</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Del. Cost Recognized</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-r border-slate-200">Profit</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={30} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={30} className="px-4 py-12 text-center text-xs text-slate-400">No records found</td></tr>
              ) : records.map((r) => {
                const totalFromCustomer = (r.product_price || 0) + (r.delivery_charge_contribution || 0);
                return (
                  <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-900 whitespace-nowrap">{r.order_id}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.delivery_date ? new Date(r.delivery_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[200px] truncate border-r border-slate-200">{r.product_name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700 border-r border-slate-200">{fmt(r.product_price)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.customer_name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.delivery_charge_contribution)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700 border-r border-slate-200">{fmt(totalFromCustomer)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400 border-r border-slate-200">—</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700 border-r border-slate-200">{fmt(r.cost_to_vendor)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.commission)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.vendor_name}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.tds)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{fmt(r.net_payment)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", r.payment_status === 'Paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                        {r.payment_status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap border-r border-slate-200">{r.payment_date ? new Date(r.payment_date).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{fmt(r.total_revenue)}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">{r.delivery_type}</span></td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.service_cost)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.pickup_charge)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.total_charge)}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{fmt(r.revenue_recognized)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{fmt(r.delivery_cost_recognized)}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-red-600 border-r border-slate-200">{fmt(r.profit)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleDelete(r._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-medium">{total} records</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-all">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-slate-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-all">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancePage;
