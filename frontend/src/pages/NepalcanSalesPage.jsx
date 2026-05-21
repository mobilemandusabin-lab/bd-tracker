import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, AlertCircle, RefreshCw, ShoppingBag,
  TrendingUp, Package, Truck, CheckCircle, Users,
  BarChart3, Calendar, X, Clock, DollarSign, History, ExternalLink, Search
} from 'lucide-react';
import { formatDuration } from '../utils/formatDuration';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const STATUS_COLORS = {
  'Pending': '#fbbf24',
  'Processing': '#3b82f6',
  'Shipped': '#f59e0b',
  'Delivered': '#10b981',
  'Cancelled': '#ef4444',
  'Returned': '#8b5cf6'
};

const NepalcanSalesPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [nepalcanStats, setNepalcanStats] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncLog, setSyncLog] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [showSyncHistory, setShowSyncHistory] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchSyncHistory = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/sync-logs?limit=10`, { headers });
      setSyncHistory(res.data);
    } catch (err) { console.error('Failed to fetch sync history:', err.message); }
  };

  const fetchStats = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/stats`, { headers });
      setNepalcanStats(res.data);
    } catch (err) { console.error('Failed to fetch stats:', err.message); }
  };

  const fetchSyncLog = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/sync-log/last`, { headers });
      setSyncLog(res.data);
    } catch (err) { console.error('Failed to fetch sync log:', err.message); }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/orders?page=1&limit=500`, { headers });
      setOrders(res.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch sales data');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); fetchStats(); fetchSyncLog(); }, []);

  const fetchOrderHistory = async (orderId) => {
    setHistoryLoading(true);
    setSelectedOrder(orderId);
    setOrderHistory(null);
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/order/${orderId}`, { headers });
      setOrderHistory(res.data);
    } catch (err) { setError('Failed to fetch order history'); }
    finally { setHistoryLoading(false); }
  };

  const dashboardMetrics = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    const delivered = orders.filter(o => o.orderStatus === 'Delivered');
    const totalRevenue = delivered.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const customerOrders = {};
    orders.forEach(o => { if (['Delivered', 'Pending'].includes(o.orderStatus)) { customerOrders[o.customer || 'Unknown'] = (customerOrders[o.customer || 'Unknown'] || 0) + 1; } });
    const weeklySales = {};
    orders.forEach(o => { if (o.createdAt) { const d = new Date(o.createdAt); const w = new Date(d); w.setDate(d.getDate() - d.getDay()); const k = w.toISOString().split('T')[0]; weeklySales[k] = (weeklySales[k] || 0) + (o.totalAmount || 0); } });
    const ordersByStatus = {};
    orders.forEach(o => { ordersByStatus[o.orderStatus || 'Unknown'] = (ordersByStatus[o.orderStatus || 'Unknown'] || 0) + 1; });
    return {
      totalOrders: orders.length,
      totalRevenue,
      aov: delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0,
      processingOrders: orders.filter(o => ['Processing', 'Pending'].includes(o.orderStatus)).length,
      deliveredOrders: delivered.length,
      uniqueCustomers: [...new Set(orders.filter(o => ['Delivered', 'Pending'].includes(o.orderStatus)).map(o => o.customer).filter(Boolean))].length,
      topCustomers: Object.entries(customerOrders).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      salesPerWeek: Object.entries(weeklySales).sort((a, b) => a[0].localeCompare(b[0])).map(([week, revenue]) => ({ week, revenue })),
      statusData: Object.entries(ordersByStatus).map(([name, value]) => ({ name, value })),
    };
  }, [orders]);

  const customerOrders = useMemo(() => {
    if (!selectedCustomer || !orders) return [];
    return orders.filter(o => (o.customer || 'Unknown') === selectedCustomer);
  }, [orders, selectedCustomer]);

  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter(o =>
      (o.orderId || '').toLowerCase().includes(q) ||
      (o.customer || '').toLowerCase().includes(q) ||
      (o.vendor || '').toLowerCase().includes(q) ||
      (o.orderStatus || '').toLowerCase().includes(q) ||
      (o.paymentStatus || '').toLowerCase().includes(q)
    );
  }, [orders, orderSearch]);

  const ordersByStatus = useMemo(() => {
    const counts = {};
    filteredOrders.forEach(o => {
      const s = o.orderStatus || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [filteredOrders]);

  const statusFilteredOrders = useMemo(() => {
    if (statusFilter === 'All') return filteredOrders;
    return filteredOrders.filter(o => o.orderStatus === statusFilter);
  }, [filteredOrders, statusFilter]);

  const StatCard = ({ icon: Icon, label, value, color, tooltip }) => (
    <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative cursor-help">
      {tooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-medium max-w-[220px] whitespace-normal shadow-xl text-left">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45" />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-xl lg:text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Sales Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Nepalcan Integration</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Active Sellers Sales</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchOrders(); fetchStats(); fetchSyncLog(); }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { fetchSyncHistory(); setShowSyncHistory(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <Calendar size={14} /> Sync History
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {syncLog && (
        <div className={`p-4 rounded-xl text-sm font-bold border flex items-center justify-between ${syncLog.success ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncLog.success ? 'bg-blue-500' : 'bg-red-500'}`} />
            Last Sync: {new Date(syncLog.createdAt || syncLog.timestamp).toLocaleString()}
          </div>
          <span className="text-xs">{syncLog.success ? 'Success' : 'Failed'} - {syncLog.ordersSynced} orders</span>
        </div>
      )}

      {dashboardMetrics && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard icon={Package} label="Total Orders" value={dashboardMetrics.totalOrders} color="bg-blue-600" tooltip="Total number of orders synced from Nepalcan marketplace across all statuses." />
            <StatCard icon={DollarSign} label="Revenue" value={`NPR ${dashboardMetrics.totalRevenue.toLocaleString()}`} color="bg-emerald-600" tooltip="Sum of totalAmount for all orders with Delivered status only." />
            <StatCard icon={BarChart3} label="AOV" value={`NPR ${dashboardMetrics.aov.toLocaleString()}`} color="bg-purple-600" tooltip="Average Order Value = Total Revenue ÷ Number of Delivered orders." />
            <StatCard icon={Truck} label="Processing" value={dashboardMetrics.processingOrders} color="bg-amber-600" tooltip="Orders currently in Pending or Processing status (not yet shipped or delivered)." />
            <StatCard icon={CheckCircle} label="Delivered" value={dashboardMetrics.deliveredOrders} color="bg-emerald-600" tooltip="Orders that have been successfully delivered to the customer." />
            <StatCard icon={Users} label="Customers" value={dashboardMetrics.uniqueCustomers} color="bg-red-600" tooltip="Count of unique customer names from Delivered and Pending orders." />
          </div>

          {/* Processing Times */}
          {nepalcanStats && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-red-600" /> Processing Times
                <span className="ml-auto text-[10px] text-slate-400 font-bold">Based on {nepalcanStats.ordersAnalyzed || 0} orders</span>
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: 'Pending → Processing', value: nepalcanStats.averages?.pendingToProcessing, tooltip: 'Average time from order creation (Pending) to when vendor starts preparing (Processing). Calculated across all orders with both status entries in history.' },
                  { label: 'Processing → Shipped', value: nepalcanStats.averages?.processingToDelivered, tooltip: 'Average time from Processing to Shipped status. Measures vendor preparation and handoff to logistics. Calculated from statusHistory timestamps.' },
                  { label: 'Total Fulfillment', value: nepalcanStats.averages?.totalFulfillment, tooltip: 'Average total time from Pending to Delivered for completed orders. Only counts orders that reached Delivered status with both Pending and Delivered in history.' }
                ].map((item) => (
                  <div key={item.label} className="p-4 bg-red-50 rounded-xl text-center group relative cursor-help">
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-medium max-w-[250px] whitespace-normal shadow-xl text-left">
                        {item.tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45" />
                      </div>
                    </div>
                    <p className="text-[10px] font-bold text-red-400 uppercase mb-1">{item.label}</p>
                    <p className="text-2xl font-extrabold text-red-600">{formatDuration(item.value)}</p>
                  </div>
                ))}
              </div>
              {Object.entries(nepalcanStats.averages || {}).filter(([key]) => key.includes('_to_')).length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {Object.entries(nepalcanStats.averages)
                    .filter(([key]) => key.includes('_to_'))
                    .map(([key, value]) => {
                      const parts = key.replace(/_/g, ' ').split(' to ');
                      return (
                        <div key={key} className="p-3 bg-slate-50 rounded-xl text-center group relative cursor-help">
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[10px] font-medium max-w-[220px] whitespace-normal shadow-xl text-left">
                              Average time from {parts[0]} to {parts[1]}. Calculated from statusHistory timestamps across all orders with this transition.
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 rotate-45" />
                            </div>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {key.replace('_to_', ' → ').replace(/_/g, ' ')}
                          </p>
                          <p className="text-lg font-extrabold text-slate-700">{formatDuration(value)}</p>
                        </div>
                      );
                    })
                  }
                </div>
              )}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4">Sales Per Week</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dashboardMetrics.salesPerWeek}>
                  <defs>
                    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#dc2626" fill="url(#redGrad)" strokeWidth={2.5} dot={{ fill: '#dc2626', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4">Orders by Status</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dashboardMetrics.statusData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {dashboardMetrics.statusData.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users size={16} className="text-red-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Top 5 Customers</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {dashboardMetrics.topCustomers.map((c, i) => (
                <div key={c.name} onClick={() => setSelectedCustomer(c.name)} className="px-5 py-3 flex items-center justify-between hover:bg-red-50/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold ${i === 0 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</div>
                    <span className="font-bold text-sm text-slate-900 group-hover:text-red-600 transition-colors">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-red-600">{c.count} orders</span>
                    <ExternalLink size={12} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-red-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Recent Orders</h3>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                <input type="text" placeholder="Search orders..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', paddingRight: '2rem' }}
                  className="py-2 w-56 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all" />
                {orderSearch && <button onClick={() => setOrderSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-red-500 z-10"><X size={12} /></button>}
              </div>
            </div>
            {/* Status Filter Tabs */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
              {['All', ...Object.keys(ordersByStatus)].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                  style={statusFilter === status
                    ? { backgroundColor: status === 'All' ? '#dc2626' : (STATUS_COLORS[status] || '#64748b'), color: '#fff' }
                    : { backgroundColor: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {status} ({status === 'All' ? filteredOrders.length : (ordersByStatus[status] || 0)})
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {['', 'Order ID', 'Customer', 'Vendor', 'Status', 'Payment', 'Total', 'Duration', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {statusFilteredOrders.length === 0 ? (
                    <tr><td colSpan="9" className="px-4 py-12 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">No orders found</td></tr>
                  ) : statusFilteredOrders.map(order => (
                    <tr key={order._id || order.orderId} className="hover:bg-red-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => fetchOrderHistory(order.orderId || order._id)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="View Status History">
                          <History size={14} className="text-slate-400 hover:text-red-600" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600 cursor-pointer hover:underline" onClick={() => navigate(`/nepalcan-sales/${order.orderId}`)}>{order.orderId || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.customer || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{order.vendor || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : order.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' : order.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' : order.orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' : order.orderStatus === 'Returned' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>{order.orderStatus || 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.paymentStatus === 'Paid' || order.paymentStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' : order.paymentStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{order.paymentStatus || 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">NPR {order.totalAmount?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-300" />
                          {formatDuration(order.processingDurationHours)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !dashboardMetrics && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <ShoppingBag size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No sales data available. Click "Refresh" to fetch.</p>
        </div>
      )}

      {/* Order History Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onClick={() => { setSelectedOrder(null); setOrderHistory(null); }}>
          <div className="bg-white rounded-t-2xl lg:rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl lg:rounded-t-2xl">
              <div>
                <h3 className="font-extrabold">Order Status History</h3>
                <p className="text-xs text-red-200">Order ID: {selectedOrder}</p>
              </div>
              <button onClick={() => { setSelectedOrder(null); setOrderHistory(null); }} className="p-2 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {historyLoading ? (
                <div className="text-center py-8"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" /></div>
              ) : orderHistory ? (
                <div className="space-y-4">
                  {orderHistory.noPreviousData && <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100">No previous status data available</div>}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Customer</p><p className="text-sm font-bold text-slate-900">{orderHistory.customer || 'N/A'}</p></div>
                    <div className="p-3 bg-red-50 rounded-xl"><p className="text-[10px] font-bold text-red-400 uppercase mb-1">Status</p><p className="text-sm font-bold text-red-700">{orderHistory.orderStatus || 'Unknown'}</p></div>
                  </div>
                  <div className="space-y-2">
                    {orderHistory.statusHistory?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((entry, i, arr) => {
                      const nextEntry = arr[i + 1];
                      const durationHours = nextEntry
                        ? Math.round((new Date(entry.timestamp) - new Date(nextEntry.timestamp)) / (1000 * 60 * 60))
                        : null;
                      return (
                        <div key={i}>
                          <div className={`flex items-start gap-3 p-3 rounded-xl ${i === 0 ? 'bg-red-50 ring-1 ring-red-200' : 'bg-slate-50'}`}>
                            <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${entry.status === 'Delivered' ? 'bg-emerald-500' : entry.status === 'Processing' ? 'bg-blue-500' : entry.status === 'Shipped' ? 'bg-amber-500' : entry.status === 'Returned' ? 'bg-violet-500' : 'bg-slate-400'}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900 uppercase">{entry.status}</span>
                                <span className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          {durationHours !== null && (
                            <div className="flex items-center gap-2 pl-8 py-1">
                              <div className="w-px h-3 bg-slate-200" />
                              <span className="text-[9px] text-slate-400 font-bold">{formatDuration(durationHours)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <p className="text-sm text-slate-400 text-center py-4">Failed to load history</p>}
            </div>
          </div>
        </div>
      )}

      {/* Sync History Modal */}
      {showSyncHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onClick={() => setShowSyncHistory(false)}>
          <div className="bg-white rounded-t-2xl lg:rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl">
              <div>
                <h3 className="font-extrabold">Sync History</h3>
                <p className="text-xs text-red-200">Last 10 sync attempts</p>
              </div>
              <button onClick={() => setShowSyncHistory(false)} className="p-2 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-2">
              {syncHistory.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">No sync history</p> : syncHistory.map((log, i) => (
                <div key={i} className={`p-4 rounded-xl border ${log.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{log.success ? 'Success' : 'Failed'}</span>
                    <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{log.ordersSynced} orders <span className="text-[10px] font-normal text-slate-400">({log.durationMs}ms)</span></p>
                  {log.errorMessage && <p className="text-[10px] text-red-600 mt-1">{log.errorMessage}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Orders Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-white rounded-t-2xl lg:rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl">
              <div>
                <h3 className="font-extrabold">{selectedCustomer}</h3>
                <p className="text-xs text-red-200">{customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-white/10 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              {customerOrders.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No orders found</p>
              ) : (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="p-3 bg-slate-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total Spent</p>
                      <p className="text-sm font-extrabold text-slate-900">Rs. {customerOrders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase">Delivered</p>
                      <p className="text-sm font-extrabold text-emerald-700">{customerOrders.filter(o => o.orderStatus === 'Delivered').length}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-amber-500 uppercase">Pending/Processing</p>
                      <p className="text-sm font-extrabold text-amber-700">{customerOrders.filter(o => ['Pending', 'Processing', 'Shipped'].includes(o.orderStatus)).length}</p>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="space-y-2">
                    {customerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(order => (
                      <div key={order._id || order.orderId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-red-50/30 transition-colors cursor-pointer" onClick={() => { setSelectedCustomer(null); fetchOrderHistory(order.orderId || order._id); }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{order.orderId || order._id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLORS[order.orderStatus] ? '' : 'bg-slate-100 text-slate-600'}`}
                              style={STATUS_COLORS[order.orderStatus] ? { backgroundColor: STATUS_COLORS[order.orderStatus] + '20', color: STATUS_COLORS[order.orderStatus] } : {}}>
                              {order.orderStatus || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{order.vendor || 'N/A'} &middot; {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-extrabold text-slate-900">Rs. {(order.totalAmount || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">{order.paymentStatus || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NepalcanSalesPage;
