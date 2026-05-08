import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGoals, deleteGoal } from '../store/goalSlice';
import { Plus, Target, Calendar, TrendingUp, Users, Clock, Edit2, Trash2, CheckCircle } from 'lucide-react';
import GoalModal from '../components/GoalModal';
import { cn } from '../utils/cn';

const GoalsPage = () => {
  const dispatch = useDispatch();
  const { items: goals, loading } = useSelector((state) => state.goals);
  const { user, token } = useSelector((state) => state.auth);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchGoals());
  }, [dispatch]);

  // Auto-refresh goals when window gains focus to show latest progress
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

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-emerald-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getProgressBg = (percentage) => {
    if (percentage >= 100) return 'bg-emerald-100';
    if (percentage >= 75) return 'bg-blue-100';
    if (percentage >= 50) return 'bg-amber-100';
    return 'bg-red-100';
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'failed': return 'bg-rose-50 text-rose-600 border-rose-100';
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

  // Filter goals based on user role
  const filteredGoals = goals.filter(goal => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return true; // Show all goals
    }
    // For regular users, show their own goals
    return goal.assigned_to?._id === user?._id || goal.assigned_to === user?._id;
  });

  const canSetGoals = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div className="space-y-4 lg:space-y-8 max-w-[1600px] mx-auto">
      <GoalModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleSuccess} 
        token={token} 
      />
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1 lg:mb-2">
            <div className="h-1 w-6 lg:w-8 bg-red-600 rounded-full" />
            <span className="text-[8px] lg:text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Target Management</span>
          </div>
          <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight">Monthly Goals</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => dispatch(fetchGoals())}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
            title="Refresh goals"
          >
            <TrendingUp size={18} />
          </button>
          {canSetGoals && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 lg:px-8 py-3 lg:py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs uppercase tracking-widest shadow-xl shadow-red-100 transition-all active:scale-95 w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>Set New Goal</span>
            </button>
          )}
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading goals...</p>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-100">
            <Target size={48} className="text-slate-200" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No goals set yet</p>
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const progressPercentage = goal.target_value > 0 
              ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
              : 0;
            const isOwner = goal.set_by?._id === user?._id || goal.set_by === user?._id;

            return (
              <div key={goal._id} className="bg-white p-6 lg:p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                      <Target size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm lg:text-base">{goal.title}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {goal.period} • {goal.unit} • Target: {goal.pipeline_stage !== 'all' ? goal.pipeline_stage : 'All Pipeline Stages'}
                      </p>
                    </div>
                  </div>
                  <span className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", getStatusBadge(goal.status))}>
                    {goal.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Progress</span>
                    <span className="text-sm font-black text-slate-900">
                      {goal.current_value} / {goal.target_value}
                    </span>
                  </div>
                  <div className={cn("h-3 rounded-full overflow-hidden", getProgressBg(progressPercentage))}>
                    <div 
                      className={cn("h-full rounded-full transition-all duration-500", getProgressColor(progressPercentage))}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] font-bold text-slate-500">{progressPercentage}% complete</span>
                    <span className="text-[9px] font-bold text-slate-400">
                      Priority: {goal.priority}
                    </span>
                  </div>
                </div>



                {/* Meta Info */}
                <div className="space-y-3 text-[10px]">
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-slate-400" />
                    <span className="font-bold text-slate-500">
                      {user?.role === 'super_admin' || user?.role === 'admin' 
                        ? `Assigned to: ${goal.assigned_to?.name || 'Unknown'}`
                        : `Assigned by: ${goal.set_by?.name || 'Unknown'}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-slate-400" />
                    <span className="font-bold text-slate-500">
                      {formatDate(goal.start_date)} - {formatDate(goal.end_date)}
                    </span>
                  </div>
                </div>

                {/* Actions for goal owners */}
                {(isOwner || user?.role === 'super_admin') && goal.status === 'active' && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => handleDelete(goal._id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
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