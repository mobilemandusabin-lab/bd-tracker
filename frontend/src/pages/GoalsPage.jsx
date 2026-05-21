import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGoals, deleteGoal } from '../store/goalSlice';
import { Plus, Target, Calendar, TrendingUp, Users, Clock, Edit2, Trash2, CheckCircle, Search, X, Filter } from 'lucide-react';
import GoalModal from '../components/GoalModal';
import { cn } from '../utils/cn';

const GoalsPage = () => {
  const dispatch = useDispatch();
  const { items: goals, loading } = useSelector((state) => state.goals);
  const { user, token } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  useEffect(() => {
    dispatch(fetchGoals());
  }, [dispatch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        dispatch(fetchGoals());
      }
    };
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch]);

  const handleSuccess = () => {
    dispatch(fetchGoals());
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      dispatch(deleteGoal(id));
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-emerald-500';
    if (percentage >= 75) return 'bg-red-500';
    if (percentage >= 50) return 'bg-red-400';
    return 'bg-red-300';
  };

  const getProgressBg = (percentage) => {
    if (percentage >= 100) return 'bg-emerald-50';
    return 'bg-red-50';
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return 'bg-red-50 text-red-600 border-red-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'failed': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'paused': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const roleFilteredGoals = goals.filter(goal => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true;
    }
    return goal.assigned_to?._id === user?._id || goal.assigned_to === user?._id;
  });

  const filteredGoals = roleFilteredGoals.filter(goal => {
    if (statusFilter !== 'all' && goal.status !== statusFilter) return false;
    if (periodFilter !== 'all' && goal.period !== periodFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      goal.title?.toLowerCase().includes(q) ||
      goal.description?.toLowerCase().includes(q) ||
      goal.assigned_to?.name?.toLowerCase().includes(q) ||
      goal.unit?.toLowerCase().includes(q) ||
      goal.period?.toLowerCase().includes(q) ||
      goal.status?.toLowerCase().includes(q) ||
      goal.priority?.toLowerCase().includes(q)
    );
  });

  const canSetGoals = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <GoalModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        token={token}
        goal={editingGoal}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-600 rounded-full" />
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Target Management</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Monthly Goals</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(fetchGoals())}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-slate-100"
            title="Refresh goals"
          >
            <TrendingUp size={16} />
          </button>
          {canSetGoals && (
            <button
              onClick={() => { setEditingGoal(null); setIsModalOpen(true); }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus size={16} />
              <span>Set New Goal</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search goals..."
            style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
            className="w-full py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all font-medium text-sm text-slate-800"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ paddingLeft: '2rem', paddingRight: '1rem' }}
              className="py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Periods</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading goals...</p>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              {searchTerm ? <Search size={28} className="text-red-300" /> : <Target size={28} className="text-red-300" />}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {searchTerm ? 'No goals found' : 'No goals set yet'}
            </p>
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const currentValue = goal.currentValue ?? goal.current_value ?? 0;
            const progressPercentage = goal.progress ?? (goal.target_value > 0
              ? Math.min(100, Math.round((currentValue / goal.target_value) * 100))
              : 0);
            const isOwner = goal.set_by?._id === user?._id || goal.set_by === user?._id;

            return (
              <div key={goal._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                      <Target size={18} className="text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{goal.title}</h3>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {goal.period} · {goal.unit} · {goal.pipeline_stage !== 'all' ? goal.pipeline_stage : 'All Stages'}
                      </p>
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", getStatusBadge(goal.status))}>
                    {goal.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Progress</span>
                    <span className="text-sm font-bold text-slate-900">
                      {currentValue.toLocaleString()} / {goal.target_value.toLocaleString()}
                    </span>
                  </div>
                  <div className={cn("h-2 rounded-full overflow-hidden", getProgressBg(progressPercentage))}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getProgressColor(progressPercentage))}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-semibold text-slate-500">{progressPercentage}%</span>
                    <span className="text-[10px] font-semibold text-slate-400 capitalize">
                      {goal.priority} priority
                    </span>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Users size={12} className="text-slate-400" />
                    <span className="font-medium">
                      {user?.role === 'super_admin' || user?.role === 'admin'
                        ? `Assigned to: ${goal.assigned_to?.name || 'Unknown'}`
                        : `Assigned by: ${goal.set_by?.name || 'Unknown'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar size={12} className="text-slate-400" />
                    <span className="font-medium">
                      {formatDate(goal.start_date)} — {formatDate(goal.end_date)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {(isOwner || user?.role === 'super_admin') && goal.status === 'active' && (
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-50">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit goal"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal._id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete goal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GoalsPage;
