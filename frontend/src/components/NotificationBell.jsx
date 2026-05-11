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
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  const playNotificationSound = useCallback(() => {
    audioRef.current.play().catch(() => {
      console.log('Audio play blocked by browser. User interaction required.');
    });
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    if (notification.related_id && notification.related_model === 'Lead') {
      navigate(`/leads?intelligence=${notification.related_id}`);
      setIsOpen(false);
    }
  }, [navigate]);

  const showDesktopNotification = useCallback((title, message, notificationData) => {
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'bd-tracker-alert',
        vibrate: [200, 100, 200],
        data: notificationData
      });

      notification.onclick = () => {
        window.focus();
        handleNotificationClick(notificationData);
        notification.close();
      };
    }
  }, [handleNotificationClick]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success('Desktop notifications enabled!');
        playNotificationSound();
      }
    }
    
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
      } catch (e) {
        console.log('Service Worker registration failed:', e);
      }
    }
  }, [playNotificationSound]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newNotifications = res.data.data.notifications;
      
      // Check for new notifications that weren't there before
      const latestNotification = newNotifications[0];
      if (latestNotification && !latestNotification.is_read) {
        const notifDate = new Date(latestNotification.created_at);
        const notifId = latestNotification._id || latestNotification.id;
        
        // Only trigger alert if: newer than last fetch AND not already notified
        if (notifDate > lastFetchedRef.current && !notifiedIdsRef.current.has(notifId)) {
          notifiedIdsRef.current.add(notifId);
          // Trigger all alert mechanisms
          playNotificationSound();
          toast(latestNotification.message, {
            icon: latestNotification.type === 'follow_up' ? '⏰' : '📢',
            duration: 6000,
            position: 'top-center', // More visible for push-style
            onClick: () => handleNotificationClick(latestNotification)
          });
          showDesktopNotification(latestNotification.title, latestNotification.message, latestNotification);
        }
      }
      
      lastFetchedRef.current = new Date();
      setNotifications(newNotifications);
      
      const countRes = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(countRes.data.data.count);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [token, handleNotificationClick, playNotificationSound, showDesktopNotification]);

  useEffect(() => {
    if (token) {
      requestPermission();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds for more responsiveness
      return () => clearInterval(interval);
    }
  }, [token, requestPermission, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await axios.patch(`${API_URL}/notifications/${id}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notifiedIdsRef.current.delete(id);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [fetchNotifications, token]);

  const markAllAsRead = useCallback(async () => {
    try {
      await axios.patch(`${API_URL}/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      notifiedIdsRef.current.clear();
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [fetchNotifications, token]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
      >
        <Bell size={20} className={cn(unreadCount > 0 ? "text-red-600 animate-swing" : "text-slate-400")} />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-red-600 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-300">
          <div className="px-6 py-5 bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-red-600" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Intelligence Alerts</h3>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <BellOff size={32} className="text-slate-100" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Active Alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notification) => (
                  <div 
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "p-5 hover:bg-slate-50 transition-colors relative group cursor-pointer",
                      !notification.is_read && "bg-slate-50/50"
                    )}
                  >
                    {!notification.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
                    )}
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        notification.type === 'follow_up' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {notification.type === 'follow_up' ? <Clock size={18} /> : <AlertCircle size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-black text-slate-900 truncate pr-4">{notification.title}</h4>
                          {!notification.is_read && (
                            <button 
                              onClick={() => markAsRead(notification._id)}
                              className="p-1 hover:bg-emerald-50 text-emerald-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              title="Mark as read"
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase">
                             <Calendar size={10} />
                             {new Date(notification.scheduled_for).toLocaleDateString()}
                           </div>
                           <div className="w-1 h-1 bg-slate-200 rounded-full" />
                           <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase">
                             <Clock size={10} />
                             {new Date(notification.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
               Enterprise Alerting System v1.0
             </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;