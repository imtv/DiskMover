import React, { useState, useEffect } from 'react';
import { Play, Trash2, FileText, FolderOpen, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
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
  const [category, setCategory] = useState('other');
  const [cronExpr, setCronExpr] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchPublicSettings();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

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
    setIsSubmitting(true);
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, share_url: shareUrl, share_code: shareCode, category, cron_expr: cronExpr }),
    });
    setName('');
    setShareUrl('');
    setShareCode('');
    setCronExpr('');
    setIsSubmitting(false);
    fetchTasks();
  };

  const handleDeleteTask = async (id: number) => {
    if (confirm('确定要删除此任务吗？')) {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    }
  };

  const handleRunTask = async (id: number) => {
    await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
    fetchTasks();
  };

  const handleViewLogs = async (id: number) => {
    setCurrentTaskId(id);
    const res = await fetch(`/api/tasks/${id}/logs`);
    const data = await res.json();
    setLogs(data);
    setIsLogModalOpen(true);
  };

  const handleClearAllTasks = async () => {
    if (!confirm('⚠️ 警告：确定要清空所有任务吗？\n此操作将删除所有任务记录并停止相关定时器，且不可恢复！')) return;
    await fetch('/api/tasks', { method: 'DELETE' });
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">115网盘</h1>
        <p className="text-zinc-400">提交 115 分享链接，系统将自动帮您转存并重命名</p>
      </div>

      {/* Create Task Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-6">
        <form onSubmit={handleCreateTask} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">115 分享链接 *</label>
              <input
                type="url"
                required
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://115.com/s/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">影片名 (重命名为) *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例如：我的电影合集"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">提取码</label>
              <input
                type="text"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="可选，未填写将尝试自动解析"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">分类</label>
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
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              开始转存
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">历史任务</h2>
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
        
        {tasks.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center shadow-xl">
            <FolderOpen className="w-12 h-12 mb-4 text-zinc-700" />
            <p>暂无任务记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl hover:border-zinc-700 transition-colors group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="p-3 bg-zinc-800/50 rounded-xl text-indigo-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-100 text-lg truncate">{task.name || '未命名'}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-xs font-medium">
                          {categoryMap[task.category] || '其他'}
                        </span>
                        {task.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            已完成
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
                        {format(new Date(task.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/50 mt-2 sm:mt-0">
                    <button
                      onClick={() => handleRefreshIndex(task.id)}
                      className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                      title="扫描目录"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    {isAuthenticated && (
                      <button
                        onClick={() => handleRunTask(task.id)}
                        className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                        title="重新执行"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleViewLogs(task.id)}
                      className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                      title="查看日志"
                    >
                      <FileText className="w-5 h-5" />
                    </button>
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
                      <span className="text-zinc-500 shrink-0">[{format(new Date(log.created_at), 'HH:mm:ss')}]</span>
                      <span className="break-all">{log.message}</span>
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
