import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { fetchTasks, fetchAdminTasks, createTask, updateTask, deleteTask } from '../store/taskSlice';
import { Plus, ClipboardList, Clock, CheckCircle, AlertCircle, Trash2, Filter, X } from 'lucide-react';
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

  // Handle taskId query param - open detail modal for the task
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

  // Auto-refresh tasks when window gains focus
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
      // Refresh tasks
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
    // Refresh tasks
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      dispatch(fetchAdminTasks(viewMode));
    } else {
      dispatch(fetchTasks());
    }
  };

  // Drag and drop state
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Drag and drop handlers
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

  // Group tasks by status for Kanban view
  const openTasks = tasks.filter(t => t.status === 'Open');
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
  const doneTasks = tasks.filter(t => t.status === 'Done');

  const canCreateTask = user?.role === 'admin' || user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      {/* Task Create Modal */}
      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateTask}
          userRole={user?.role}
          token={token}
        />
      )}
      
      {/* Task Detail Modal */}
      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setShowDetailModal(false)}
          onDelete={handleDelete}
          canDelete={isAdmin || selectedTask.created_by?._id === user?._id}
        />
      )}
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-indigo-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Task Management</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Tasks</h1>
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
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Refresh tasks"
          >
            <Filter size={18} />
          </button>
          
          {/* Admin view toggle */}
          {isAdmin && (
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                  viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                All Tasks
              </button>
              <button
                onClick={() => setViewMode('my')}
                className={cn(
                  "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                  viewMode === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                My Tasks
              </button>
            </div>
          )}
          
          {canCreateTask && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-rose-600" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {/* Open Column */}
        <div 
          className={cn(
            "bg-slate-50 rounded-2xl p-4 lg:p-6 transition-all",
            dragOverColumn === 'Open' && "ring-2 ring-indigo-500 bg-indigo-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'Open')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'Open')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <h2 className="font-black text-slate-900 text-sm">Open</h2>
            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg">
              {openTasks.length}
            </span>
          </div>
          <div className="space-y-3">
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
                <ClipboardList size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No open tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div 
          className={cn(
            "bg-slate-50 rounded-2xl p-4 lg:p-6 transition-all",
            dragOverColumn === 'In Progress' && "ring-2 ring-indigo-500 bg-indigo-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'In Progress')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'In Progress')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <h2 className="font-black text-slate-900 text-sm">In Progress</h2>
            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg">
              {inProgressTasks.length}
            </span>
          </div>
          <div className="space-y-3">
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
                <Clock size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No tasks in progress</p>
              </div>
            )}
          </div>
        </div>

        {/* Done Column */}
        <div 
          className={cn(
            "bg-slate-50 rounded-2xl p-4 lg:p-6 transition-all",
            dragOverColumn === 'Done' && "ring-2 ring-indigo-500 bg-indigo-50/30"
          )}
          onDragOver={(e) => handleDragOver(e, 'Done')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'Done')}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            <h2 className="font-black text-slate-900 text-sm">Done</h2>
            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg">
              {doneTasks.length}
            </span>
          </div>
          <div className="space-y-3">
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
                <CheckCircle size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No completed tasks</p>
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
      case 1: return { label: 'Critical', color: 'bg-rose-100 text-rose-700' };
      case 2: return { label: 'High', color: 'bg-orange-100 text-orange-700' };
      case 3: return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
      case 4: return { label: 'Low', color: 'bg-blue-100 text-blue-700' };
      case 5: return { label: 'Minimal', color: 'bg-slate-100 text-slate-700' };
      default: return { label: 'Medium', color: 'bg-amber-100 text-amber-700' };
    }
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  return (
    <div 
      className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative active:scale-95"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task._id);
        e.dataTransfer.setData('currentStatus', task.status);
        e.currentTarget.classList.add('opacity-50');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      onClick={() => onCardClick && onCardClick(task)}
    >
      {/* Priority Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded", getPriorityLabel(task.priority).color)}>
          {getPriorityLabel(task.priority).label}
        </span>
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-slate-50 rounded-lg transition-all"
          >
            <span className="text-slate-400">⋮</span>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-100 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
              {canEdit && (
                <select
                  value={task.status}
                  onChange={(e) => {
                    onStatusChange(task._id, e.target.value);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    onDelete(task._id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-bold text-slate-900 text-sm mb-1">{task.title}</h3>
      
      {/* Description */}
      {task.description && (
        <p className="text-[10px] text-slate-500 mb-3 line-clamp-2">{task.description}</p>
      )}
      
      {/* Meta Info */}
      <div className="flex items-center justify-between text-[9px]">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={cn("flex items-center gap-1 font-medium", isOverdue ? 'text-rose-600' : 'text-slate-400')}>
              <Clock size={10} />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {task.assigned_to && (
          <span className="text-slate-400">
            Assigned: {task.assigned_to.name || task.assigned_to.email}
          </span>
        )}
      </div>
      
      {/* Mobile Status Change Buttons */}
      {canEdit && (
        <div className="mt-3 pt-3 border-t border-slate-100 md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {task.status !== 'Open' && (
              <button
                onClick={() => onStatusChange(task._id, 'Open')}
                className="px-2 py-1.5 text-[10px] font-black uppercase bg-amber-50 text-amber-600 rounded-lg border border-amber-100"
              >
                Open
              </button>
            )}
            {task.status !== 'In Progress' && (
              <button
                onClick={() => onStatusChange(task._id, 'In Progress')}
                className="px-2 py-1.5 text-[10px] font-black uppercase bg-blue-50 text-blue-600 rounded-lg border border-blue-100"
              >
                Progress
              </button>
            )}
            {task.status !== 'Done' && (
              <button
                onClick={() => onStatusChange(task._id, 'Done')}
                className="px-2 py-1.5 text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100"
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
    // Fetch users for assignment
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Create New Task</h2>
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
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
              placeholder="Enter task title"
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
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
              placeholder="Enter task description"
              rows={3}
            />
          </div>
          
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Assign To *
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  required
                >
                  <option value="">Select user</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  >
                    <option value={1}>Critical</option>
                    <option value={2}>High</option>
                    <option value={3}>Medium</option>
                    <option value={4}>Low</option>
                    <option value={5}>Minimal</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  />
                </div>
              </div>
            </>
          )}
          
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
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
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
      case 1: return { label: 'Critical', color: 'text-rose-600' };
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
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-xs sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900">Task Details</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {canDelete && (
                <button 
                  onClick={() => onDelete(task._id)}
                  className="p-1.5 sm:p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-50 rounded-lg">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div>
            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
            <div className="mt-1">
              <span className={cn("inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-xs font-black uppercase rounded-md sm:rounded-lg border", getStatusBadge(task.status))}>
                {task.status}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Title</label>
            <p className="text-slate-900 font-bold text-sm sm:text-base mt-1">{task.title}</p>
          </div>

          {task.description && (
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
              <p className="text-slate-700 text-xs sm:text-sm mt-1 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</label>
              <p className={cn("font-bold text-xs sm:text-sm mt-1", getPriorityLabel(task.priority).color)}>
                {getPriorityLabel(task.priority).label}
              </p>
            </div>
            
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
              <p className={cn("font-medium text-xs sm:text-sm mt-1", isOverdue ? 'text-rose-600' : 'text-slate-700')}>
                {isOverdue && 'Overdue - '}{formatDate(task.due_date)}
              </p>
            </div>
          </div>

          {task.assigned_to && (
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Assigned To</label>
              <p className="text-slate-700 text-xs sm:text-sm mt-1">{task.assigned_to.name || task.assigned_to.email}</p>
            </div>
          )}

          {task.created_by && (
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Created By</label>
              <p className="text-slate-700 text-xs sm:text-sm mt-1">{task.created_by.name || task.created_by.email}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Created</label>
              <p className="text-slate-700 text-xs sm:text-sm mt-1">{formatDate(task.created_at)}</p>
            </div>
            
            <div>
              <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Updated</label>
              <p className="text-slate-700 text-xs sm:text-sm mt-1">{formatDate(task.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
