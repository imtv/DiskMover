import React, { useState, useEffect } from 'react';
import { Save, Key, User, Lock } from 'lucide-react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    admin_username: 'admin',
    admin_password: '',
    enable_cron: 'false'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(prev => ({ 
          ...prev, 
          enable_cron: data.enable_cron || 'false',
          admin_username: data.admin_username || 'admin'
        }));
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value 
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '设置保存成功' });
        setSettings(prev => ({ ...prev, admin_password: '' })); // Clear password field after save
      } else {
        setMessage({ type: 'error', text: '保存失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '网络错误' });
    }
    setIsSaving(false);
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">系统设置</h1>
        <p className="text-zinc-400">配置管理员账号与全局功能开关</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">管理员账号设置</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">用户名</label>
              <input
                type="text"
                name="admin_username"
                value={settings.admin_username}
                onChange={handleChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">新密码 (留空则不修改)</label>
              <input
                type="password"
                name="admin_password"
                value={settings.admin_password}
                onChange={handleChange}
                placeholder="输入新密码..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Key className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">功能开关</h2>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="enable_cron"
              checked={settings.enable_cron === 'true'}
              onChange={handleChange}
              className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-zinc-900"
            />
            <span className="text-zinc-300">启用定时任务功能 (全局)</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  );
}
