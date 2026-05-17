import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';

const PipelineSettingsPage = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('lead');
  const [editingStage, setEditingStage] = useState(null);
  const [newStage, setNewStage] = useState({ name: '', category: 'lead', color: '#3B82F6' });
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/settings/pipeline', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setStages(data.data.stages || []);
    } catch (err) {
      console.error('Error fetching stages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const filteredStages = stages.filter(s => s.category === activeTab);

  const moveStage = async (id, direction) => {
    const globalIndex = stages.findIndex(s => s._id === id);
    if (globalIndex === -1) return;
    
    const stage = stages[globalIndex];
    const categoryStages = stages.filter(s => s.category === stage.category);
    const categoryIndex = categoryStages.findIndex(s => s._id === id);
    
    if (direction === 'up' && categoryIndex <= 0) return;
    if (direction === 'down' && categoryIndex >= categoryStages.length - 1) return;
    
    // Reorder within category only
    const otherStages = stages.filter(s => s.category !== stage.category);
    const newCatIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;
    
    const newCategoryStages = [...categoryStages];
    [newCategoryStages[categoryIndex], newCategoryStages[newCatIndex]] = 
      [newCategoryStages[newCatIndex], newCategoryStages[categoryIndex]];
    
    // Rebuild stages array with reordered category stages
    const newCategoryStageIds = newCategoryStages.map(s => s._id);
    const orderedStages = [];
    
    // Add non-category stages first (in their original order)
    let newCatIdx = 0;
    for (const s of stages) {
      if (s.category === stage.category) {
        orderedStages.push(newCategoryStages[newCatIdx]);
        newCatIdx++;
      } else {
        orderedStages.push(s);
      }
    }
    
    setStages(orderedStages);
    
    // Update orders in database
    try {
      const stagesToUpdate = newCategoryStages.map((s, idx) => ({ 
        _id: s._id, 
        category: s.category, 
        order: idx + 1 
      }));
      await fetch('/api/v1/settings/pipeline/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ stages: stagesToUpdate })
      });
    } catch (err) {
      console.error('Error reordering:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const categoryStages = stages.filter(s => s.category === newStage.category);
    try {
      const res = await fetch('/api/v1/settings/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...newStage, order: categoryStages.length + 1 })
      });
      const data = await res.json();
      setStages([...stages, data.data.stage]);
      setNewStage({ name: '', category: 'lead', color: '#3B82F6' });
      setShowNewForm(false);
    } catch (err) {
      console.error('Error creating:', err);
    }
  };

  const handleUpdate = async (id, updates) => {
    try {
      await fetch(`/api/v1/settings/pipeline/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      setStages(stages.map(s => s._id === id ? { ...s, ...updates } : s));
      setEditingStage(null);
    } catch (err) {
      console.error('Error updating:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this stage?')) return;
    try {
      await fetch(`/api/v1/settings/pipeline/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(stages.filter(s => s._id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pipeline Settings</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('lead')}
          className={cn(
            "px-6 py-3 font-semibold border-b-2 transition",
            activeTab === 'lead' ? "border-red-600 text-red-600" : "border-transparent text-slate-500"
          )}
        >
          Lead Stages
        </button>
        <button
          onClick={() => setActiveTab('vendor')}
          className={cn(
            "px-6 py-3 font-semibold border-b-2 transition",
            activeTab === 'vendor' ? "border-red-600 text-red-600" : "border-transparent text-slate-500"
          )}
        >
          Vendor Stages
        </button>
      </div>

      {/* Add Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold"
        >
          <Plus size={18} />
          Add {activeTab === 'lead' ? 'Lead' : 'Vendor'} Stage
        </button>
      </div>

      {/* New Stage Form */}
      {showNewForm && (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <input
              type="text"
              placeholder="Stage name"
              value={newStage.name}
              onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
              className="flex-1 px-3 py-2 border rounded"
              required
            />
            <input
              type="hidden"
              value={activeTab}
              onChange={(e) => setNewStage({ ...newStage, category: activeTab })}
            />
            <input
              type="color"
              value={newStage.color}
              onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
              className="w-12 h-10 border rounded cursor-pointer"
            />
            <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded">
              <Save size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-3 py-2 bg-slate-200 rounded"
            >
              <X size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Stages List */}
      <div>
        {filteredStages.map((stage, index) => (
          <div
            key={stage._id}
            className="bg-white p-4 rounded-lg shadow mb-2 flex items-center gap-3"
          >
            <div className="flex flex-col">
              <button
                onClick={() => moveStage(stage._id, 'up')}
                disabled={index === 0}
                className="disabled:opacity-30 hover:text-slate-600"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moveStage(stage._id, 'down')}
                disabled={index === filteredStages.length - 1}
                className="disabled:opacity-30 hover:text-slate-600"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            
            {editingStage === stage._id ? (
              <>
                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => setStages(stages.map(s => s._id === stage._id ? { ...s, name: e.target.value } : s))}
                  className="flex-1 px-2 py-1 border rounded"
                />
                <button
                  onClick={() => handleUpdate(stage._id, { name: stage.name })}
                  className="px-2 py-1 bg-green-600 text-white rounded"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => setEditingStage(null)}
                  className="px-2 py-1 bg-slate-200 rounded"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="flex-1 font-medium">{stage.name}</span>
                <button
                  onClick={() => setEditingStage(stage._id)}
                  className="p-1 hover:bg-slate-100 rounded"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(stage._id)}
                  className="p-1 hover:bg-red-100 text-red-600 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {filteredStages.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No {activeTab} stages defined yet
        </div>
      )}
    </div>
  );
};

export default PipelineSettingsPage;