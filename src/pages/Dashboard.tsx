import React, { useState, useEffect } from 'react';
import { Play, Trash2, FileText, FolderOpen, CheckCircle2, Clock, XCircle, RefreshCw, Link as LinkIcon, Pin, ScanText, Logs, Sun, Moon, Film } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { useAuth } from '../context/AuthContext';

interface Task {
  id: number;
  name: string;
  share_url: string;
  share_code: string;
  category: string;
  cron_expr: string;
  status: string;
  created_at: string;
  is_pinned: number;
  resource_url?: string;
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<{id: number, message: string, created_at: string}[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableCron, setEnableCron] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [category, setCategory] = useState('');
  const [cronExpr, setCronExpr] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');

  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceShareUrl, setReplaceShareUrl] = useState('');
  const [replaceShareCode, setReplaceShareCode] = useState('');

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [newResourceUrl, setNewResourceUrl] = useState('');


  useEffect(() => {
    fetchTasks();
    fetchPublicSettings();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let logInterval: NodeJS.Timeout;
    if (isLogModalOpen && currentTaskId) {
      // Poll logs every 1 second when modal is open
      logInterval = setInterval(async () => {
        const res = await fetch(`/api/tasks/${currentTaskId}/logs`);
        const data = await res.json();
        setLogs(data);
      }, 1000);
    }
    return () => {
      if (logInterval) clearInterval(logInterval);
    };
  }, [isLogModalOpen, currentTaskId]);

  const fetchTasks = async () => {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data);
  };

  const fetchPublicSettings = async () => {
    const res = await fetch('/api/public-settings');
    const data = await res.json();
    setEnableCron(data.enable_cron);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      alert('请选择分类');
      return;
    }
    setIsSubmitting(true);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, share_url: shareUrl, share_code: shareCode, category, cron_expr: cronExpr, resource_url: resourceUrl }),
    });
    const data = await res.json();
    
    setName('');
    setShareUrl('');
    setShareCode('');
    setCategory('');
    setCronExpr('');
    setResourceUrl('');
    setIsSubmitting(false);
    fetchTasks();

    if (data.success && data.id) {
        handleViewLogs(data.id);
    }
  };

  const handleDeleteTask = async (id: number) => {
    if (confirm('确定要删除此任务吗？')) {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    }
  };


  const handleViewLogs = async (id: number) => {
    setCurrentTaskId(id);
    const res = await fetch(`/api/tasks/${id}/logs`);
    const data = await res.json();
    setLogs(data);
    setIsLogModalOpen(true);
  };

  const handleOpenReplaceModal = (task: Task) => {
    setCurrentTaskId(task.id);
    setReplaceShareUrl('');
    setReplaceShareCode('');
    setIsReplaceModalOpen(true);
  };

  const handleReplaceLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTaskId) return;

    await fetch(`/api/tasks/${currentTaskId}/replace-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_url: replaceShareUrl, share_code: replaceShareCode }),
    });
    
    setIsReplaceModalOpen(false);
    fetchTasks();
    // Auto open logs
    handleViewLogs(currentTaskId);
  };

  const handleOpenResourceModal = (task: Task) => {
    setCurrentTaskId(task.id);
    setNewResourceUrl(task.resource_url || '');
    setIsResourceModalOpen(true);
  };

  const handleUpdateResourceUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTaskId) return;

    await fetch(`/api/tasks/${currentTaskId}/resource-url`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_url: newResourceUrl }),
    });

    setIsResourceModalOpen(false);
    fetchTasks();
  };

  const handleClearAllTasks = async () => {
    if (!confirm('⚠️ 警告：确定要清空所有任务吗？\n此操作将删除所有任务记录并停止相关定时器，且不可恢复！')) return;
    await fetch('/api/tasks', { method: 'DELETE' });
    fetchTasks();
  };

  const handlePinTask = async (id: number) => {
    await fetch(`/api/tasks/${id}/pin`, { method: 'POST' });
    fetchTasks();
  };

  const handleRefreshIndex = async (id: number) => {
    await fetch(`/api/tasks/${id}/refresh-index`, { method: 'POST' });
    fetchTasks();
  };

  const categoryMap: Record<string, string> = {
    tv: '电视剧',
    movie: '电影',
    variety: '综艺',
    anime: '动漫',
    other: '其他'
  };

  return (
    <div className="space-y-4 bg-zinc-950 min-h-screen px-4 py-3 sm:p-8 dark">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">115网盘</h1>
          <p className="text-xs sm:text-base text-zinc-600 dark:text-zinc-400">提交 115 分享链接，系统将自动帮您转存并整理</p>
        </div>
        <div className="flex items-center gap-3">

        </div>
      </div>

      {/* Create Task Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 sm:p-6">
        <form onSubmit={handleCreateTask} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">115 分享链接 *</label>
              <input
                type="url"
                required
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://115cdn.com/s/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">影片名 *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="那年花开月正圆"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">提取码</label>
              <input
                type="text"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="可选"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">资源链接</label>
              <input
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="可选，例如hdhive、豆瓣、IMDB 链接"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">分类 *</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'tv', label: '电视剧' },
                  { id: 'movie', label: '电影' },
                  { id: 'variety', label: '综艺' },
                  { id: 'anime', label: '动漫' },
                  { id: 'other', label: '其他' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      category === cat.id
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            {enableCron && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">定时执行 (Cron 表达式)</label>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="例如：0 0 * * * (每天零点)"
                />
              </div>
            )}
          </div>
          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-12 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              开始转存
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">历史任务</h2>
          <div className="flex items-center gap-3">
            {isAuthenticated && tasks.length > 0 && (
              <button
                onClick={handleClearAllTasks}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                清空队列
              </button>
            )}
          </div>
        </div>
        
        {tasks.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center shadow-xl">
            <FolderOpen className="w-12 h-12 mb-4 text-zinc-700" />
            <p>暂无任务记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {tasks.map((task) => (
              <div className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 sm:p-5 shadow-xl transition-colors group ${task.is_pinned ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`p-3 rounded-xl shrink-0 ${task.is_pinned ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800/50 text-indigo-400'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg truncate">{task.name || '未命名'}</h3>
                        {task.resource_url && (
                          <a href={task.resource_url} target="_blank" rel="noopener noreferrer" title="查看资源链接">
                            <Film className="w-5 h-5 text-green-400 hover:text-green-300" />
                          </a>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium">
                          {categoryMap[task.category] || '其他'}
                        </span>
                        {task.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            已完成
                          </span>
                        ) : task.status === 'scanned' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <ScanText className="w-3 h-3" />
                            已扫描
                          </span>
                        ) : task.status === 'link_replaced' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <LinkIcon className="w-3 h-3" />
                            更换链接已完成
                          </span>
                        ) : task.status === 'running' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            执行中
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            <Clock className="w-3 h-3" />
                            等待中
                          </span>
                        )}
                      </div>
                      <a href={task.share_url} target="_blank" rel="noreferrer" className="text-sm text-indigo-400/80 hover:text-indigo-400 hover:underline truncate block">
                        {task.share_url}
                      </a>
                      <div className="text-xs text-zinc-500 flex items-center gap-1.5 pt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatInTimeZone(new Date(task.created_at), 'Asia/Shanghai', 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/50 mt-2 sm:mt-0">
                    <button
                      onClick={() => handlePinTask(task.id)}
                      className={`p-2 rounded-lg transition-colors ${task.is_pinned ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                      title={task.is_pinned ? "取消置顶" : "置顶任务"}
                    >
                      <Pin className={`w-5 h-5 ${task.is_pinned ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleRefreshIndex(task.id)}
                      className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                      title="扫描目录"
                    >
                      <ScanText className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleViewLogs(task.id)}
                      className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                      title="查看日志"
                    >
                      <Logs className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleOpenReplaceModal(task)}
                      className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                      title="更换链接"
                    >
                      <LinkIcon className="w-5 h-5" />
                    </button>
                    {!task.resource_url && isAuthenticated && (
                      <button
                        onClick={() => handleOpenResourceModal(task)}
                        className="p-2 text-zinc-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                        title="补充资源链接"
                      >
                        <Film className="w-5 h-5" />
                      </button>
                    )}
                    {isAuthenticated && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="删除记录"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                执行日志
              </h3>
              <button onClick={() => setIsLogModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-950 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">暂无日志记录</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-4 text-zinc-300 border-b border-zinc-800/50 pb-2">
                      <span className="text-zinc-500 shrink-0">[{formatInTimeZone(new Date(log.created_at), 'Asia/Shanghai', 'HH:mm:ss')}]</span>
                      <span className="break-all">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replace Link Modal */}
      {isReplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-amber-400" />
                更换分享链接
              </h3>
              <button onClick={() => setIsReplaceModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleReplaceLink} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">新分享链接</label>
                <input
                  type="url"
                  required
                  value={replaceShareUrl}
                  onChange={(e) => setReplaceShareUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="https://115cdn.com/s/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">新提取码</label>
                <input
                  type="text"
                  value={replaceShareCode}
                  onChange={(e) => setReplaceShareCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="可选"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReplaceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors shadow-lg shadow-amber-500/20"
                >
                  更新并执行
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Resource Link Modal */}
      {isResourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-green-400" />
                补充资源链接
              </h3>
              <button onClick={() => setIsResourceModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateResourceUrl} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">资源链接</label>
                <input
                  type="url"
                  required
                  value={newResourceUrl}
                  onChange={(e) => setNewResourceUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="例如hdhive、豆瓣、IMDB 链接"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-colors shadow-lg shadow-green-500/20"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
