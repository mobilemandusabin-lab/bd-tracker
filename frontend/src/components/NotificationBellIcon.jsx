import { useState, useRef, useEffect } from 'react';
import { Bell, Check, BellOff, Clock, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '../utils/cn';
import { useNotifications } from './NotificationPoller';

export default function NotificationBellIcon() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <BellOff size={20} className="text-slate-200" />
                <p className="text-xs font-bold text-slate-400 uppercase">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div key={n._id}
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
}