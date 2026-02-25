import React, { useState, useEffect } from 'react';
import { Save, Key, FolderTree, AlertCircle, ChevronRight, ChevronLeft, Folder, X } from 'lucide-react';

export default function Settings115() {
  const [settings, setSettings] = useState({
    cookie_115: '',
    cat_tv_cid: '0', cat_tv_name: '电视剧', cat_tv_path: '',
    cat_movie_cid: '0', cat_movie_name: '电影', cat_movie_path: '',
    cat_variety_cid: '0', cat_variety_name: '综艺', cat_variety_path: '',
    cat_anime_cid: '0', cat_anime_name: '动漫', cat_anime_path: '',
    cat_other_cid: '0', cat_other_name: '其他', cat_other_path: ''
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
      // Construct path from history + current folder
      // This is an approximation. Ideally we fetch the path from API or build it up.
      // folderHistory has the path up to current.
      const path = folderHistory.map(h => h.name).join('/') + '/' + folder.name;
      // Remove "根目录" from start if present, or replace with something else?
      // Usually 115 root is just /. 
      // Let's just use the constructed path for now, user can edit it if needed.
      // Actually, let's just use the names.
      
      setSettings(prev => ({
        ...prev,
        [`cat_${currentCatId}_cid`]: folder.cid,
        [`cat_${currentCatId}_name`]: folder.name,
        [`cat_${currentCatId}_path`]: path.replace('根目录', '') || '/'
      }));
    }
    setIsSelectorOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">115 网盘配置</h1>
        <p className="text-zinc-400">配置 115 Cookie 及分类保存路径</p>
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
            <h2 className="text-lg font-semibold text-white">115 Cookie</h2>
          </div>
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-4 flex gap-3 text-sm text-zinc-400 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p>请填入 115 网页版登录后的 Cookie，至少包含 <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">UID</code>, <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">CID</code>, <code className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">SEID</code> 等关键字段。</p>
          </div>
          <div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">目录完整路径</label>
                    <input
                      type="text"
                      name={`cat_${cat.id}_path`}
                      value={settings[`cat_${cat.id}_path` as keyof typeof settings]}
                      onChange={handleChange}
                      placeholder="/分类/路径"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">目录CID</label>
                    <input
                      type="text"
                      readOnly
                      value={settings[`cat_${cat.id}_cid` as keyof typeof settings]}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h3 className="text-lg font-semibold text-white">选择分类目录</h3>
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
