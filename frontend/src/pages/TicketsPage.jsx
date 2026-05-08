import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { fetchTickets, fetchAdmins, createTicket, updateTicket, deleteTicket } from '../store/ticketSlice';
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle, Trash2, X, Send } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL as BASE_URL } from '../config/api';

const TicketsPage = () => {
  const dispatch = useDispatch();
  const { tickets, admins, loading, error } = useSelector((state) => state.tickets);
  const { user, token } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      dispatch(fetchTickets());
      dispatch(fetchAdmins());
    }
  }, [dispatch, user?.role]);

  const handleCreateTicket = async (ticketData) => {
    await dispatch(createTicket(ticketData));
    setIsModalOpen(false);
    dispatch(fetchTickets());
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    await dispatch(updateTicket({ id: ticketId, status: newStatus }));
    dispatch(fetchTickets());
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      await dispatch(deleteTicket(id));
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'open': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'in_progress': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'resolved': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'closed': return 'bg-slate-50 text-slate-600 border-slate-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter out current user from admins list
  const availableAdmins = admins.filter(admin => admin._id !== user?._id);

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      {isModalOpen && (
        <TicketModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateTicket}
          admins={availableAdmins}
          currentUserId={user?._id}
        />
      )}
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-purple-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-purple-600 uppercase tracking-[0.2em]">Cross-Department Communication</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Tickets</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => dispatch(fetchTickets())}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Refresh tickets"
          >
            <MessageSquare size={18} />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-purple-100 transition-all active:scale-95 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-rose-600" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      )}

      {/* Tickets List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
            <MessageSquare size={48} className="text-slate-200" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No tickets yet</p>
            <p className="text-xs text-slate-400">Create a ticket to communicate with other admins</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket._id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">{ticket.subject}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                </div>
                <span className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", getStatusBadge(ticket.status))}>
                  {ticket.status?.replace('_', ' ')}
                </span>
              </div>
              
              {ticket.description && (
                <p className="text-xs text-slate-500 mb-4">{ticket.description}</p>
              )}
              
              <div className="flex items-center justify-between text-[10px] border-t border-slate-50 pt-4">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    From: {ticket.from_user?.name || ticket.from_user?.email || 'Unknown'}
                  </span>
                  <span className="text-slate-400">
                    To: {ticket.to_user?.name || ticket.to_user?.email || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                    className="text-[9px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2 py-1 border-none outline-none cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  
                  {(ticket.from_user?._id === user?._id || user?.role === 'super_admin') && (
                    <button
                      onClick={() => handleDelete(ticket._id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Ticket Modal Component
const TicketModal = ({ isOpen, onClose, onSubmit, admins, currentUserId }) => {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    to_admin_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await onSubmit(formData);
      setFormData({ subject: '', description: '', to_admin_id: '' });
    } catch (err) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Create New Ticket</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Subject *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
              placeholder="Enter ticket subject"
              required
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
              placeholder="Describe the issue or request"
              rows={4}
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
              Send to Admin *
            </label>
            <select
              value={formData.to_admin_id}
              onChange={(e) => setFormData({ ...formData, to_admin_id: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
              required
            >
              <option value="">Select admin</option>
              {admins.map(admin => (
                <option key={admin._id} value={admin._id}>
                  {admin.name} ({admin.email})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50"
            >
              <Send size={16} />
              {loading ? 'Sending...' : 'Send Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketsPage;
