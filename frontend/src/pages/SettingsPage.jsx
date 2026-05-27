import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Cog, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import PipelineSettingsPage from './PipelineSettingsPage';
import PermissionsSettingsPage from './PermissionsSettingsPage';

const SettingsPage = () => {
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('pipeline');

  const tabs = [
    { key: 'pipeline', label: 'Pipeline', icon: Cog },
    ...(user?.role === 'super_admin' ? [{ key: 'permissions', label: 'Permissions', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 bg-red-600 rounded-full" />
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Configuration</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage pipeline stages, delivery zones, and role permissions</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all",
                activeTab === tab.key
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' && <PipelineSettingsPage />}
      {activeTab === 'permissions' && <PermissionsSettingsPage />}
    </div>
  );
};

export default SettingsPage;
