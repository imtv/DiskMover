import React, { useState, useEffect } from 'react';
import { Save, Link as LinkIcon } from 'lucide-react';

export default function OpenListSettings() {
  const [settings, setSettings] = useState({
    ol_url: '', ol_token: '', ol_mount_prefix: '',
    ol_115_mount_point: '', root_115_path: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(prev => ({ ...prev, ...data })));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
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
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">OpenList 配置</h1>
        <p className="text-zinc-400">配置 OpenList 集成以实现自动扫描</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <LinkIcon className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">OpenList 集成 (手动/自动扫描)</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">OpenList 地址</label>
              <input
                type="text"
                name="ol_url"
                value={settings.ol_url}
                onChange={handleChange}
                placeholder="如 http://192.168.1.5:5244"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">API Token</label>
              <input
                type="text"
                name="ol_token"
                value={settings.ol_token}
                onChange={handleChange}
                placeholder="后台-设置-其他-令牌"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">OpenList 挂载路径 (对应上方根目录)</label>
              <input
                type="text"
                name="ol_mount_prefix"
                value={settings.ol_mount_prefix}
                onChange={handleChange}
                placeholder="例如 /115网盘 (将自动替换根目录路径)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            
            <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-white mb-3">115网盘路径映射 (用于精确扫描)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">115网盘真实根目录 (如 /根目录/Videos-115)</label>
                        <input
                            type="text"
                            name="root_115_path"
                            value={settings.root_115_path}
                            onChange={handleChange}
                            placeholder="/根目录/Videos-115"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">OpenList 挂载点 (如 /115网盘)</label>
                        <input
                            type="text"
                            name="ol_115_mount_point"
                            value={settings.ol_115_mount_point}
                            onChange={handleChange}
                            placeholder="/115网盘"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-sm"
                        />
                    </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                    当系统在 115 网盘操作文件时，会将路径中的 <b>115网盘真实根目录</b> 替换为 <b>OpenList 挂载点</b>，然后通知 OpenList 扫描该路径。
                </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  );
}
