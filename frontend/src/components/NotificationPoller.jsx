import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../config/api';

const NotificationContext = createContext(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children, token }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchedRef = useRef(new Date());
  const notifiedIdsRef = useRef(new Set());
  const audioRef = useRef(new Audio('/sounds/notification.mp3'));

  const playNotificationSound = useCallback(() => {
    audioRef.current.play().catch(() => {});
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    if (notification.related_id && notification.related_model === 'Lead') {
      navigate(`/leads?intelligence=${notification.related_id}`);
    } else if (notification.related_id && notification.related_model === 'Task') {
      navigate(`/tasks?taskId=${notification.related_id}`);
    }
  }, [navigate]);

  const showDesktopNotification = useCallback((title, message, notificationData) => {
    if (Notification.permission === "granted") {
      const n = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `bd-tracker-alert-${notificationData._id || notificationData.id}`,
        vibrate: [200, 100, 200],
        data: notificationData
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
    if (!token) return;
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
      if (!err.message?.includes('Network Error') && !err.code?.includes('ERR_NETWORK')) {
        console.error('Error fetching notifications:', err);
      }
    }
  }, [token, handleNotificationClick, playNotificationSound, showDesktopNotification]);

  useEffect(() => {
    if (token) {
      requestPermission();
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [token, requestPermission, fetchNotifications]);

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

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}