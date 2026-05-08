import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { 
  Loader2, AlertCircle, RefreshCw, ShoppingBag, LogIn, 
  TrendingUp, Package, Truck, CheckCircle, Users, 
  BarChart3, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';

const API_BASE = 'https://commerce.thecanbrand.com/api';
const API_URL = 'http://localhost:5000/api/v1';
const TOKEN_STORAGE_KEY = 'nepalcan_token';

const STATUS_COLORS = {
  'Pending': '#fbbf24',
  'Processing': '#3b82f6',
  'Shipped': '#f59e0b',
  'Delivered': '#10b981',
  'Cancelled': '#ef4444'
};

const NepalcanSalesPage = () => {
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nepalcanToken, setNepalcanToken] = useState(null);
  const [allOrders, setAllOrders] = useState([]); // Store all fetched orders
  const [filteredOrders, setFilteredOrders] = useState([]); // Orders after filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [loginForm, setLoginForm] = useState({
    email: 'sabin.awal@buy.nepalcan.com',
    password: '1'
  });
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Filter states
  const [searchCustomer, setSearchCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Fetch stats from backend
  const fetchStats = async () => {
    try {
      const backendToken = localStorage.getItem('token');
      const headers = {};
      
      if (backendToken) {
        headers['Authorization'] = `Bearer ${backendToken}`;
      }

      const res = await axios.get(`${API_URL}/nepalcan-orders/stats`, { headers });
      setNepalcanStats(res.data);
      console.log('Fetched Nepalcan stats:', res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err.message);
    }
  };

  // Sync orders to backend
  const syncOrdersToBackend = async (ordersList, token) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      
      const backendToken = localStorage.getItem('token');
      if (backendToken) {
        headers['Authorization'] = `Bearer ${backendToken}`;
      }

      await axios.post(
        `${API_URL}/nepalcan-orders/sync`,
        { orders: ordersList, token },
        { headers }
      );
      
      console.log('Orders synced to backend');
      fetchStats();
    } catch (err) {
      console.error('Failed to sync orders to backend:', err.message);
    }
  };

  // On component mount, try to fetch orders with stored token
  useEffect(() => {
    const attemptAutoFetch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        const headers = {
          'Content-Type': 'application/json',
          'Origin': 'https://commerce.thecanbrand.com',
          'Referer': 'https://commerce.thecanbrand.com/'
        };

        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
          setNepalcanToken(storedToken);
        }

        const res = await axios.get(
          `${API_BASE}/vendor/orders/super-admin/list`,
          {
            params: {
              tab: 'marketplace',
              page: 1,
              limit: 100,
              unattendedOrders: '',
              status: 'Active'
            },
            headers
          }
        );

        const responseData = res.data;
        let ordersList = [];

        if (responseData?.data?.orders && Array.isArray(responseData.data.orders)) {
          ordersList = responseData.data.orders;
        } else if (responseData?.orders && Array.isArray(responseData.orders)) {
          ordersList = responseData.orders;
        } else if (Array.isArray(responseData)) {
          ordersList = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          ordersList = responseData.data;
        }

        if (ordersList.length > 0) {
          console.log('Auto-fetched orders:', ordersList.length);
          setAllOrders(ordersList);
          setShowLoginForm(false);
          syncOrdersToBackend(ordersList, storedToken);
        } else {
          setShowLoginForm(true);
          setNepalcanToken(null);
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch (err) {
        console.log('Auto-fetch failed, showing login form:', err.message);
        setShowLoginForm(true);
        setNepalcanToken(null);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } finally {
        setLoading(false);
        setInitialCheckDone(true);
      }
    };
    
    attemptAutoFetch();
    fetchStats();
  }, []);

  const handleLoginFormChange = (e) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setError(null);
    
    try {
      const res = await axios.post(
        `${API_BASE}/users/login`,
        loginForm,
        {
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://commerce.thecanbrand.com',
            'Referer': 'https://commerce.thecanbrand.com/'
          }
        }
      );
      
      if (res.data?.token) {
        setNepalcanToken(res.data.token);
        localStorage.setItem(TOKEN_STORAGE_KEY, res.data.token);
        setShowLoginForm(false);
        fetchSalesData(res.data.token);
      } else {
        setError('No token received from Nepalcan');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to login to Nepalcan');
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchSalesData = async (npToken) => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://commerce.thecanbrand.com',
        'Referer': 'https://commerce.thecanbrand.com/'
      };
      
      if (npToken) {
        headers['Authorization'] = `Bearer ${npToken}`;
      }
      
      const res = await axios.get(
        `${API_BASE}/vendor/orders/super-admin/list`,
        {
          params: {
            tab: 'marketplace',
            page: 1,
            limit: 100,
            unattendedOrders: '',
            status: 'Active'
          },
          headers
        }
      );
      
      const responseData = res.data;
      let ordersList = [];
      
      if (responseData?.data?.orders && Array.isArray(responseData.data.orders)) {
        ordersList = responseData.data.orders;
      } else if (responseData?.orders && Array.isArray(responseData.orders)) {
        ordersList = responseData.orders;
      } else if (Array.isArray(responseData)) {
        ordersList = responseData;
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        ordersList = responseData.data;
      }

      console.log('Fetched orders:', ordersList.length, 'Sample:', ordersList[0]);      
      setAllOrders(ordersList);
      syncOrdersToBackend(ordersList, npToken);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to fetch sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (nepalcanToken) {
      fetchSalesData(nepalcanToken);
    } else {
      setShowLoginForm(true);
    }
  };

  const handleLogout = () => {
    setNepalcanToken(null);
    setOrders([]);
    setShowLoginForm(true);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  };

  // Fetch order history from backend
  const fetchOrderHistory = async (orderId) => {
    setHistoryLoading(true);
    setSelectedOrder(orderId);
    setOrderHistory(null);
    
    try {
      const backendToken = localStorage.getItem('token');
      const headers = {};
      
      if (backendToken) {
        headers['Authorization'] = `Bearer ${backendToken}`;
      }

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

  // Calculate paginated orders with filters
  const { paginatedOrders, totalPages, totalOrders } = useMemo(() => {
    let filtered = [...allOrders];

    // Filter by customer name (search)
    if (searchCustomer.trim()) {
      const search = searchCustomer.toLowerCase();
      filtered = filtered.filter(order => 
        (order.customer && order.customer.toLowerCase().includes(search)) ||
        (order.shippingAddress?.firstName && order.shippingAddress.firstName.toLowerCase().includes(search)) ||
        (order.shippingAddress?.lastName && order.shippingAddress.lastName.toLowerCase().includes(search))
      );
    }

    // Filter by order status
    if (filterStatus) {
      filtered = filtered.filter(order => order.orderStatus === filterStatus);
    }

    // Filter by payment status
    if (filterPaymentStatus) {
      filtered = filtered.filter(order => order.paymentStatus === filterPaymentStatus);
    }

    // Filter by date range
    if (filterStartDate) {
      const startDate = new Date(filterStartDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => new Date(order.createdAt) >= startDate);
    }

    if (filterEndDate) {
      const endDate = new Date(filterEndDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(order => new Date(order.createdAt) <= endDate);
    }

    const total = filtered.length;
    const pages = Math.ceil(total / ordersPerPage) || 1;
    const startIndex = (currentPage - 1) * ordersPerPage;
    const paginated = filtered.slice(startIndex, startIndex + ordersPerPage);

    return { paginatedOrders: paginated, totalPages: pages, totalOrders: total };
  }, [allOrders, searchCustomer, filterStatus, filterPaymentStatus, filterStartDate, filterEndDate, currentPage, ordersPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchCustomer, filterStatus, filterPaymentStatus, filterStartDate, filterEndDate]);

  // Calculate stats from orders
  const nepalcanStats = useMemo(() => {
    if (!allOrders || allOrders.length === 0) {
      return null;
    }

    const orders = allOrders;

    // Filter only delivered orders for revenue and AOV calculations
    const deliveredOrdersList = orders.filter(o => o.orderStatus === 'Delivered');
    const deliveredOrdersCount = deliveredOrdersList.length;
    
    // Revenue from delivered orders only
    const totalRevenue = deliveredOrdersList.reduce((sum, order) => {
      const orderTotal = order.totalAmount || 0;
      return sum + (typeof orderTotal === 'number' ? orderTotal : 0);
    }, 0);
    
    // AOV (Average Order Value)
    const aov = deliveredOrdersCount > 0 ? Math.round(totalRevenue / deliveredOrdersCount) : 0;

    // Processing orders
    const processingOrders = orders.filter(o => {
      const status = o.orderStatus || '';
      return status === 'Processing' || status === 'Pending';
    }).length;
    
    // Unique customers
    const uniqueCustomers = [...new Set(
      orders
        .filter(o => {
          const status = o.orderStatus || '';
          return status === 'Delivered' || status === 'Pending';
        })
        .map(o => o.customer)
        .filter(Boolean)
    )].length;

    return { totalRevenue, aov, processingOrders, deliveredOrders: deliveredOrdersCount, uniqueCustomers };
  }, [allOrders]);

  if (showLoginForm || !nepalcanToken) {
    return (
      <div className="space-y-6 lg:space-y-10 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 lg:gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1 lg:mb-2">
              <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
              <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">
                Nepalcan.com Integration
              </span>
            </div>
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">
              Login to Nepalcan Sales
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-sm max-w-md mx-auto">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <LogIn size={20} className="text-red-600" />
              <h2 className="text-lg font-black text-slate-900">
                Nepalcan.com Login
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enter your Nepalcan.com credentials to access sales data
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={loginForm.email}
                onChange={handleLoginFormChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
                placeholder="Enter Nepalcan email"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginFormChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Login to Nepalcan
                </>
              )}
            </button>
          </form>

          <div className="px-6 pb-6">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Default Credentials
              </p>
              <p className="text-xs text-slate-600 font-mono">
                Email: sabin.awal@buy.nepalcan.com<br />
                Password: 1
              </p>
            </div>
          </div>
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
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">
              Nepalcan.com Integration
            </span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">
            Active Sellers Sales
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <LogIn size={14} />
            Change Login
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Token Status */}
      {nepalcanToken && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Connected to Nepalcan.com API
          <span className="ml-auto text-[10px] opacity-60">
            Logged in as: {loginForm.email}
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Loading Dashboard...
          </p>
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && dashboardMetrics && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Package size={18} className="text-blue-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.totalOrders}</h3>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className="text-emerald-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue (Delivered)</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">NPR {dashboardMetrics.totalRevenue.toLocaleString()}</h3>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={18} className="text-purple-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AOV (Delivered)</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">NPR {dashboardMetrics.aov.toLocaleString()}</h3>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={18} className="text-amber-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.processingOrders}</h3>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={18} className="text-emerald-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivered</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.deliveredOrders}</h3>
            </div>

            <div className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-purple-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unique Customers</p>
              </div>
              <h3 className="text-2xl lg:text-3xl font-black text-slate-900">{dashboardMetrics.uniqueCustomers}</h3>
            </div>
          </div>

          {/* Processing Time Stats from Backend */}
          {nepalcanStats && (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Calendar size={20} />
                Average Order Processing Times
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending → Processing</p>
                  <p className="text-2xl font-black text-blue-600">{nepalcanStats.averages?.pendingToProcessing || 0} hrs</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Processing → Shipped</p>
                  <p className="text-2xl font-black text-amber-600">{nepalcanStats.averages?.processingToDelivered || 0} hrs</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Fulfillment</p>
                  <p className="text-2xl font-black text-emerald-600">{nepalcanStats.averages?.totalFulfillment || 0} hrs</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-3">
                Based on {nepalcanStats.ordersAnalyzed || 0} delivered orders with complete status history
              </p>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Per Week */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <Calendar size={20} />
                Sales Per Week
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardMetrics.salesPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#dc2626" fill="#fee2e2" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders by Status */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 size={20} />
                Orders by Status
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardMetrics.statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {dashboardMetrics.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users size={20} />
                Top 5 Customers
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {dashboardMetrics.topCustomers.map((customer, index) => (
                <div key={customer.name} className="p-4 lg:p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-slate-100 text-slate-600' :
                      index === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-bold text-sm text-slate-900">{customer.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-600">{customer.count} orders</span>
                </div>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShoppingBag size={20} />
                  Recent Orders ({totalOrders})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSearchCustomer('');
                      setFilterStatus('');
                      setFilterPaymentStatus('');
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-xs"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-xs"
                >
                  <option value="">All Order Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-xs"
                >
                  <option value="">All Payment Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Failed">Failed</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-xs"
                    placeholder="Start Date"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-xs"
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>
            
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Order ID</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Status</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-sm text-slate-400">
                        No orders found with current filters
                      </td>
                    </tr>
                  ) : paginatedOrders.map((order) => (
                    <tr key={order._id || order.orderId} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4 text-sm font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => fetchOrderHistory(order.orderId || order.orderId)}>
                        {order.orderId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{order.customer || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {order.shippingAddress?.phone || order.billingAddress?.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          order.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                          order.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' :
                          order.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                          order.orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {order.orderStatus || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          order.paymentStatus === 'Paid' || order.paymentStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          order.paymentStatus === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          order.paymentStatus === 'Failed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {order.paymentStatus || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">NPR {order.totalAmount?.toLocaleString() || 0}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Only visible on small screens */}
            <div className="block lg:hidden">
              {paginatedOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingBag size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No orders found</p>
                </div>
              ) : paginatedOrders.map((order) => (
                <div key={order._id || order.orderId} className="p-4 border-b border-slate-100 last:border-b-0 active:bg-slate-50" onClick={() => fetchOrderHistory(order.orderId || order.orderId)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-blue-600 truncate">{order.orderId || 'N/A'}</div>
                      <div className="text-sm font-bold text-slate-700 truncate mt-0.5">{order.customer || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {order.shippingAddress?.phone || order.billingAddress?.phone || 'No phone'}
                      </div>
                    </div>
                    <div className="ml-2 shrink-0">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        order.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                        order.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        order.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                        order.orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {order.orderStatus || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      order.paymentStatus === 'Paid' || order.paymentStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                      order.paymentStatus === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      order.paymentStatus === 'Failed' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {order.paymentStatus || 'Unknown'}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">NPR {order.totalAmount?.toLocaleString() || 0}</div>
                      <div className="text-[10px] text-slate-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-all"
                >
                  ← Previous
                </button>
                <span className="text-xs font-bold text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-all"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Data Fallback */}
      {!loading && !dashboardMetrics && orders.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-sm font-bold text-slate-400">
            No sales data available. Click "Refresh Data" to fetch.
          </p>
        </div>
      )}

      {/* Order History Modal */}
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
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
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
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                      <p className="text-sm font-bold text-slate-900">{orderHistory.customer}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Status</p>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        orderHistory.orderStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                        orderHistory.orderStatus === 'Processing' ? 'bg-blue-100 text-blue-700' :
                        orderHistory.orderStatus === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                        orderHistory.orderStatus === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {orderHistory.orderStatus}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Status Changes</h4>
                  <div className="space-y-3">
                    {orderHistory.statusHistory?.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((entry, index) => (
                      <div key={index} className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl">
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                          entry.status === 'Delivered' ? 'bg-emerald-500' :
                          entry.status === 'Processing' ? 'bg-blue-500' :
                          entry.status === 'Shipped' ? 'bg-amber-500' :
                          entry.status === 'Pending' ? 'bg-yellow-500' :
                          'bg-slate-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              entry.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                              entry.status === 'Processing' ? 'bg-blue-100 text-blue-700' :
                              entry.status === 'Shipped' ? 'bg-amber-100 text-amber-700' :
                              entry.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {entry.status}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {index > 0 && orderHistory.statusHistory[index - 1] && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              Time since previous status: {
                                Math.round((new Date(entry.timestamp) - new Date(orderHistory.statusHistory[index - 1].timestamp)) / (1000 * 60 * 60))
                              } hrs
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {orderHistory.statusHistory?.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No status history available</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Failed to load order history</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NepalcanSalesPage;
