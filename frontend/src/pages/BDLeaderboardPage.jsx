import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Trophy, Medal, Star, TrendingUp, Phone, CheckCircle, Target, ArrowLeft } from 'lucide-react';
import { API_URL } from '../config/api';

const BadgeIcon = ({ badge, size = 16 }) => {
  const badgeMap = {
    '🏆': <Trophy size={size} className="text-yellow-500" />,
    '⚡': <Star size={size} className="text-yellow-400" />,
    '📞': <Phone size={size} className="text-blue-500" />,
    '🎯': <Target size={size} className="text-green-500" />,
    '🌟': <Star size={size} className="text-purple-500" />,
    '💎': <Medal size={size} className="text-indigo-500" />
  };
  
  return badgeMap[badge] || <span className="text-xl sm:text-2xl">{badge}</span>;
};

const BDLeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [error, setError] = useState(null);
  const token = useSelector((state) => state.auth.token);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/dashboard/bd-leaderboard?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLeaderboard(res.data.data.leaderboard);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [period, token]);

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="text-2xl sm:text-3xl">🥇</span>;
    if (rank === 2) return <span className="text-xl sm:text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-xl sm:text-2xl">🥉</span>;
    return <span className="text-base sm:text-lg font-black text-slate-400">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-2 sm:p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Link 
            to="/dashboard" 
            className="p-1.5 sm:p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-slate-600"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tight">
              BD Leaderboard
            </h1>
            <p className="text-[8px] sm:text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">
              Performance Scorecard & Badges
            </p>
          </div>
        </div>

        {/* Period Selector */}
<div className="flex flex-wrap gap-2">
           {['week', 'month', 'quarter', 'year'].map((p) => (
             <button
               key={p}
               onClick={() => setPeriod(p)}
               className={`px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all sm:px-4 sm:py-2 sm:text-[10px]
                 ${period === p 
                   ? 'bg-red-600 text-white shadow-sm' 
                   : 'bg-white text-slate-600 hover:bg-slate-100'
                 }`}
             >
               {p}
             </button>
           ))}
         </div>
      </div>

{/* Leaderboard Content */}
       <div className="max-w-7xl mx-auto">
         {loading ? (
           <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-12 text-center">
             <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4" />
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
               Loading Leaderboard...
             </p>
           </div>
         ) : error ? (
           <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-12 text-center">
             <p className="text-red-600 font-bold text-xs sm:text-sm">{error}</p>
           </div>
         ) : leaderboard.length === 0 ? (
           <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-12 text-center">
             <Trophy size={36} className="text-slate-200 mx-auto mb-3 sm:mb-4 sm:w-12 sm:h-12" />
             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
               No Data Available for This Period
             </p>
           </div>
         ) : (
           <div className="space-y-3 sm:space-y-4">
            {leaderboard.map((item) => (
<div 
                 key={item._id} 
                 className={`bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md
                   ${item.rank === 1 ? 'border-yellow-200 bg-gradient-to-r from-yellow-50/50' : 
                    item.rank === 2 ? 'border-slate-200 bg-gradient-to-r from-slate-50/50' :
                    item.rank === 3 ? 'border-amber-200 bg-gradient-to-r from-amber-50/50' :
                    'border-slate-100'
                   }`}
               >
                 <div className="p-3 sm:p-6">
                   <div className="flex items-center justify-between mb-3 sm:mb-4">
                     <div className="flex items-center gap-2 sm:gap-4">
                       <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center">
                         {getRankBadge(item.rank)}
                       </div>
                       <div>
                         <h3 className="text-sm sm:text-lg font-black text-slate-900">{item.user?.name || 'Unknown'}</h3>
                         <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {item.user?.email || 'No email'}
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className="text-xl sm:text-2xl font-black text-red-600">
                         {item.overall_score?.toFixed(1) || 0}
                         <span className="text-xs sm:text-sm text-slate-400 ml-1">pts</span>
                       </div>
                       <div className="flex gap-1 mt-1 justify-end">
                         {item.badges?.map((badge, idx) => (
                           <div 
                             key={idx}
                             title={badge.title}
                             className="group relative"
                           >
                             <BadgeIcon badge={badge.emoji} size={16} />
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 sm:mb-2 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-900 text-white text-[7px] sm:text-[8px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                               {badge.title}
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>

{/* Stats Grid */}
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
                     <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3">
                       <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Assigned</p>
                       <p className="text-base sm:text-lg font-black text-slate-900">{item.total_assigned || 0}</p>
                     </div>
                     <div className="bg-green-50 rounded-xl p-2.5 sm:p-3">
                       <p className="text-[7px] sm:text-[8px] font-black text-green-600 uppercase tracking-widest mb-0.5 sm:mb-1">Converted</p>
                       <p className="text-base sm:text-lg font-black text-green-700">{item.converted || 0}</p>
                     </div>
                     <div className="bg-blue-50 rounded-xl p-2.5 sm:p-3">
                       <p className="text-[7px] sm:text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5 sm:mb-1">Conv. Rate</p>
                       <p className="text-base sm:text-lg font-black text-blue-700">{item.conversion_rate?.toFixed(1) || 0}%</p>
                     </div>
                     <div className="bg-purple-50 rounded-xl p-2.5 sm:p-3">
                       <p className="text-[7px] sm:text-[8px] font-black text-purple-600 uppercase tracking-widest mb-0.5 sm:mb-1">Avg. Days</p>
                       <p className="text-base sm:text-lg font-black text-purple-700">{item.avg_conversion_days?.toFixed(1) || 'N/A'}</p>
                     </div>
                   </div>

{/* Secondary Stats */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[8px] sm:text-[10px] font-bold text-slate-500">
                      <div className="flex items-center gap-1">
                        <Phone size={10} />
                        <span>{item.total_calls || 0} calls</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle size={10} />
                        <span>{item.completed_tasks || 0} tasks done</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={10} />
                        <span>Lead Score: {item.avg_lead_score?.toFixed(1) || 0}</span>
                      </div>
                    </div>

{/* Progress Bar */}
                   <div className="mt-3 sm:mt-4">
                     <div className="h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          item.overall_score >= 80 ? 'bg-green-500' :
                          item.overall_score >= 60 ? 'bg-yellow-500' :
                          item.overall_score >= 40 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(item.overall_score, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

{/* Legend */}
       <div className="max-w-7xl mx-auto mt-6 sm:mt-8 bg-white rounded-2xl shadow-sm p-4 sm:p-6">
         <h3 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Badge Legend</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          {[
            { emoji: '🏆', title: 'Top Converter', desc: 'Highest overall score' },
            { emoji: '⚡', title: 'Fast Responder', desc: 'Avg conversion < 7 days' },
            { emoji: '📞', title: 'Call Master', desc: '50+ calls in period' },
            { emoji: '🎯', title: 'Target Hunter', desc: '50%+ conversion rate' },
            { emoji: '🌟', title: 'Rising Star', desc: 'High score, low leads' },
            { emoji: '💎', title: 'Quality Master', desc: '70+ avg lead score' }
          ].map((badge, idx) => (
<div key={idx} className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3 bg-slate-50 rounded-xl">
               <span className="text-xl sm:text-2xl">{badge.emoji}</span>
               <div>
                 <p className="text-[10px] sm:text-xs font-black text-slate-900">{badge.title}</p>
                 <p className="text-[8px] sm:text-[9px] text-slate-500">{badge.desc}</p>
               </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BDLeaderboardPage;
