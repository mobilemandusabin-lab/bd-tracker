import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Trophy, ChevronDown, ChevronUp, ArrowRight, CheckCircle2
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Sector, Tooltip
} from 'recharts';
import { API_URL } from '../config/api';

const TIERS = [
  {
    id: 'rookie', name: 'Rookie', icon: '🌱',
    min: 0, max: 999,
    color: 'slate',
    targets: { leads: 10, activations: 3, convRate: '20%', activities: 30, followups: 8 },
    perks: [
      'Basic CRM access & lead dashboard',
      'Weekly 1:1 with team lead',
      'Access to sales playbook & templates',
      'Standard lead assignment priority'
    ]
  },
  {
    id: 'riser', name: 'Riser', icon: '📈',
    min: 1000, max: 2499,
    color: 'blue',
    targets: { leads: 25, activations: 8, convRate: '30%', activities: 60, followups: 18 },
    perks: [
      'Priority lead assignment (1.5x volume)',
      'Monthly team spotlight recognition',
      'Access to premium vendor leads pool',
      'Eligible for quarterly bonus program'
    ]
  },
  {
    id: 'hunter', name: 'Hunter', icon: '⚡',
    min: 2500, max: 4999,
    color: 'emerald',
    targets: { leads: 40, activations: 15, convRate: '40%', activities: 100, followups: 30 },
    perks: [
      'Premium lead assignment (2x volume)',
      'Direct access to enterprise vendor leads',
      'Monthly performance bonus eligibility',
      'Featured in company leaderboard'
    ]
  },
  {
    id: 'ace', name: 'Ace', icon: '🏆',
    min: 5000, max: 8999,
    color: 'amber',
    targets: { leads: 55, activations: 25, convRate: '50%', activities: 140, followups: 40 },
    perks: [
      'Top-tier lead allocation (3x volume)',
      'VIP vendor relationship management',
      'Quarterly strategy meeting invite',
      'Mentorship role for Rookie & Riser BDs'
    ]
  },
  {
    id: 'elite', name: 'Elite', icon: '👑',
    min: 9000, max: Infinity,
    color: 'violet',
    targets: { leads: 70, activations: 40, convRate: '60%', activities: 180, followups: 50 },
    perks: [
      'Unlimited premium lead access',
      'Named account ownership on top vendors',
      'Annual strategy offsite participation',
      'Revenue share on top-performing accounts'
    ]
  }
];

const colorMap = {
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', light: 'bg-slate-100', fill: 'bg-slate-500', hex: '#64748b' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', light: 'bg-blue-100', fill: 'bg-blue-500', hex: '#3b82f6' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', light: 'bg-emerald-100', fill: 'bg-emerald-500', hex: '#10b981' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', light: 'bg-amber-100', fill: 'bg-amber-500', hex: '#f59e0b' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', light: 'bg-violet-100', fill: 'bg-violet-500', hex: '#8b5cf6' },
};

const POINTS = { lead: 5, activity: 3, activation: 40, revenue: 8, followup: 5, streak: 75, bonus35: 40, bonus50: 80 };

const formatNum = (n) => (n || 0).toLocaleString('en-IN');
const formatMoney = (n) => 'Rs. ' + (n || 0).toLocaleString('en-IN');

const periods = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

/* ========================================
   Active Shape — expands on hover with outer ring
   ======================================== */
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 6}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.25))', transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 18}
        outerRadius={outerRadius + 22}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
        style={{ transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      />
    </g>
  );
};

/* ========================================
   Custom Tooltip — shows full details + breakdown on hover
   ======================================== */
const TierTooltip = ({ active, payload, breakdown }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = (payload[0].percent * 100).toFixed(1);

  return (
    <div className="bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-slate-700 min-w-[240px]">
      <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-700">
        <span className="text-2xl">{d.icon}</span>
        <div>
          <p className="font-bold text-sm">{d.tierName}</p>
          <p className="text-[10px] text-slate-400">{d.isCurrent ? 'Current tier' : d.isPast ? 'Completed' : d.isRemaining ? 'Remaining' : 'Upcoming'}</p>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-8">
          <span className="text-slate-400">Points range</span>
          <span className="font-bold tabular-nums">{formatNum(d.min)} — {d.maxStr}</span>
        </div>
        {d.isCurrent && (
          <>
            <div className="flex justify-between gap-8">
              <span className="text-slate-400">Your score</span>
              <span className="font-bold text-white tabular-nums">{formatNum(d.earnedPts)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-slate-400">Earned in tier</span>
              <span className="font-bold text-emerald-400 tabular-nums">{formatNum(d.earnedInTier)} pts</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-slate-400">Remaining</span>
              <span className="font-bold text-amber-400 tabular-nums">{formatNum(d.remainingPts)} pts</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-slate-400">Progress</span>
              <span className="font-bold">{d.progressPct}%</span>
            </div>
          </>
        )}
        {d.isRemaining && (
          <div className="flex justify-between gap-8">
            <span className="text-slate-400">Points to next tier</span>
            <span className="font-bold text-amber-400 tabular-nums">{formatNum(d.value)} pts</span>
          </div>
        )}
        <div className="flex justify-between gap-8 pt-1 border-t border-slate-700">
          <span className="text-slate-400">Share</span>
          <span className="font-bold">{pct}%</span>
        </div>
      </div>

      {/* Breakdown details on hover */}
      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Score Breakdown</p>
          {breakdown.map(b => (
            <div key={b.label} className="flex justify-between items-center gap-6 text-xs">
              <span className="text-slate-400">{b.icon} {b.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 tabular-nums">{typeof b.count === 'string' ? b.count : formatNum(b.count)}</span>
                <span className="font-bold text-white tabular-nums">{formatNum(b.pts)} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BDTierPage = () => {
  const { token, user } = useSelector((state) => state.auth);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTier, setExpandedTier] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    axios.get(`${API_URL}/dashboard/bd-tiers?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, period]);

  const tierSummary = data?.tierSummary || [];
  const bdScores = data?.tiers || [];
  const myScore = bdScores.find(b => b.user_id === user?._id);

  const toggleTier = (id) => setExpandedTier(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleUser = (id) => setExpandedUser(prev => prev === id ? null : id);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">BD Tier & Score</h1>
          <p className="text-sm text-slate-500 mt-1">Live performance rankings from BD Tracker data</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* My Score Pie Chart */}
      {myScore && <MyScoreCard score={myScore} />}

      {/* Tier Distribution */}
      <div className="grid grid-cols-5 gap-2">
        {TIERS.map(tier => {
          const tc = colorMap[tier.color];
          const count = tierSummary.find(s => s.id === tier.id)?.count || 0;
          return (
            <div key={tier.id} className={`${tc.bg} rounded-xl p-3 text-center border ${tc.border}`}>
              <div className="text-xl mb-1">{tier.icon}</div>
              <div className={`text-lg font-black ${tc.text}`}>{count}</div>
              <div className="text-[10px] font-semibold text-slate-400">{tier.name}</div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Leaderboard</h2>
            <p className="text-xs text-slate-400">{bdScores.length} BDs ranked</p>
          </div>
          <Trophy size={18} className="text-amber-400" />
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-400 mt-2">Loading scores...</p>
          </div>
        ) : bdScores.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">No data for this period</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {bdScores.map((bd, idx) => (
              <LeaderboardRow
                key={bd.user_id}
                bd={bd}
                rank={idx + 1}
                isMe={bd.user_id === user?._id}
                isExpanded={expandedUser === bd.user_id}
                onToggle={() => toggleUser(bd.user_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tier Info Cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Tier Requirements & Perks</h3>
        {TIERS.map(tier => {
          const tc = colorMap[tier.color];
          const isOpen = expandedTier[tier.id];
          return (
            <div key={tier.id} className={`rounded-xl border overflow-hidden transition-colors ${isOpen ? tc.border : 'border-slate-100'}`}>
              <button
                onClick={() => toggleTier(tier.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isOpen ? tc.bg : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="text-xl">{tier.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-bold ${tc.text}`}>{tier.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{formatNum(tier.min)} — {tier.max === Infinity ? '9,999+' : formatNum(tier.max)} pts</span>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2">Monthly Targets</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { val: tier.targets.leads, label: 'Leads' },
                        { val: tier.targets.activations, label: 'Activations' },
                        { val: tier.targets.convRate, label: 'Conv. Rate' },
                        { val: tier.targets.activities, label: 'Activities' },
                        { val: tier.targets.followups, label: 'Follow-ups' },
                      ].map(t => (
                        <div key={t.label} className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-sm font-extrabold text-slate-900">{t.val}</div>
                          <div className="text-[10px] text-slate-400">{t.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2">Points per Action</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { label: 'Lead assigned', val: `+${POINTS.lead}` },
                        { label: 'Activity logged', val: `+${POINTS.activity}` },
                        { label: 'Lead activated', val: `+${POINTS.activation}` },
                        { label: 'Revenue per ₹1L', val: `+${POINTS.revenue}` },
                        { label: 'Follow-up on time', val: `+${POINTS.followup}` },
                        { label: 'Monthly streak', val: `+${POINTS.streak}` },
                        { label: 'Conv. rate > 35%', val: `+${POINTS.bonus35}` },
                        { label: 'Conv. rate > 50%', val: `+${POINTS.bonus50}` },
                      ].map(p => (
                        <div key={p.label} className="flex justify-between items-center px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                          <span className="text-slate-500">{p.label}</span>
                          <span className={`font-bold ${tc.text}`}>{p.val} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2">Perks & Rewards</p>
                    <div className="space-y-1">
                      {tier.perks.map(perk => (
                        <div key={perk} className="flex items-start gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-500">
                          <CheckCircle2 size={12} className={`${tc.text} mt-0.5 flex-shrink-0`} />
                          <span>{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ========================================
   My Score Card — Animated Tier Progress Pie
   Colors grow from 0, hover expands segment + shows full details
   ======================================== */
const MyScoreCard = ({ score }) => {
  const tc = colorMap[score.tier.color];
  const tierDef = TIERS.find(t => t.id === score.tier.id);
  const currentTierIdx = TIERS.findIndex(t => t.id === score.tier.id);
  const nextTier = TIERS[currentTierIdx + 1];
  const tierMax = tierDef?.max === Infinity ? score.score + 1000 : tierDef?.max;
  const tierProgress = tierMax ? ((score.score - tierDef.min) / (tierMax - tierDef.min)) * 100 : 100;
  const remaining = nextTier ? nextTier.min - score.score : 0;
  const [activeIndex, setActiveIndex] = useState(null);

  // Build pie data: each tier is a segment, current tier split into earned + remaining
  const pieData = useMemo(() => {
    const data = [];

    for (let i = 0; i < TIERS.length; i++) {
      const tier = TIERS[i];
      const tierColor = colorMap[tier.color];
      const tierRange = tier.max === Infinity ? 1000 : tier.max - tier.min;

      if (i < currentTierIdx) {
        // Past tier — fully earned
        data.push({
          name: tier.name,
          tierName: `${tier.icon} ${tier.name}`,
          value: tierRange,
          fill: tierColor.hex,
          icon: tier.icon,
          isPast: true,
          isCurrent: false,
          isRemaining: false,
          min: tier.min,
          maxStr: tier.max === Infinity ? '9,999+' : formatNum(tier.max),
          tierIdx: i,
        });
      } else if (i === currentTierIdx) {
        // Current tier — earned portion
        const earned = score.score - tier.min;
        data.push({
          name: `${tier.name} — earned`,
          tierName: `${tier.icon} ${tier.name}`,
          value: Math.max(earned, 1),
          fill: tierColor.hex,
          icon: tier.icon,
          isPast: false,
          isCurrent: true,
          isRemaining: false,
          earnedPts: score.score,
          earnedInTier: earned,
          remainingPts: remaining,
          progressPct: tierProgress.toFixed(0),
          min: tier.min,
          maxStr: tier.max === Infinity ? '9,999+' : formatNum(tier.max),
          tierIdx: i,
        });
        // Current tier — remaining portion
        const left = (tierMax - tier.min) - earned;
        if (left > 0) {
          data.push({
            name: `${tier.name} — remaining`,
            tierName: `${tier.icon} ${tier.name}`,
            value: left,
            fill: tierColor.hex + '35',
            icon: tier.icon,
            isPast: false,
            isCurrent: false,
            isRemaining: true,
            min: tier.min,
            maxStr: tier.max === Infinity ? '9,999+' : formatNum(tier.max),
            tierIdx: i,
          });
        }
      } else {
        // Future tier — muted
        data.push({
          name: tier.name,
          tierName: `${tier.icon} ${tier.name}`,
          value: tierRange,
          fill: tierColor.hex + '20',
          icon: tier.icon,
          isPast: false,
          isCurrent: false,
          isRemaining: false,
          min: tier.min,
          maxStr: tier.max === Infinity ? '9,999+' : formatNum(tier.max),
          tierIdx: i,
        });
      }
    }

    return data;
  }, [score, currentTierIdx, tierMax, tierProgress, remaining]);

  // Breakdown items
  const breakdown = [
    { icon: '📋', label: 'Leads', count: score.breakdown.leads.count, pts: score.breakdown.leads.points },
    { icon: '📞', label: 'Activities', count: score.breakdown.activities.count, pts: score.breakdown.activities.points },
    { icon: '✅', label: 'Activated', count: score.breakdown.activated.count, pts: score.breakdown.activated.points },
    { icon: '💰', label: 'Revenue', count: formatMoney(score.breakdown.revenue.amount), pts: score.breakdown.revenue.points },
    { icon: '📌', label: 'Follow-ups', count: score.breakdown.followups.count, pts: score.breakdown.followups.points },
    { icon: '🔥', label: 'Streak', count: `${score.breakdown.streak.months} mo`, pts: score.breakdown.streak.points },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={`${tc.fill} h-1.5`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-12 h-12 rounded-2xl ${tc.light} flex items-center justify-center text-2xl`}>
            {score.tier.icon}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Your Current Tier</p>
            <p className={`text-xl font-black ${tc.text}`}>{score.tier.name}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Score</p>
            <p className="text-3xl font-black text-slate-900 tabular-nums">{formatNum(score.score)}</p>
          </div>
        </div>

        {/* Pie + Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* Animated Donut Chart */}
          <div className="relative h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  animationBegin={0}
                  animationDuration={2000}
                  animationEasing="ease-out"
                  isAnimationActive={true}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      stroke={entry.isCurrent && !entry.isRemaining ? '#fff' : 'none'}
                      strokeWidth={entry.isCurrent && !entry.isRemaining ? 2 : 0}
                    />
                  ))}
                  <Tooltip content={<TierTooltip breakdown={breakdown} />} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-1">{score.tier.icon}</div>
                <div className="text-2xl font-black text-slate-900 tabular-nums">{formatNum(score.score)}</div>
                <div className={`text-xs font-bold ${tc.text}`}>{score.tier.name}</div>
                {nextTier && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {formatNum(remaining)} pts to {nextTier.icon}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side — tier path + progress + breakdown */}
          <div className="space-y-4">
            {/* Tier path */}
            <div className="flex items-center gap-1 justify-center">
              {TIERS.map((tier, i) => {
                const isCurrent = i === currentTierIdx;
                const isPast = i < currentTierIdx;
                const isActive = activeIndex != null && pieData[activeIndex]?.tierIdx === i;
                return (
                  <div
                    key={tier.id}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-300 ${
                      isActive ? 'bg-slate-100 scale-110 shadow-sm' : ''
                    }`}
                  >
                    <span className="text-lg">{tier.icon}</span>
                    <span className={`text-[10px] font-bold ${
                      isCurrent ? tc.text : isPast ? 'text-slate-500' : 'text-slate-300'
                    }`}>
                      {tier.name}
                    </span>
                    {isCurrent && (
                      <div className={`w-1.5 h-1.5 rounded-full ${tc.fill}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold ${tc.text}`}>
                  {tierDef.icon} {tierDef.name} Progress
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {tierProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${tc.fill}`}
                  style={{ width: `${Math.min(Math.max(tierProgress, 2), 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                <span>{formatNum(tierDef.min)} pts</span>
                <span>{tierMax === Infinity ? '9,999+' : formatNum(tierMax)} pts</span>
              </div>
              {nextTier && (
                <p className="text-xs text-center mt-2">
                  <span className="font-bold text-slate-700">{formatNum(remaining)}</span>
                  <span className="text-slate-400"> more points to reach </span>
                  <span className="font-bold">{nextTier.icon} {nextTier.name}</span>
                </p>
              )}
            </div>

            {/* Breakdown grid */}
            <div className="grid grid-cols-3 gap-2">
              {breakdown.map(b => (
                <div key={b.label} className="bg-slate-50 rounded-lg p-2.5 text-center hover:bg-slate-100 transition-colors">
                  <div className="text-sm mb-0.5">{b.icon}</div>
                  <div className="text-sm font-extrabold text-slate-900 tabular-nums">{formatNum(b.pts)}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{b.label}</div>
                  <div className="text-[10px] text-slate-300">{typeof b.count === 'string' ? b.count : formatNum(b.count)}</div>
                </div>
              ))}
            </div>

            {/* Conv bonus */}
            {score.breakdown.convBonus.points > 0 && (
              <div className="flex items-center justify-center">
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  🎯 {score.breakdown.convBonus.rate}% conv rate → +{score.breakdown.convBonus.points} bonus
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================
   Leaderboard Row
   ======================================== */
const LeaderboardRow = ({ bd, rank, isMe, isExpanded, onToggle }) => {
  const tc = colorMap[bd.tier.color];
  const rankStyle = rank === 1 ? 'bg-amber-50 border-amber-200' : rank === 2 ? 'bg-slate-50 border-slate-200' : rank === 3 ? 'bg-orange-50 border-orange-200' : '';
  const rankBadge = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;

  return (
    <div className={`${isMe ? 'bg-red-50/50' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/50 transition-colors ${rankStyle}`}
      >
        <span className={`w-8 text-center text-sm font-black ${rank <= 3 ? 'text-xl' : 'text-slate-400'}`}>
          {rankBadge}
        </span>
        <div className={`w-9 h-9 rounded-xl ${tc.light} flex items-center justify-center text-lg`}>
          {bd.tier.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 truncate">{bd.name}</span>
            {isMe && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-600">You</span>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className={`font-semibold ${tc.text}`}>{bd.tier.name}</span>
            {bd.team && <span>· {bd.team}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-slate-900 tabular-nums">{formatNum(bd.score)}</div>
          <div className="text-[10px] text-slate-400">pts</div>
        </div>
        <div className="ml-1">
          {isExpanded
            ? <ChevronUp size={14} className="text-slate-300" />
            : <ChevronDown size={14} className="text-slate-300" />
          }
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 pt-1 bg-slate-50/50">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { icon: '📋', label: 'Leads', count: bd.breakdown.leads.count, pts: bd.breakdown.leads.points },
              { icon: '📞', label: 'Activities', count: bd.breakdown.activities.count, pts: bd.breakdown.activities.points },
              { icon: '✅', label: 'Activated', count: bd.breakdown.activated.count, pts: bd.breakdown.activated.points },
              { icon: '💰', label: 'Revenue', count: formatMoney(bd.breakdown.revenue.amount), pts: bd.breakdown.revenue.points },
              { icon: '📌', label: 'Follow-ups', count: bd.breakdown.followups.count, pts: bd.breakdown.followups.points },
              { icon: '🔥', label: 'Streak', count: `${bd.breakdown.streak.months} mo`, pts: bd.breakdown.streak.points },
            ].map(b => (
              <div key={b.label} className="bg-white rounded-xl p-2.5 text-center border border-slate-100">
                <div className="text-sm mb-0.5">{b.icon}</div>
                <div className="text-sm font-extrabold text-slate-900">{formatNum(b.pts)}</div>
                <div className="text-[10px] text-slate-400">{b.label}</div>
                <div className="text-[10px] text-slate-300">{typeof b.count === 'string' ? b.count : formatNum(b.count)}</div>
              </div>
            ))}
          </div>
          {bd.breakdown.convBonus.points > 0 && (
            <div className="mt-2 text-center">
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                🎯 {bd.breakdown.convBonus.rate}% conv rate → +{bd.breakdown.convBonus.points} bonus
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BDTierPage;
