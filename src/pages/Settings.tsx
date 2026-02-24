import React, { useState, useEffect } from 'react';
import { Save, Key, Settings as SettingsIcon, FolderTree, Link as LinkIcon, Clock, AlertCircle, ChevronRight, ChevronLeft, Folder, X } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    cookie_115: '',
    cat_tv_cid: '0', cat_tv_name: '电视剧',
    cat_movie_cid: '0', cat_movie_name: '电影',
    cat_variety_cid: '0', cat_variety_name: '综艺',
    cat_anime_cid: '0', cat_anime_name: '动漫',
    cat_other_cid: '0', cat_other_name: '其他',
    ol_url: '', ol_token: '', ol_mount_prefix: '',
    enable_cron: 'false'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Folder selector state
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [currentCatId, setCurrentCatId] = useState<string | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [folderHistory, setFolderHistory] = useState<{cid: string, name: string}[]>([{cid: '0', name: '根目录'}]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(prev => ({ ...prev, ...data })));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked ? 'true' : 'false' }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
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

  const openFolderSelector = (catId: string) => {
    if (!settings.cookie_115) {
      alert('请先填写并保存 115 Cookie');
      return;
    }
    setCurrentCatId(catId);
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
    if (currentCatId) {
      setSettings(prev => ({
        ...prev,
        [`cat_${currentCatId}_cid`]: folder.cid,
        [`cat_${currentCatId}_name`]: folder.name
      }));
    }
    setIsSelectorOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">系统设置</h1>
        <p className="text-zinc-400">配置 115 网盘、分类目录及 OpenList 挂载信息</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 115 Cookie */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Key className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">115 网盘配置</h2>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 flex gap-3 text-sm text-zinc-400 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p>请填入 115 网页版登录后的 Cookie，至少包含 <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">UID</code>, <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">CID</code>, <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">SEID</code> 等关键字段。</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Cookie</label>
            <textarea
              name="cookie_115"
              value={settings.cookie_115}
              onChange={handleChange}
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
              placeholder="输入 115 网盘 Cookie..."
            />
          </div>
        </div>

        {/* Categories */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <FolderTree className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">分类目录配置 (CID)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { id: 'tv', label: '电视剧' },
              { id: 'movie', label: '电影' },
              { id: 'variety', label: '综艺' },
              { id: 'anime', label: '动漫' },
              { id: 'other', label: '其他' },
            ].map(cat => (
              <div key={cat.id} className="space-y-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-zinc-300">{cat.label}分类</label>
                  <button
                    type="button"
                    onClick={() => openFolderSelector(cat.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded"
                  >
                    选择目录
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">目录名称</label>
                    <input
                      type="text"
                      name={`cat_${cat.id}_name`}
                      value={settings[`cat_${cat.id}_name` as keyof typeof settings]}
                      onChange={handleChange}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">目录 ID (CID)</label>
                    <input
                      type="text"
                      name={`cat_${cat.id}_cid`}
                      value={settings[`cat_${cat.id}_cid` as keyof typeof settings]}
                      onChange={handleChange}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OpenList */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <LinkIcon className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">OpenList 配置</h2>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">OpenList 地址</label>
              <input
                type="url"
                name="ol_url"
                value={settings.ol_url}
                onChange={handleChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="http://192.168.1.100:3000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">OpenList Token</label>
              <input
                type="text"
                name="ol_token"
                value={settings.ol_token}
                onChange={handleChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="输入 Token"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">挂载前缀</label>
              <input
                type="text"
                name="ol_mount_prefix"
                value={settings.ol_mount_prefix}
                onChange={handleChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例如：/115网盘"
              />
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">高级设置</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">启用定时任务</h3>
              <p className="text-xs text-zinc-500 mt-1">允许在创建任务时设置 Cron 表达式进行定时转存</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="enable_cron"
                checked={settings.enable_cron === 'true'}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>

      {/* Folder Selector Modal */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                选择目录
              </h3>
              <button onClick={() => setIsSelectorOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="px-6 py-3 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
              {folderHistory.map((hist, idx) => (
                <React.Fragment key={hist.cid}>
                  {idx > 0 && <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />}
                  <button
                    onClick={() => {
                      const newHistory = folderHistory.slice(0, idx + 1);
                      setFolderHistory(newHistory);
                      fetchFolders(hist.cid);
                    }}
                    className={`text-sm font-medium transition-colors ${idx === folderHistory.length - 1 ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {hist.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="p-2 overflow-y-auto flex-1 bg-zinc-950 min-h-[300px]">
              {isLoadingFolders ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : folders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <Folder className="w-12 h-12 mb-2 text-zinc-700" />
                  <p>空目录</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {folderHistory.length > 1 && (
                    <button
                      onClick={handleBackClick}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800/50 text-zinc-300 transition-colors text-left"
                    >
                      <ChevronLeft className="w-5 h-5 text-zinc-500" />
                      <span className="font-medium">返回上一级</span>
                    </button>
                  )}
                  {folders.map(folder => (
                    <div key={folder.id} className="flex items-center group rounded-xl hover:bg-zinc-800/50 transition-colors">
                      <button
                        onClick={() => handleFolderClick(folder)}
                        className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <Folder className="w-5 h-5 text-indigo-400 shrink-0" />
                        <span className="font-medium text-zinc-200 truncate">{folder.name}</span>
                      </button>
                      <button
                        onClick={() => handleSelectFolder(folder)}
                        className="px-4 py-2 mr-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        选择此项
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center shrink-0">
               <div className="text-xs text-zinc-500">
                 当前所在: {folderHistory[folderHistory.length - 1].name}
               </div>
               <button
                  onClick={() => handleSelectFolder(folderHistory[folderHistory.length - 1])}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  选择当前目录
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
