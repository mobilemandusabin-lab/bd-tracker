import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { fetchTasks, fetchAdminTasks, createTask, updateTask, deleteTask } from '../store/taskSlice';
import { Plus, ClipboardList, Clock, CheckCircle, AlertCircle, Trash2, Filter, X, Search } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL as BASE_URL } from '../config/api';

const TasksPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { tasks, error } = useSelector((state) => state.tasks);
  const { user, token } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const matchesSearch = (task) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      task.title?.toLowerCase().includes(q) ||
      task.description?.toLowerCase().includes(q) ||
      task.assigned_to?.name?.toLowerCase().includes(q) ||
      task.created_by?.name?.toLowerCase().includes(q)
    );
  };

  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t._id === taskId);
      if (task) {
        setSelectedTask(task);
        setShowDetailModal(true);
      }
    }
  }, [searchParams, tasks]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      dispatch(fetchAdminTasks(viewMode));
    } else {
      dispatch(fetchTasks());
    }
  }, [dispatch, user?.role, viewMode]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (user?.role === 'admin' || user?.role === 'super_admin') {
          dispatch(fetchAdminTasks(viewMode));
        } else {
          dispatch(fetchTasks());
        }
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch, user?.role, viewMode]);

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t._id === taskId);
    if (task) {
      await dispatch(updateTask({ id: taskId, status: newStatus, updated_at: task.updated_at }));
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        dispatch(fetchAdminTasks(viewMode));
      } else {
        dispatch(fetchTasks());
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await dispatch(deleteTask(id));
    }
  };

  const handleCreateTask = async (taskData) => {
    await dispatch(createTask(taskData));
    setIsModalOpen(false);
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      dispatch(fetchAdminTasks(viewMode));
    } else {
      dispatch(fetchTasks());
    }
  };

  const [dragOverColumn, setDragOverColumn] = useState(null);

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('taskId');
    const currentStatus = e.dataTransfer.getData('currentStatus');
    if (currentStatus !== newStatus) {
      await handleStatusChange(taskId, newStatus);
    }
  };

  const openTasks = tasks.filter(t => t.status === 'Open' && matchesSearch(t));
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress' && matchesSearch(t));
  const doneTasks = tasks.filter(t => t.status === 'Done' && matchesSearch(t));
  const isSearching = searchTerm.trim().length > 0;

  const canCreateTask = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateTask}
          userRole={user?.role}
          token={token}
        />
      )}

      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setShowDetailModal(false)}
          onDelete={handleDelete}
          canDelete={isAdmin || selectedTask.created_by?._id === user?._id}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Task Management</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (user?.role === 'admin' || user?.role === 'super_admin') {
                dispatch(fetchAdminTasks(viewMode));
              } else {
                dispatch(fetchTasks());
              }
            }}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-slate-100"
            title="Refresh tasks"
          >
            <Filter size={16} />
          </button>

          {isAdmin && (
            <div className="flex bg-white rounded-xl p-1 border border-slate-100">
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  viewMode === 'all' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All Tasks
              </button>
              <button
                onClick={() => setViewMode('my')}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  viewMode === 'my' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                My Tasks
              </button>
            </div>
          )}

          {canCreateTask && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus size={16} />
              <span>New Task</span>
            </button>
          )}
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
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400 group-focus-within:text-red-400 transition-colors" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tasks..."
          style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
          className="py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800 w-full"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Open Column */}
        <div
          className={cn(
            "bg-white rounded-2xl p-4 border border-slate-100 transition-all",
            dragOverColumn === 'Open' && "ring-2 ring-red-400 bg-red-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'Open')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'Open')}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
            <h2 className="font-bold text-slate-900 text-sm">Open</h2>
            <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
              {openTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {openTasks.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                canEdit={isAdmin || task.assigned_to?._id === user?._id}
                canDelete={isAdmin || task.created_by?._id === user?._id}
                onCardClick={(selectedTask) => {
                  setSelectedTask(selectedTask);
                  setShowDetailModal(true);
                }}
              />
            ))}
            {openTasks.length === 0 && (
              <div className="py-8 text-center">
                <ClipboardList size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">{isSearching ? 'No tasks found' : 'No open tasks'}</p>
              </div>
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div
          className={cn(
            "bg-white rounded-2xl p-4 border border-slate-100 transition-all",
            dragOverColumn === 'In Progress' && "ring-2 ring-red-400 bg-red-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'In Progress')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'In Progress')}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="w-2.5 h-2.5 bg-blue-400 rounded-full" />
            <h2 className="font-bold text-slate-900 text-sm">In Progress</h2>
            <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
              {inProgressTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {inProgressTasks.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                canEdit={isAdmin || task.assigned_to?._id === user?._id}
                canDelete={isAdmin || task.created_by?._id === user?._id}
                onCardClick={(selectedTask) => {
                  setSelectedTask(selectedTask);
                  setShowDetailModal(true);
                }}
              />
            ))}
            {inProgressTasks.length === 0 && (
              <div className="py-8 text-center">
                <Clock size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">{isSearching ? 'No tasks found' : 'No tasks in progress'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Done Column */}
        <div
          className={cn(
            "bg-white rounded-2xl p-4 border border-slate-100 transition-all",
            dragOverColumn === 'Done' && "ring-2 ring-red-400 bg-red-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'Done')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'Done')}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
            <h2 className="font-bold text-slate-900 text-sm">Done</h2>
            <span className="ml-auto text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
              {doneTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {doneTasks.map(task => (
              <TaskCard
                key={task._id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                canEdit={isAdmin || task.assigned_to?._id === user?._id}
                canDelete={isAdmin || task.created_by?._id === user?._id}
                onCardClick={(selectedTask) => {
                  setSelectedTask(selectedTask);
                  setShowDetailModal(true);
                }}
              />
            ))}
            {doneTasks.length === 0 && (
              <div className="py-8 text-center">
                <CheckCircle size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-400">{isSearching ? 'No tasks found' : 'No completed tasks'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, onStatusChange, onDelete, canEdit, canDelete, onCardClick }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 1: return { label: 'Critical', color: 'bg-red-100 text-red-700' };
      case 2: return { label: 'High', color: 'bg-orange-100 text-orange-700' };
      case 3: return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
      case 4: return { label: 'Low', color: 'bg-blue-100 text-blue-700' };
      case 5: return { label: 'Minimal', color: 'bg-slate-100 text-slate-600' };
      default: return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
    }
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  return (
    <div
      className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 hover:border-red-200 hover:shadow-sm transition-all relative cursor-pointer"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task._id);
        e.dataTransfer.setData('currentStatus', task.status);
        e.currentTarget.classList.add('opacity-50');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      onClick={() => onCardClick && onCardClick(task)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-md", getPriorityLabel(task.priority).color)}>
          {getPriorityLabel(task.priority).label}
        </span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1 hover:bg-white rounded-md transition-all"
          >
            <span className="text-slate-400 text-sm">···</span>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 py-1 min-w-[120px]">
              {canEdit && (
                <select
                  value={task.status}
                  onChange={(e) => { onStatusChange(task._id, e.target.value); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              )}
              {canDelete && (
                <button
                  onClick={() => { onDelete(task._id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <h3 className="font-bold text-slate-900 text-sm mb-1">{task.title}</h3>

      {task.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={cn("flex items-center gap-1 font-semibold", isOverdue ? 'text-red-600' : 'text-slate-400')}>
              <Clock size={10} />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {task.assigned_to && (
          <span className="text-slate-400 font-medium truncate max-w-[100px]">
            {task.assigned_to.name || task.assigned_to.email}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 md:hidden">
          <div className="grid grid-cols-3 gap-1.5">
            {task.status !== 'Open' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(task._id, 'Open'); }}
                className="px-2 py-1.5 text-[10px] font-bold uppercase bg-amber-50 text-amber-600 rounded-lg border border-amber-100"
              >
                Open
              </button>
            )}
            {task.status !== 'In Progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(task._id, 'In Progress'); }}
                className="px-2 py-1.5 text-[10px] font-bold uppercase bg-blue-50 text-blue-600 rounded-lg border border-blue-100"
              >
                Progress
              </button>
            )}
            {task.status !== 'Done' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(task._id, 'Done'); }}
                className="px-2 py-1.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Task Modal Component
const TaskModal = ({ isOpen, onClose, onSubmit, userRole, token }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 3,
    due_date: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/departments/users/for-task`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    if (isOpen && (userRole === 'admin' || userRole === 'super_admin')) {
      fetchUsers();
    }
  }, [isOpen, userRole, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || 'Failed to create task');
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
            <h2 className="text-lg font-bold text-slate-900">Create New Task</h2>
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          {(userRole === 'admin' || userRole === 'super_admin') && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign To *</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
                  required
                >
                  <option value="">Select user</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
                  >
                    <option value={1}>Critical</option>
                    <option value={2}>High</option>
                    <option value={3}>Medium</option>
                    <option value={4}>Low</option>
                    <option value={5}>Minimal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none text-sm"
                  />
                </div>
              </div>
            </>
          )}

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
              className="flex-1 px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Task Detail Modal Component
const TaskDetailModal = ({ task, onClose, onDelete, canDelete }) => {
  const getStatusBadge = (status) => {
    switch(status) {
      case 'Open': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'In Progress': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Done': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getPriorityLabel = (priority) => {
    switch(priority) {
      case 1: return { label: 'Critical', color: 'text-red-600' };
      case 2: return { label: 'High', color: 'text-orange-600' };
      case 3: return { label: 'Medium', color: 'text-amber-600' };
      case 4: return { label: 'Low', color: 'text-blue-600' };
      case 5: return { label: 'Minimal', color: 'text-slate-600' };
      default: return { label: 'Medium', color: 'text-amber-600' };
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Task Details</h2>
            <div className="flex items-center gap-1.5">
              {canDelete && (
                <button onClick={() => onDelete(task._id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <div className="mt-1">
              <span className={cn("inline-block px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg border", getStatusBadge(task.status))}>
                {task.status}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</label>
            <p className="text-slate-900 font-bold text-sm mt-1">{task.title}</p>
          </div>

          {task.description && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
              <p className="text-slate-700 text-sm mt-1 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
              <p className={cn("font-bold text-sm mt-1", getPriorityLabel(task.priority).color)}>
                {getPriorityLabel(task.priority).label}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
              <p className={cn("font-medium text-sm mt-1", isOverdue ? 'text-red-600' : 'text-slate-700')}>
                {isOverdue && 'Overdue — '}{formatDate(task.due_date)}
              </p>
            </div>
          </div>

          {task.assigned_to && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</label>
              <p className="text-slate-700 text-sm mt-1">{task.assigned_to.name || task.assigned_to.email}</p>
            </div>
          )}

          {task.created_by && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</label>
              <p className="text-slate-700 text-sm mt-1">{task.created_by.name || task.created_by.email}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created</label>
              <p className="text-slate-700 text-sm mt-1">{formatDate(task.created_at)}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Updated</label>
              <p className="text-slate-700 text-sm mt-1">{formatDate(task.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
