import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Target, Users, ChevronLeft, RefreshCw, Flame, TrendingUp, TrendingDown,
  Edit3, Trash2, Plus, Check, X, Save, Award, Package, CheckCircle
} from 'lucide-react';
import { API_URL } from '../config/api';

const OperationalGoalsPage = () => {
  const { token, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || (user?.permissions || []).includes('extension.admin');
  const [teamFilter, setTeamFilter] = useState(user?.team || 'listing');
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingDefault, setEditingDefault] = useState(false);
  const [defaultForm, setDefaultForm] = useState({ listing_target: 20, spec_target: 10, qc_target: 50, qc_enabled: false });
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ listing_target: 20, spec_target: 10, qc_target: 50, qc_enabled: false });
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [addForm, setAddForm] = useState({ user_id: '', listing_target: 20, spec_target: 10, qc_target: 50, qc_enabled: false });
  const [users, setUsers] = useState([]);
  const [teamPerf, setTeamPerf] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGoals();
    fetchUsers();
    fetchTeamPerformance();
  }, [teamFilter]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const teamParam = isAdmin ? `?team=${teamFilter}` : '';
      const res = await axios.get(`${API_URL}/extension/operational-goals${teamParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoals(res.data.data);
      if (res.data.data.team_default) {
        setDefaultForm({
          listing_target: res.data.data.team_default.listing_target || 0,
          spec_target: res.data.data.team_default.spec_target || 0,
          qc_target: res.data.data.team_default.qc_target || 0,
          qc_enabled: res.data.data.team_default.qc_enabled || false
        });
      }
    } catch (err) {
      console.error('Error fetching goals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.data?.users || res.data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchTeamPerformance = async () => {
    try {
      const teamParam = isAdmin ? `?team=${teamFilter}` : '';
      const res = await axios.get(`${API_URL}/extension/team-performance${teamParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamPerf(res.data.data);
    } catch (err) {
      console.error('Error fetching team performance:', err);
    }
  };

  const saveDefault = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/extension/operational-goals`, {
        team: teamFilter,
        listing_target: parseInt(defaultForm.listing_target) || 0,
        spec_target: parseInt(defaultForm.spec_target) || 0,
        qc_target: parseInt(defaultForm.qc_target) || 0,
        qc_enabled: defaultForm.qc_enabled
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingDefault(false);
      fetchGoals();
    } catch (err) {
      console.error('Error saving default:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveUserOverride = async (userId) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/extension/operational-goals`, {
        team: teamFilter,
        user_id: userId,
        listing_target: parseInt(userForm.listing_target) || 0,
        spec_target: parseInt(userForm.spec_target) || 0,
        qc_target: parseInt(userForm.qc_target) || 0,
        qc_enabled: userForm.qc_enabled
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingUser(null);
      fetchGoals();
    } catch (err) {
      console.error('Error saving override:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (id) => {
    if (!confirm('Remove this user override?')) return;
    try {
      await axios.delete(`${API_URL}/extension/operational-goals/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGoals();
    } catch (err) {
      console.error('Error deleting override:', err);
    }
  };

  const addOverride = async () => {
    if (!addForm.user_id) return;
    setSaving(true);
    try {
      await axios.put(`${API_URL}/extension/operational-goals`, {
        team: teamFilter,
        user_id: addForm.user_id,
        listing_target: parseInt(addForm.listing_target) || 0,
        spec_target: parseInt(addForm.spec_target) || 0,
        qc_target: parseInt(addForm.qc_target) || 0,
        qc_enabled: addForm.qc_enabled
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowAddOverride(false);
      setAddForm({ user_id: '', listing_target: 20, spec_target: 10, qc_target: 50, qc_enabled: false });
      fetchGoals();
    } catch (err) {
      console.error('Error adding override:', err);
    } finally {
      setSaving(false);
    }
  };

  const teamColor = teamFilter === 'listing' ? 'emerald' : 'blue';
  const teamLabel = teamFilter === 'listing' ? 'Listing' : 'QC';
  const teamUsers = users.filter(u => u.team === teamFilter);
  const perfData = teamPerf?.[teamFilter];
  const teamDefault = goals?.team_default;

  const GoalForm = ({ form, setForm, onSave, onCancel, title }) => (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-500 uppercase">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Listing Target / Day</label>
          <input type="number" min="0" value={form.listing_target}
            onChange={e => setForm({ ...form, listing_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
            onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setForm({ ...form, listing_target: 0 }); }}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase">Spec Addition / Day</label>
          <input type="number" min="0" value={form.spec_target}
            onChange={e => setForm({ ...form, spec_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
            onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setForm({ ...form, spec_target: 0 }); }}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase">QC Target / Day</label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.qc_enabled}
                onChange={e => setForm({ ...form, qc_enabled: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500" />
              <span className="text-[10px] font-bold text-slate-500">QC Enabled</span>
            </label>
          </div>
          <input type="number" min="0" value={form.qc_target} disabled={!form.qc_enabled}
            onChange={e => setForm({ ...form, qc_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
            onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setForm({ ...form, qc_target: 0 }); }}
            className={`w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 ${!form.qc_enabled ? 'opacity-50 bg-slate-50' : ''}`} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={saving}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
          <Save size={12} /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft size={20} className="text-slate-500" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Target size={16} className="text-red-600" />
              </div>
              <h1 className="text-lg font-extrabold text-slate-900">Operational Goals</h1>
            </div>
            <button onClick={() => { fetchGoals(); fetchTeamPerformance(); }} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw size={16} className="text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team:</span>
            {['listing', 'qc'].map(t => (
              <button key={t} onClick={() => setTeamFilter(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  teamFilter === t
                    ? t === 'listing' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                {t === 'listing' ? 'Listing Team' : 'QC Team'}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Team Default Goals */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700">{teamLabel} Team — Daily Goals</h3>
                {isAdmin && !editingDefault && (
                  <button onClick={() => setEditingDefault(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                    <Edit3 size={12} /> Edit
                  </button>
                )}
              </div>
              {editingDefault ? (
                <GoalForm form={defaultForm} setForm={setDefaultForm} onSave={saveDefault}
                  onCancel={() => setEditingDefault(false)} title="Edit Team Defaults" />
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className={`p-4 rounded-xl ${teamColor === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Package size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Listing / Day</span>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{teamDefault?.listing_target || 0}</p>
                  </div>
                  <div className={`p-4 rounded-xl ${teamColor === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Spec / Day</span>
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{teamDefault?.spec_target || 0}</p>
                  </div>
                  <div className={`p-4 rounded-xl ${teamDefault?.qc_enabled ? (teamColor === 'emerald' ? 'bg-emerald-50' : 'bg-blue-50') : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Award size={12} className={teamDefault?.qc_enabled ? 'text-slate-400' : 'text-slate-300'} />
                      <span className={`text-[10px] font-bold uppercase ${teamDefault?.qc_enabled ? 'text-slate-400' : 'text-slate-300'}`}>QC / Day</span>
                    </div>
                    <p className={`text-2xl font-extrabold ${teamDefault?.qc_enabled ? 'text-slate-900' : 'text-slate-300'}`}>
                      {teamDefault?.qc_enabled ? (teamDefault?.qc_target || 0) : 'Off'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Per-User Overrides (admin only) */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">User Overrides</h3>
                  <button onClick={() => setShowAddOverride(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700">
                    <Plus size={12} /> Add Override
                  </button>
                </div>

                {showAddOverride && (
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                    <div className="mb-3">
                      <select value={addForm.user_id} onChange={e => setAddForm({ ...addForm, user_id: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">Select user...</option>
                        {teamUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </select>
                    </div>
                    <GoalForm form={addForm} setForm={setAddForm} onSave={addOverride}
                      onCancel={() => setShowAddOverride(false)} title="New User Override" />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase">User</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Listing</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Spec</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">QC</th>
                        <th className="px-4 py-2.5 text-right font-bold text-slate-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(goals?.user_overrides || []).length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No user overrides set</td></tr>
                      ) : (
                        (goals?.user_overrides || []).map(override => {
                          const isEditing = editingUser === override._id;
                          return (
                            <tr key={override._id} className="border-t border-slate-50">
                              <td className="px-4 py-3 font-bold text-slate-900">{override.user_id?.name || 'Unknown'}</td>
                              {isEditing ? (
                                <>
                                  <td className="px-4 py-3 text-center">
                                    <input type="number" min="0" value={userForm.listing_target}
                                      onChange={e => setUserForm({ ...userForm, listing_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                                      onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setUserForm({ ...userForm, listing_target: 0 }); }}
                                      className="w-16 px-2 py-1 rounded border border-slate-200 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input type="number" min="0" value={userForm.spec_target}
                                      onChange={e => setUserForm({ ...userForm, spec_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                                      onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setUserForm({ ...userForm, spec_target: 0 }); }}
                                      className="w-16 px-2 py-1 rounded border border-slate-200 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500" />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <input type="checkbox" checked={userForm.qc_enabled}
                                        onChange={e => setUserForm({ ...userForm, qc_enabled: e.target.checked })}
                                        className="w-3 h-3 rounded border-slate-300 text-red-600" />
                                      {userForm.qc_enabled && (
                                        <input type="number" min="0" value={userForm.qc_target}
                                          onChange={e => setUserForm({ ...userForm, qc_target: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                                          onBlur={e => { if (e.target.value === '' || parseInt(e.target.value) < 0) setUserForm({ ...userForm, qc_target: 0 }); }}
                                          className="w-16 px-2 py-1 rounded border border-slate-200 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-red-500" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => saveUserOverride(override.user_id?._id)} disabled={saving}
                                        className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200">
                                        <Check size={12} />
                                      </button>
                                      <button onClick={() => setEditingUser(null)}
                                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-center font-extrabold text-slate-900">{override.listing_target}</td>
                                  <td className="px-4 py-3 text-center font-extrabold text-slate-900">{override.spec_target}</td>
                                  <td className="px-4 py-3 text-center">
                                    {override.qc_enabled ? (
                                      <span className="font-extrabold text-slate-900">{override.qc_target}</span>
                                    ) : (
                                      <span className="text-slate-300">Off</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button onClick={() => {
                                        setEditingUser(override._id);
                                        setUserForm({
                                          listing_target: override.listing_target,
                                          spec_target: override.spec_target,
                                          qc_target: override.qc_target,
                                          qc_enabled: override.qc_enabled
                                        });
                                      }} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                                        <Edit3 size={12} />
                                      </button>
                                      <button onClick={() => deleteOverride(override._id)}
                                        className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Today's Progress */}
            {perfData?.leaderboard && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50">
                  <h3 className="text-sm font-bold text-slate-700">Today's Progress</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Actual vs Target</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left font-bold text-slate-400 uppercase">Member</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Today</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Target</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Progress</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">Streak</th>
                        <th className="px-4 py-2.5 text-center font-bold text-slate-400 uppercase">QC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.leaderboard.map(member => {
                        const isCurrentUser = member.user_id === user?._id;
                        const pct = member.target_pct;
                        const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <tr key={member.user_id} className={`border-t border-slate-50 ${isCurrentUser ? `bg-${teamColor}-50/50` : ''}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-slate-300">
                                  {member.rank}
                                </span>
                                <span className={`font-bold ${isCurrentUser ? `text-${teamColor}-700` : 'text-slate-900'}`}>{member.name}</span>
                                {isCurrentUser && <span className="text-[9px] font-bold text-slate-400">(You)</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-extrabold text-slate-900">{member.today_count}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-500">{member.target || '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className={`font-bold ${pct >= 90 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {member.streak > 0 ? (
                                <span className="flex items-center justify-center gap-1">
                                  <Flame size={12} className={member.streak >= 3 ? 'text-orange-500' : 'text-slate-300'} />
                                  <span className={`font-bold ${member.streak >= 3 ? 'text-orange-600' : 'text-slate-500'}`}>{member.streak}d</span>
                                </span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {member.qc_enabled ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600">ON</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OperationalGoalsPage;
