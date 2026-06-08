import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ChevronUp, ChevronDown, ChevronRight, Cog, Layers, RefreshCw, Loader2, MapPin, Store } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const PipelineSettingsPage = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lead');
  const [editingStage, setEditingStage] = useState(null);
  const [newStage, setNewStage] = useState({ name: '', category: 'lead', color: '#DC2626' });
  const [showNewForm, setShowNewForm] = useState(false);

  // Delivery zones state
  const [zoneGroups, setZoneGroups] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedZone, setExpandedZone] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/settings/pipeline`, { headers });
      const data = await res.json();
      setStages(data.data.stages || []);
    } catch (err) { console.error('Error fetching stages:', err); }
    finally { setLoading(false); }
  };

  const fetchZoneGroups = async () => {
    setZonesLoading(true);
    try {
      const res = await fetch(`${API_URL}/delivery-zones`, { headers });
      const data = await res.json();
      setZoneGroups(data.data.groups || []);
    } catch (err) { console.error('Error fetching zone groups:', err); }
    finally { setZonesLoading(false); }
  };

  const syncZoneGroups = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/delivery-zones/sync`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setZoneGroups(data.data.groups || []);
    } catch (err) { console.error('Error syncing zone groups:', err); }
    finally { setSyncing(false); }
  };

  useEffect(() => {
    fetchStages();
    fetchZoneGroups();
  }, []);

  const filteredStages = stages.filter(s => s.category === activeTab);

  const moveStage = async (id, direction) => {
    const stage = stages.find(s => s._id === id);
    if (!stage) return;
    const categoryStages = stages.filter(s => s.category === stage.category);
    const categoryIndex = categoryStages.findIndex(s => s._id === id);
    if (direction === 'up' && categoryIndex <= 0) return;
    if (direction === 'down' && categoryIndex >= categoryStages.length - 1) return;
    const newCatIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
    const newCategoryStages = [...categoryStages];
    [newCategoryStages[categoryIndex], newCategoryStages[newCatIndex]] = [newCategoryStages[newCatIndex], newCategoryStages[categoryIndex]];
    const orderedStages = [];
    let newCatIdx = 0;
    for (const s of stages) {
      if (s.category === stage.category) { orderedStages.push(newCategoryStages[newCatIdx]); newCatIdx++; }
      else orderedStages.push(s);
    }
    setStages(orderedStages);
    try {
      const stagesToUpdate = newCategoryStages.map((s, idx) => ({ _id: s._id, category: s.category, order: idx + 1 }));
      await fetch(`${API_URL}/settings/pipeline/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ stages: stagesToUpdate })
      });
    } catch (err) { console.error('Error reordering:', err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const categoryStages = stages.filter(s => s.category === newStage.category);
    try {
      const res = await fetch(`${API_URL}/settings/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ...newStage, order: categoryStages.length + 1 })
      });
      const data = await res.json();
      setStages([...stages, data.data.stage]);
      setNewStage({ name: '', category: 'lead', color: '#DC2626' });
      setShowNewForm(false);
    } catch (err) { console.error('Error creating:', err); }
  };

  const handleUpdate = async (id, updates) => {
    try {
      await fetch(`${API_URL}/settings/pipeline/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(updates)
      });
      setStages(stages.map(s => s._id === id ? { ...s, ...updates } : s));
      setEditingStage(null);
    } catch (err) { console.error('Error updating:', err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this stage?')) return;
    try {
      await fetch(`${API_URL}/settings/pipeline/${id}`, {
        method: 'DELETE',
        headers
      });
      setStages(stages.filter(s => s._id !== id));
    } catch (err) { console.error('Error deleting:', err); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Pipeline Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { key: 'lead', label: 'Lead Stages' },
          { key: 'vendor', label: 'Vendor Stages' },
          { key: 'zones', label: 'Delivery Zones' }
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setEditingStage(null); setShowNewForm(false); }}
            className={cn("px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all",
              activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-slate-400 hover:text-slate-600"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── PIPELINE STAGES TABS ─── */}
      {activeTab !== 'zones' && (
        <>
          {/* Add Button */}
          <div className="flex justify-end">
            <button onClick={() => { setShowNewForm(true); setNewStage({ ...newStage, category: activeTab }); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-sm">
              <Plus size={16} /> Add Stage
            </button>
          </div>

          {/* New Stage Form */}
          {showNewForm && (
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <form onSubmit={handleCreate} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Stage Name</label>
                  <input type="text" placeholder="e.g. Qualified" value={newStage.name}
                    onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">Color</label>
                  <input type="color" value={newStage.color}
                    onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                    className="w-12 h-10 border border-slate-200 rounded-xl cursor-pointer" />
                </div>
                <button type="submit" className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all">
                  <Save size={16} />
                </button>
                <button type="button" onClick={() => setShowNewForm(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                  <X size={16} />
                </button>
              </form>
            </div>
          )}

          {/* Stages List */}
          <div className="space-y-2">
            {filteredStages.map((stage, index) => (
              <div key={stage._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 hover:border-red-100 transition-all group">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStage(stage._id, 'up')} disabled={index === 0}
                    className="p-0.5 text-slate-300 hover:text-red-600 disabled:opacity-20 transition-colors">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveStage(stage._id, 'down')} disabled={index === filteredStages.length - 1}
                    className="p-0.5 text-slate-300 hover:text-red-600 disabled:opacity-20 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                {editingStage === stage._id ? (
                  <>
                    <input type="text" value={stage.name}
                      onChange={(e) => setStages(stages.map(s => s._id === stage._id ? { ...s, name: e.target.value } : s))}
                      className="flex-1" />
                    <button onClick={() => handleUpdate(stage._id, { name: stage.name })}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"><Save size={14} /></button>
                    <button onClick={() => setEditingStage(null)}
                      className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-bold text-sm text-slate-900">{stage.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingStage(stage._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(stage._id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filteredStages.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <Layers size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">No {activeTab} stages defined yet</p>
            </div>
          )}
        </>
      )}

      {/* ─── DELIVERY ZONES TAB ─── */}
      {activeTab === 'zones' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {zoneGroups.length} zone group(s) with {zoneGroups.reduce((sum, g) => sum + g.branches.length, 0)} total branches
            </p>
            <button onClick={syncZoneGroups} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-sm disabled:opacity-50">
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing ? 'Syncing...' : 'Sync from Nepalcan'}
            </button>
          </div>

          {zonesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={24} className="text-red-600 animate-spin" />
            </div>
          ) : zoneGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
              <MapPin size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">No delivery zones synced yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Sync from Nepalcan" to fetch zone groups</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zoneGroups.map(group => (
                <div key={group._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedZone(expandedZone === group._id ? null : group._id)}
                    className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-50/30 transition-colors"
                  >
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                      <MapPin size={18} className="text-red-600" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-bold text-slate-900">{group.name}</p>
                      <p className="text-xs text-slate-400">{group.branches.length} branches</p>
                    </div>
                    <ChevronRight size={16} className={`text-slate-400 transition-transform ${expandedZone === group._id ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedZone === group._id && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {group.branches.map(branch => (
                          <span key={branch.nepalcanId} className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                            {branch.name}
                          </span>
                        ))}
                      </div>
                      {group.syncedAt && (
                        <p className="text-[10px] text-slate-400 mt-3">
                          Last synced: {new Date(group.syncedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PipelineSettingsPage;
