import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Save, Loader2, ShieldCheck, ChevronRight, Check, X, Plus, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_URL } from '../config/api';

const PERMISSION_GROUPS = [
  {
    label: 'Leads',
    permissions: [
      { key: 'leads.view', label: 'View Leads' },
      { key: 'leads.create', label: 'Create Leads' },
      { key: 'leads.update', label: 'Update Leads' },
      { key: 'leads.delete', label: 'Delete Leads' },
      { key: 'leads.assign', label: 'Assign Leads' },
      { key: 'leads.upload', label: 'Bulk Upload' },
      { key: 'leads.export', label: 'Export Leads' },
      { key: 'leads.check-duplicity', label: 'Check Duplicity' },
    ]
  },
  {
    label: 'Users',
    permissions: [
      { key: 'users.view', label: 'View Users' },
      { key: 'users.create', label: 'Create Users' },
      { key: 'users.update', label: 'Update Users' },
      { key: 'users.delete', label: 'Delete Users' },
    ]
  },
  {
    label: 'Goals',
    permissions: [
      { key: 'goals.view', label: 'View Goals' },
      { key: 'goals.create', label: 'Create Goals' },
      { key: 'goals.update', label: 'Update Goals' },
      { key: 'goals.delete', label: 'Delete Goals' },
    ]
  },
  {
    label: 'Tasks',
    permissions: [
      { key: 'tasks.view', label: 'View Tasks' },
      { key: 'tasks.create', label: 'Create Tasks' },
      { key: 'tasks.update', label: 'Update Tasks' },
      { key: 'tasks.delete', label: 'Delete Tasks' },
    ]
  },
  {
    label: 'Tickets',
    permissions: [
      { key: 'tickets.view', label: 'View Tickets' },
      { key: 'tickets.create', label: 'Create Tickets' },
      { key: 'tickets.update', label: 'Update Tickets' },
      { key: 'tickets.delete', label: 'Delete Tickets' },
    ]
  },
  {
    label: 'Analytics',
    permissions: [
      { key: 'analytics.view', label: 'View Analytics' },
      { key: 'analytics.export', label: 'Export Reports' },
      { key: 'analytics.leaderboard', label: 'BD Leaderboard' },
    ]
  },
  {
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard' },
      { key: 'dashboard.daily-report', label: 'Daily Report' },
      { key: 'dashboard.user-performance', label: 'User Performance' },
      { key: 'dashboard.day-detail', label: 'Day Detail' },
      { key: 'dashboard.day-compare', label: 'Day Compare' },
      { key: 'dashboard.week-compare', label: 'Week Compare' },
    ]
  },
  {
    label: 'Extension',
    permissions: [
      { key: 'extension.view', label: 'View Extension' },
      { key: 'extension.admin', label: 'Extension Admin' },
    ]
  },
  {
    label: 'Nepalcan',
    permissions: [
      { key: 'nepalcan.view', label: 'View Nepalcan' },
      { key: 'nepalcan.manage', label: 'Manage Nepalcan' },
    ]
  },
  {
    label: 'Vendors',
    permissions: [
      { key: 'vendors.view', label: 'View Vendors' },
      { key: 'vendors.manage', label: 'Manage Vendors' },
      { key: 'vendors.snapshots', label: 'Vendor Snapshots' },
    ]
  },
  {
    label: 'Listing',
    permissions: [
      { key: 'listing.snapshots', label: 'Listing Snapshots' },
    ]
  },
  {
    label: 'Delivery Zones',
    permissions: [
      { key: 'delivery-zones.view', label: 'View Delivery Zones' },
      { key: 'delivery-zones.manage', label: 'Manage Delivery Zones' },
    ]
  },
  {
    label: 'Departments',
    permissions: [
      { key: 'departments.view', label: 'View Departments' },
      { key: 'departments.create', label: 'Create Departments' },
      { key: 'departments.update', label: 'Update Departments' },
      { key: 'departments.delete', label: 'Delete Departments' },
    ]
  },
  {
    label: 'Pipeline',
    permissions: [
      { key: 'pipeline.manage', label: 'Pipeline Settings' },
    ]
  },
  {
    label: 'Sync',
    permissions: [
      { key: 'sync.manage', label: 'Manage Sync' },
    ]
  },
  {
    label: 'BD Tiers',
    permissions: [
      { key: 'bd-tiers.view', label: 'View BD Tiers' },
    ]
  },
  {
    label: 'Notifications',
    permissions: [
      { key: 'notifications.view', label: 'View Notifications' },
    ]
  },
  {
    label: 'Activities',
    permissions: [
      { key: 'activities.view', label: 'View Activities' },
      { key: 'activities.create', label: 'Create Activities' },
    ]
  },
  {
    label: 'Finance',
    permissions: [
      { key: 'finance.view', label: 'View Finance' },
      { key: 'finance.create', label: 'Create Finance' },
      { key: 'finance.update', label: 'Update Finance' },
      { key: 'finance.delete', label: 'Delete Finance' },
    ]
  }
];

const ROLE_COLORS = {
  super_admin: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  admin: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  user: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  viewer: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' },
};

const PermissionsSettingsPage = () => {
  const { user } = useSelector((state) => state.auth);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_URL}/roles`, { headers });
      const data = await res.json();
      setRoles(data.data.roles || []);
    } catch (err) {
      console.error('Error fetching roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const startEditing = (role) => {
    setExpandedRole(role._id);
    setEditingPermissions(new Set(role.permissions || []));
  };

  const togglePermission = (perm) => {
    if (!editingPermissions) return;
    const next = new Set(editingPermissions);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    setEditingPermissions(next);
  };

  const toggleGroup = (groupPerms) => {
    if (!editingPermissions) return;
    const next = new Set(editingPermissions);
    const allChecked = groupPerms.every(p => next.has(p.key));
    groupPerms.forEach(p => {
      if (allChecked) next.delete(p.key);
      else next.add(p.key);
    });
    setEditingPermissions(next);
  };

  const savePermissions = async (roleId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/roles/${roleId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ permissions: Array.from(editingPermissions) })
      });
      if (res.ok) {
        await fetchRoles();
        setEditingPermissions(null);
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setEditingPermissions(null);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newRoleName.trim().toLowerCase().replace(/\s+/g, '_'), description: newRoleDescription.trim() })
      });
      if (res.ok) {
        await fetchRoles();
        setShowAddRole(false);
        setNewRoleName('');
        setNewRoleDescription('');
      }
    } catch (err) {
      console.error('Error creating role:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      const res = await fetch(`${API_URL}/roles/${roleId}`, { method: 'DELETE', headers });
      if (res.ok) await fetchRoles();
    } catch (err) {
      console.error('Error deleting role:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Click a role to view and edit its permissions
        </p>
        <button
          onClick={() => setShowAddRole(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all"
        >
          <Plus size={14} />
          Add Role
        </button>
      </div>

      {/* Add Role Modal */}
      {showAddRole && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">New Role</p>
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Role name (e.g. manager)"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none"
          />
          <input
            type="text"
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={createRole}
              disabled={saving || !newRoleName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Create
            </button>
            <button
              onClick={() => { setShowAddRole(false); setNewRoleName(''); setNewRoleDescription(''); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {roles.map(role => {
        const colors = ROLE_COLORS[role.name] || ROLE_COLORS.viewer;
        const isExpanded = expandedRole === role._id;
        const isSuperAdmin = role.name === 'super_admin';
        const isEditing = editingPermissions !== null && isExpanded;

        return (
          <div key={role._id} className={cn("bg-white rounded-2xl border shadow-sm overflow-hidden transition-all", colors.border)}>
            {/* Role Header */}
            <button
              onClick={() => {
                if (isExpanded) {
                  setExpandedRole(null);
                  setEditingPermissions(null);
                } else {
                  setExpandedRole(role._id);
                  setEditingPermissions(null);
                }
              }}
              className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
                <ShieldCheck size={18} className={colors.text} />
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-slate-900 capitalize">{role.name.replace('_', ' ')}</p>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", colors.badge)}>
                    {role.permissions?.length || 0} perms
                  </span>
                  {isSuperAdmin && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase">
                      All Access
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{role.description || 'No description'}</p>
              </div>
              {!isSuperAdmin && !isExpanded && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEditing(role); }}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    Edit
                  </button>
                  {!['super_admin', 'admin', 'user'].includes(role.name) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRole(role._id); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete role"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
              <ChevronRight size={16} className={cn("text-slate-400 transition-transform", isExpanded && "rotate-90")} />
            </button>

            {/* Expanded Permissions */}
            {isExpanded && (
              <div className="border-t border-slate-100 px-5 py-4">
                {isEditing && (
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => savePermissions(role._id)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                    <span className="text-xs text-slate-400 ml-2">
                      {editingPermissions.size} permissions selected
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  {PERMISSION_GROUPS.map(group => {
                    const allChecked = group.permissions.every(p =>
                      isEditing ? editingPermissions.has(p.key) : (role.permissions || []).includes(p.key)
                    );
                    const someChecked = group.permissions.some(p =>
                      isEditing ? editingPermissions.has(p.key) : (role.permissions || []).includes(p.key)
                    );

                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 mb-2">
                          {isEditing && (
                            <button
                              onClick={() => toggleGroup(group.permissions)}
                              className={cn(
                                "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                                allChecked
                                  ? "bg-red-600 border-red-600"
                                  : someChecked
                                    ? "bg-red-200 border-red-400"
                                    : "border-slate-300"
                              )}
                            >
                              {(allChecked || someChecked) && <Check size={10} className="text-white" />}
                            </button>
                          )}
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.label}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.permissions.map(perm => {
                            const isChecked = isEditing
                              ? editingPermissions.has(perm.key)
                              : (role.permissions || []).includes(perm.key);

                            return isEditing ? (
                              <button
                                key={perm.key}
                                onClick={() => togglePermission(perm.key)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                  isChecked
                                    ? "bg-red-50 border-red-200 text-red-700"
                                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                )}
                              >
                                {perm.label}
                              </button>
                            ) : (
                              <span
                                key={perm.key}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-bold",
                                  isChecked
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-50 text-slate-300 border border-slate-100"
                                )}
                              >
                                {perm.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionsSettingsPage;
