import React, { useState, useEffect } from 'react';
import { Save, Link as LinkIcon, Folder, ChevronRight, ChevronLeft, X } from 'lucide-react';

export default function OpenListSettings() {
  const [settings, setSettings] = useState({
    ol_url: '', ol_token: '', ol_mount_prefix: '',
    ol_115_mount_point: '', root_115_path: '',
    cookie_115: '' // Need this for folder fetching
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Folder selector state
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [folderHistory, setFolderHistory] = useState<{cid: string, name: string}[]>([{cid: '0', name: '根目录'}]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

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

  const openFolderSelector = () => {
    if (!settings.cookie_115) {
      alert('请先在 115 配置页面保存 Cookie');
      return;
    }
    setIsSelectorOpen(true);
    setFolderHistory([{cid: '0', name: '根目录'}]);
    fetchFolders('0');
  };

  const fetchFolders = async (cid: string) => {
    setIsLoadingFolders(true);
    try {
      const res = await fetch('/api/115/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: settings.cookie_115, cid })
      });
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders);
      } else {
        alert('获取目录失败: ' + data.msg);
      }
    } catch (e) {
      alert('网络错误');
    }
    setIsLoadingFolders(false);
  };

  const handleFolderClick = (folder: any) => {
    setFolderHistory(prev => [...prev, { cid: folder.cid, name: folder.name }]);
    fetchFolders(folder.cid);
  };

  const handleBackClick = () => {
    if (folderHistory.length > 1) {
      const newHistory = [...folderHistory];
      newHistory.pop();
      setFolderHistory(newHistory);
      fetchFolders(newHistory[newHistory.length - 1].cid);
    }
  };

  const handleSelectFolder = (folder: any) => {
    const path = folderHistory.map(h => h.name).join('/') + '/' + folder.name;
    const cleanPath = path.replace('根目录', '') || '/';
    
    setSettings(prev => ({
      ...prev,
      root_115_path: cleanPath
    }));
    setIsSelectorOpen(false);
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
            
            <div className="pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-white mb-3">115网盘路径映射 (用于精确扫描)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs text-zinc-500">115网盘真实根目录</label>
                            <button
                                type="button"
                                onClick={openFolderSelector}
                                className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded"
                            >
                                选择目录
                            </button>
                        </div>
                        <input
                            type="text"
                            name="root_115_path"
                            value={settings.root_115_path}
                            readOnly
                            placeholder="请点击上方选择目录"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 text-sm cursor-pointer"
                            onClick={openFolderSelector}
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

      {/* Folder Selector Modal */}
      {isSelectorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">选择 115 根目录</h3>
              <button onClick={() => setIsSelectorOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-3 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto">
              <button 
                onClick={handleBackClick}
                disabled={folderHistory.length <= 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center text-sm text-zinc-300 whitespace-nowrap">
                {folderHistory.map((h, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="w-4 h-4 mx-1 text-zinc-600" />}
                    <span className={i === folderHistory.length - 1 ? 'text-white font-medium' : ''}>
                      {h.name}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingFolders ? (
                <div className="flex justify-center items-center h-32 text-zinc-500">
                  加载中...
                </div>
              ) : folders.length === 0 ? (
                <div className="flex justify-center items-center h-32 text-zinc-500">
                  空目录
                </div>
              ) : (
                <div className="space-y-1">
                  {folders.map(folder => (
                    <div 
                      key={folder.cid}
                      className="flex items-center justify-between p-3 hover:bg-zinc-800/50 rounded-xl group cursor-pointer"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="w-5 h-5 text-indigo-400" />
                        <span className="text-zinc-200">{folder.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFolder(folder);
                        }}
                        className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-all"
                      >
                        选择此目录
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
