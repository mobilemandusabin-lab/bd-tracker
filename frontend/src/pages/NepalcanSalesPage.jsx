import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { 
  Loader2, AlertCircle, RefreshCw, ShoppingBag, 
  TrendingUp, Package, Truck, CheckCircle, Users, 
  BarChart3, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const STATUS_COLORS = {
  'Pending': '#fbbf24',
  'Processing': '#3b82f6',
  'Shipped': '#f59e0b',
  'Delivered': '#10b981',
  'Cancelled': '#ef4444'
};

const NepalcanSalesPage = () => {
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

  // Fetch sync history
  const fetchSyncHistory = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/sync-logs?limit=10`, { headers });
      setSyncHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch sync history:', err.message);
    }
  };

  // Fetch stats from backend
  const fetchStats = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/stats`, { headers });
      setNepalcanStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err.message);
    }
  };

  // Fetch last sync log
  const fetchSyncLog = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/sync-log/last`, { headers });
      setSyncLog(res.data);
    } catch (err) {
      console.error('Failed to fetch sync log:', err.message);
    }
  };

  // Fetch orders from backend
  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/orders?page=1&limit=500`, { headers });
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err.message);
      setError(err.response?.data?.message || 'Failed to fetch sales data');
    } finally {
      setLoading(false);
    }
  };

  // On component mount
  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchSyncLog();
  }, []);

  // Fetch order history from backend
  const fetchOrderHistory = async (orderId) => {
    setHistoryLoading(true);
    setSelectedOrder(orderId);
    setOrderHistory(null);
    try {
      const backendToken = localStorage.getItem('token');
      const headers = backendToken ? { 'Authorization': `Bearer ${backendToken}` } : {};
      const res = await axios.get(`${API_URL}/nepalcan-orders/order/${orderId}`, { headers });
      setOrderHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch order history:', err.message);
      setError('Failed to fetch order history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setSelectedOrder(null);
    setOrderHistory(null);
  };

  // Calculate dashboard metrics from orders
  const dashboardMetrics = useMemo(() => {
    if (!orders || orders.length === 0) return null;

    const totalOrders = orders.length;
    const deliveredOrdersList = orders.filter(o => o.orderStatus === 'Delivered');
    const deliveredOrdersCount = deliveredOrdersList.length;
    const totalRevenue = deliveredOrdersList.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const aov = deliveredOrdersCount > 0 ? Math.round(totalRevenue / deliveredOrdersCount) : 0;
    const processingOrders = orders.filter(o => ['Processing', 'Pending'].includes(o.orderStatus || '')).length;
    const deliveredOrders = deliveredOrdersCount;
    const uniqueCustomers = [...new Set(orders.filter(o => ['Delivered', 'Pending'].includes(o.orderStatus || '')).map(o => o.customer).filter(Boolean))].length;

    const customerOrders = {};
    orders.forEach(o => {
      if (['Delivered', 'Pending'].includes(o.orderStatus || '')) {
        const customer = o.customer || 'Unknown';
        customerOrders[customer] = (customerOrders[customer] || 0) + 1;
      }
    });
    const topCustomers = Object.entries(customerOrders).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

    const weeklySales = {};
    orders.forEach(o => {
      if (o.createdAt) {
        const date = new Date(o.createdAt);
        if (!isNaN(date.getTime())) {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const weekKey = weekStart.toISOString().split('T')[0];
          weeklySales[weekKey] = (weeklySales[weekKey] || 0) + (o.totalAmount || 0);
        }
      }
    });
    const salesPerWeek = Object.entries(weeklySales).sort((a, b) => a[0].localeCompare(b[0])).map(([week, revenue]) => ({ week, revenue }));

    const ordersByStatus = {};
    orders.forEach(o => {
      const status = o.orderStatus || 'Unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });
    const statusData = Object.entries(ordersByStatus).map(([name, value]) => ({ name, value }));

    return { totalOrders, totalRevenue, aov, processingOrders, deliveredOrders, uniqueCustomers, topCustomers, salesPerWeek, statusData };
  }, [orders]);

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6 lg:space-y-10 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-10 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Nepalcan.com Integration</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Active Sellers Sales</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchOrders(); fetchStats(); fetchSyncLog(); }} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
          <button onClick={() => { fetchSyncHistory(); setShowSyncHistory(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <Calendar size={14} />
            Sync History
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {syncLog && (
        <div className={`p-4 rounded-xl text-sm font-bold border flex items-center justify-between ${syncLog.success ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${syncLog.success ? 'bg-blue-500' : 'bg-red-500'}`} />
            Last Cron Sync: {new Date(syncLog.createdAt || syncLog.timestamp).toLocaleString()}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold">{syncLog.success ? 'Success' : 'Failed'} - {syncLog.ordersSynced} orders</div>
            {syncLog.errorMessage && <div className="text-[10px] opacity-80 max-w-xs truncate">{syncLog.errorMessage}</div>}
          </div>
        </div>
      )}

      {!loading && dashboardMetrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Package size={18} className="text-blue-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.totalOrders}</h3>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-emerald-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue (Delivered)</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">NPR {dashboardMetrics.totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><BarChart3 size={18} className="text-purple-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AOV (Delivered)</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">NPR {dashboardMetrics.aov.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Truck size={18} className="text-amber-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.processingOrders}</h3>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><CheckCircle size={18} className="text-emerald-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivered</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.deliveredOrders}</h3>
            </div>
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Users size={18} className="text-purple-600" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unique Customers</p></div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.uniqueCustomers}</h3>
            </div>
          </div>

          {nepalcanStats && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Calendar size={20} />Average Order Processing Times</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending → Processing</p><p className="text-2xl font-black text-blue-600">{nepalcanStats.averages?.pendingToProcessing || 0} hrs</p></div>
                <div className="p-4 bg-amber-50 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Processing → Shipped</p><p className="text-2xl font-black text-amber-600">{nepalcanStats.averages?.processingToDelivered || 0} hrs</p></div>
                <div className="p-4 bg-emerald-50 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Fulfillment</p><p className="text-2xl font-black text-emerald-600">{nepalcanStats.averages?.totalFulfillment || 0} hrs</p></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><Calendar size={20} />Sales Per Week</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardMetrics.salesPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#dc2626" fill="#fee2e2" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2"><BarChart3 size={20} />Orders by Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dashboardMetrics.statusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {dashboardMetrics.statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#6b7280'} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Users size={20} />Top 5 Customers</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {dashboardMetrics.topCustomers.map((customer, index) => (
                <div key={customer.name} className="p-4 lg:p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-slate-100 text-slate-600' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>{index + 1}</div>
                    <span className="font-bold text-sm text-slate-900">{customer.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-600">{customer.count} orders</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><ShoppingBag size={20} />Recent Orders</h3>
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Order ID</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendor</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Status</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
<tbody className="divide-y divide-slate-50">
                   {orders.map((order) => (
                    <tr key={order._id || order.orderId} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4 text-sm font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => fetchOrderHistory(order.orderId || order._id)}>{order.orderId || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{order.customer || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{order.vendor || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          order.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                          order.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' :
                          order.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                          order.orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'}`}>{order.orderStatus || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          order.paymentStatus === 'Paid' || order.paymentStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          order.paymentStatus === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'}`}>{order.paymentStatus || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">NPR {order.totalAmount?.toLocaleString() || 0}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !dashboardMetrics && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-sm font-bold text-slate-400">No sales data available. Click "Refresh Data" to fetch.</p>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeHistoryModal}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Order Status History</h3>
                <p className="text-xs text-slate-500 mt-1">Order ID: {selectedOrder}</p>
              </div>
              <button onClick={closeHistoryModal} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 001.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
<div className="p-6 overflow-y-auto max-h-[60vh]">
               {historyLoading ? (
                 <div className="text-center py-8">
                   <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                   <p className="text-xs text-slate-400 mt-2">Loading history...</p>
                 </div>
               ) : orderHistory ? (
                 <div className="space-y-4">
                   {orderHistory.noPreviousData && (
                     <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100">
                       No previous status data available - this order was just tracked
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4 mb-6">
                     <div className="p-3 bg-slate-50 rounded-xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                       <p className="text-sm font-bold text-slate-900">{orderHistory.customer || 'N/A'}</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status</p>
                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                         orderHistory.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                         orderHistory.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' :
                         orderHistory.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                         orderHistory.orderStatus === 'Pending' ? 'bg-slate-100 text-slate-600' :
                         'bg-slate-100 text-slate-600'}`}>{orderHistory.orderStatus || 'Unknown'}</span>
                     </div>
                   </div>
<h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Status Changes</h4>
                    <div className="space-y-3">
                      {orderHistory.statusHistory?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((entry, index, arr) => {
                        const isLatest = index === 0;
                        const prevEntry = index < arr.length - 1 ? arr[index + 1] : null;
                        
                        const durationFromBackend = prevEntry 
                          ? orderHistory.statusDurations?.[`${prevEntry.status}_to_${entry.status}`]
                          : null;
                        
                        return (
                          <div key={index} className={`flex items-start gap-4 p-3 rounded-xl ${isLatest ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}`}>
                            <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                              entry.status === 'Delivered' ? 'bg-emerald-500' :
                              entry.status === 'Processing' ? 'bg-blue-500' :
                              entry.status === 'Shipped' ? 'bg-amber-500' :
                              'bg-slate-400'}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                    entry.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                                    entry.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                                    entry.status === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'}`}>{entry.status}</span>
                                  {isLatest && <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded">LATEST</span>}
                                </div>
                                <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                              </div>
                              {prevEntry && durationFromBackend !== null && (
                                <div className="text-[10px] text-slate-600 mt-1 font-bold">
                                  {prevEntry.status} → {entry.status}: {durationFromBackend} hrs
                                </div>
                              )}
                              {index > 0 && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  +{Math.round((new Date(arr[0].timestamp) - new Date(entry.timestamp)) / (1000 * 60 * 60))} hrs until latest
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                 </div>
               ) : (
                 <p className="text-sm text-slate-400 text-center py-4">Failed to load order history</p>
               )}
             </div>
          </div>
        </div>
      )}

      {showSyncHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSyncHistory(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Cron Job Sync History</h3>
                <p className="text-xs text-slate-500 mt-1">Last 10 sync attempts</p>
              </div>
              <button onClick={() => setShowSyncHistory(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 001.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {syncHistory.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No sync history available</p>
              ) : (
                <div className="space-y-3">
                  {syncHistory.map((log, index) => (
                    <div key={index} className={`p-4 rounded-xl border ${log.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${log.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(log.createdAt || log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {log.ordersSynced} orders synced<span className="text-[10px] font-normal text-slate-500 ml-2">({log.durationMs}ms)</span>
                      </div>
                      {log.errorMessage && <p className="text-[10px] text-red-600 mt-1">{log.errorMessage}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NepalcanSalesPage;