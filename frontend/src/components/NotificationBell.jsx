import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, BellOff, Clock, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const NotificationBell = ({ token }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const lastFetchedRef = useRef(new Date());
  const notifiedIdsRef = useRef(new Set());
  const audioRef = useRef(new Audio('/sounds/notification.mp3'));

  const playNotificationSound = useCallback(() => {
    audioRef.current.play().catch(() => {});
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    if (notification.related_id && notification.related_model === 'Lead') {
      navigate(`/leads?intelligence=${notification.related_id}`);
      setIsOpen(false);
    } else if (notification.related_id && notification.related_model === 'Task') {
      navigate(`/tasks?taskId=${notification.related_id}`);
      setIsOpen(false);
    }
  }, [navigate]);

  const showDesktopNotification = useCallback((title, message, notificationData) => {
    if (Notification.permission === "granted") {
      const n = new Notification(title, {
        body: message, icon: '/favicon.ico', badge: '/favicon.ico',
        tag: 'bd-tracker-alert', vibrate: [200, 100, 200], data: notificationData
      });
      n.onclick = () => { window.focus(); handleNotificationClick(notificationData); n.close(); };
    }
  }, [handleNotificationClick]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") { toast.success('Desktop notifications enabled!'); playNotificationSound(); }
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
    }
  }, [playNotificationSound]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const newNotifications = res.data.data.notifications;
      const latest = newNotifications[0];
      if (latest && !latest.is_read) {
        const notifId = latest._id || latest.id;
        if (new Date(latest.created_at) > lastFetchedRef.current && !notifiedIdsRef.current.has(notifId)) {
          notifiedIdsRef.current.add(notifId);
          playNotificationSound();
          toast(latest.message, { icon: latest.type === 'follow_up' ? '⏰' : '📢', duration: 6000, position: 'top-center', onClick: () => handleNotificationClick(latest) });
          showDesktopNotification(latest.title, latest.message, latest);
        }
      }
      lastFetchedRef.current = new Date();
      setNotifications(newNotifications);
      const countRes = await axios.get(`${API_URL}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
      setUnreadCount(countRes.data.data.count);
    } catch (err) {
      // Suppress network errors (offline, network changed, etc.)
      if (!err.message?.includes('Network Error') && !err.code?.includes('ERR_NETWORK')) {
        console.error('Error fetching notifications:', err);
      }
    }
  }, [token, handleNotificationClick, playNotificationSound, showDesktopNotification]);

  useEffect(() => {
    if (token) {
      requestPermission();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [token, requestPermission, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await axios.patch(`${API_URL}/notifications/${id}/mark-read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      notifiedIdsRef.current.delete(id);
      fetchNotifications();
    } catch (err) { console.error('Error marking as read:', err); }
  }, [fetchNotifications, token]);

  const markAllAsRead = useCallback(async () => {
    try {
      await axios.patch(`${API_URL}/notifications/mark-all-read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      notifiedIdsRef.current.clear();
      fetchNotifications();
    } catch (err) { console.error('Error marking all as read:', err); }
  }, [fetchNotifications, token]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-white border border-slate-100 rounded-xl hover:bg-red-50 hover:border-red-100 transition-all">
        <Bell size={18} className={cn(unreadCount > 0 ? "text-red-600" : "text-slate-400")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[200] animate-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Notifications</h3>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}
                className="text-[10px] font-bold text-red-200 hover:text-white uppercase tracking-wider transition-colors">
                Mark All Read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <BellOff size={20} className="text-slate-200" />
                <p className="text-xs font-bold text-slate-400 uppercase">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div key={n._id} onClick={() => handleNotificationClick(n)}
                    className={cn("p-4 hover:bg-red-50/50 transition-colors relative group cursor-pointer", !n.is_read && "bg-red-50/30")}>
                    {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-600" />}
                    <div className="flex gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        n.type?.includes('follow_up') ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {n.type?.includes('follow_up') ? <Clock size={14} /> : <AlertCircle size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate pr-2">{n.title}</h4>
                          {!n.is_read && (
                            <button onClick={(e) => { e.stopPropagation(); markAsRead(n._id); }}
                              className="p-0.5 hover:bg-emerald-50 text-emerald-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                              title="Mark as read">
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mb-1">{n.message}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Calendar size={10} />
                            {new Date(n.scheduled_for).toLocaleDateString()}
                          </div>
                          <div className="w-0.5 h-0.5 bg-slate-200 rounded-full" />
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Clock size={10} />
                            {new Date(n.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
