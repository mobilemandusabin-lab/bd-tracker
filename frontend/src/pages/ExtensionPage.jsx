import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Puzzle, Download, CheckCircle, Clock, Users, Monitor, RefreshCw, ExternalLink, ChevronRight, Package, ShieldCheck, ShieldX, FileText, TrendingUp, BarChart3 } from 'lucide-react';
import { API_URL } from '../config/api';

const ExtensionPage = () => {
  const { token } = useSelector((state) => state.auth);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (token) fetchAnalytics();
  }, [period, selectedUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, devicesRes] = await Promise.all([
        axios.get(`${API_URL}/extension/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/extension/devices`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setStats(statsRes.data.data);
      setDevices(devicesRes.data.data.devices);
    } catch (err) {
      console.error('Error fetching extension data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_URL}/extension/analytics?period=${period}${selectedUser ? `&user_id=${selectedUser}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      setAnalytics(res.data.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.get(`${API_URL}/extension/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bd-tracker-extension-v${stats?.latestVersion || '1.0.0'}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Extension downloaded!');
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  const installationSteps = [
    { step: 1, title: 'Download Extension', desc: 'Click the download button above to get the .zip file' },
    { step: 2, title: 'Extract the Zip', desc: 'Extract the downloaded zip file to a folder on your computer' },
    { step: 3, title: 'Open Chrome Extensions', desc: 'Navigate to chrome://extensions/ in your browser' },
    { step: 4, title: 'Enable Developer Mode', desc: 'Toggle the "Developer mode" switch in the top right' },
    { step: 5, title: 'Load Unpacked', desc: 'Click "Load unpacked" and select the extracted folder' },
    { step: 6, title: 'Sign In', desc: 'Click the extension icon and sign in with your BD Tracker credentials' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-red-600 rounded-full" />
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Internal Operations</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Chrome Extension</h1>
      </div>

      {/* Download Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 bg-gradient-to-br from-red-50 to-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shrink-0">
                <Puzzle size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">BD Tracker Extension</h2>
                <p className="text-sm text-slate-500 mt-1">Capture listing, QC, and spec events from Nepalcan marketplace automatically.</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs font-bold text-slate-400">Version {stats?.latestVersion || '1.0.0'}</span>
                  {stats?.latestChangelog && (
                    <span className="text-xs text-slate-400">— {stats.latestChangelog}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-lg hover:shadow-red-200 transition-all disabled:opacity-50 shrink-0"
            >
              {downloading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span>{downloading ? 'Downloading...' : 'Download Extension'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Monitor} label="Active Devices" value={stats?.activeDevices || 0} color="emerald" />
        <StatCard icon={Monitor} label="Total Devices" value={stats?.totalDevices || 0} color="blue" />
        <StatCard icon={Users} label="Unique Users" value={stats?.uniqueUsers || 0} color="violet" />
        <StatCard icon={CheckCircle} label="Latest Version" value={stats?.latestVersion || '1.0.0'} color="amber" />
      </div>

      {/* Activity Analytics */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-red-500" />
            Activity Analytics
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* User Filter */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none"
            >
              <option value="">All Users</option>
              {analytics?.eventsByUser?.map((u) => (
                <option key={u._id} value={u._id}>{u.user_name || 'Unknown'}</option>
              ))}
            </select>
            {/* Period Filter */}
            {['today', '7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Metric Cards */}
        <div className="p-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ActivityCard icon={Package} label="Products Listed" value={analytics?.summary?.listing_created || 0} color="blue" />
          <ActivityCard icon={ShieldCheck} label="QC Approved" value={analytics?.summary?.qc_approved || 0} color="emerald" />
          <ActivityCard icon={ShieldX} label="QC Rejected" value={analytics?.summary?.qc_rejected || 0} color="red" />
          <ActivityCard icon={Clock} label="QC Pending" value={analytics?.summary?.qc_pending || 0} color="amber" />
          <ActivityCard icon={FileText} label="Specs Added" value={analytics?.summary?.spec_added || 0} color="violet" />
        </div>

        {/* Daily Breakdown */}
        {analytics?.dailyEvents?.length > 0 && (
          <div className="px-6 pb-6">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Daily Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Listed</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">QC Approved</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">QC Rejected</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Specs</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    // Group daily events by date
                    const byDate = {};
                    for (const ev of analytics.dailyEvents) {
                      if (!byDate[ev._id.date]) byDate[ev._id.date] = {};
                      byDate[ev._id.date][ev._id.event_type] = ev.count;
                    }
                    return Object.entries(byDate).reverse().map(([date, counts]) => {
                      const total = Object.values(counts).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={date} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-700">{date}</td>
                          <td className="px-4 py-2 text-center text-blue-600 font-bold">{counts.listing_created || 0}</td>
                          <td className="px-4 py-2 text-center text-emerald-600 font-bold">{counts.qc_approved || 0}</td>
                          <td className="px-4 py-2 text-center text-red-600 font-bold">{counts.qc_rejected || 0}</td>
                          <td className="px-4 py-2 text-center text-violet-600 font-bold">{counts.spec_added || 0}</td>
                          <td className="px-4 py-2 text-center font-bold text-slate-900">{total}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Performance */}
        {analytics?.eventsByUser?.length > 0 && (
          <div className="px-6 pb-6">
            <h4 className="text-sm font-bold text-slate-700 mb-3">User Performance</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">User</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Listed</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">QC Approved</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">QC Rejected</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Specs</th>
                    <th className="px-4 py-2 text-center text-[10px] font-bold text-slate-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analytics.eventsByUser.map((user) => {
                    const eventMap = {};
                    for (const ev of user.events) {
                      eventMap[ev.event_type] = ev.count;
                    }
                    return (
                      <tr key={user._id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <div className="font-bold text-slate-900">{user.user_name || 'Unknown'}</div>
                          {user.user_team && <div className="text-[10px] text-slate-400 uppercase">{user.user_team}</div>}
                        </td>
                        <td className="px-4 py-2 text-center text-blue-600 font-bold">{eventMap.listing_created || 0}</td>
                        <td className="px-4 py-2 text-center text-emerald-600 font-bold">{eventMap.qc_approved || 0}</td>
                        <td className="px-4 py-2 text-center text-red-600 font-bold">{eventMap.qc_rejected || 0}</td>
                        <td className="px-4 py-2 text-center text-violet-600 font-bold">{eventMap.spec_added || 0}</td>
                        <td className="px-4 py-2 text-center font-bold text-slate-900">{user.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!analytics || analytics?.summary?.total === 0) && (
          <div className="p-8 text-center">
            <TrendingUp size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">No activity recorded yet</p>
            <p className="text-xs text-slate-300 mt-1">Activity will appear here once the extension starts capturing events</p>
          </div>
        )}
      </div>

      {/* Installation Guide */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <ExternalLink size={18} className="text-red-500" />
          Installation Guide
        </h3>
        <div className="space-y-3">
          {installationSteps.map((item) => (
            <div key={item.step} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-sm font-extrabold text-red-600">{item.step}</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connected Devices */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Monitor size={18} className="text-red-500" />
            Connected Devices
          </h3>
          <button onClick={fetchData} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
        {devices.length === 0 ? (
          <div className="p-8 text-center">
            <Monitor size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">No devices connected yet</p>
            <p className="text-xs text-slate-300 mt-1">Install the extension and sign in to see devices here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device ID</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Version</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {devices.map((device) => {
                  const isActive = device.last_heartbeat && (Date.now() - new Date(device.last_heartbeat).getTime()) < 15 * 60 * 1000;
                  return (
                    <tr key={device._id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="text-sm font-bold text-slate-900">{device.user_id?.name || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-400">{device.user_id?.email || ''}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-mono text-slate-500">{device.device_id?.substring(0, 16)}...</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs font-bold text-slate-600">v{device.extension_version}</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-xs text-slate-500">{formatTime(device.last_heartbeat)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-extrabold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
};

const ActivityCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };

  return (
    <div className="p-4 bg-slate-50 rounded-xl text-center">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
};

export default ExtensionPage;
