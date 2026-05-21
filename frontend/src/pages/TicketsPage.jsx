import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { fetchTickets, fetchAdmins, createTicket, updateTicket, deleteTicket } from '../store/ticketSlice';
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle, Trash2, X, Send, Search } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL as BASE_URL } from '../config/api';

const TicketsPage = () => {
  const dispatch = useDispatch();
  const { tickets, admins, loading, error } = useSelector((state) => state.tickets);
  const { user, token } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const availableAdmins = admins.filter(admin => admin._id !== user?._id);

  const filteredTickets = tickets.filter((ticket) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      ticket.subject?.toLowerCase().includes(term) ||
      ticket.description?.toLowerCase().includes(term) ||
      ticket.from_user?.name?.toLowerCase().includes(term) ||
      ticket.to_user?.name?.toLowerCase().includes(term) ||
      ticket.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Cross-Department Communication</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Tickets</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(fetchTickets())}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-slate-100"
            title="Refresh tickets"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus size={16} />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500" />
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative group">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tickets..."
          style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
          className="py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800 w-full"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <MessageSquare size={28} className="text-red-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No tickets yet</p>
            <p className="text-xs text-slate-400">Create a ticket to communicate with other admins</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <MessageSquare size={28} className="text-red-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No tickets found</p>
            <p className="text-xs text-slate-400">Try a different search term</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div key={ticket._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <MessageSquare size={18} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{ticket.subject}</h3>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                </div>
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", getStatusBadge(ticket.status))}>
                  {ticket.status?.replace('_', ' ')}
                </span>
              </div>

              {ticket.description && (
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">{ticket.description}</p>
              )}

              <div className="flex items-center justify-between text-[10px] border-t border-slate-50 pt-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-medium">
                    From: <span className="text-slate-600">{ticket.from_user?.name || 'Unknown'}</span>
                  </span>
                  <span className="text-slate-400 font-medium">
                    To: <span className="text-slate-600">{ticket.to_user?.name || 'Unknown'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                    className="text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 outline-none cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  {(ticket.from_user?._id === user?._id || user?.role === 'super_admin') && (
                    <button
                      onClick={() => handleDelete(ticket._id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Create New Ticket</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
              placeholder="Enter ticket subject"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
              placeholder="Describe the issue or request"
              rows={4}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Send to Admin *</label>
            <select
              value={formData.to_admin_id}
              onChange={(e) => setFormData({ ...formData, to_admin_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
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

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
            >
              <Send size={14} />
              {loading ? 'Sending...' : 'Send Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketsPage;
