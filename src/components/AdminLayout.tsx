import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, LogOut, Cloud, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [isScanning, setIsScanning] = useState(false);

  const handleScanBaidu = async () => {
    if (!confirm('确定要扫描 OpenList 的 /百度网盘 路径吗？')) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/scan/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/百度网盘' })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ 扫描请求已发送');
      } else {
        alert('❌ ' + (data.msg || data.error || '扫描失败'));
      }
    } catch (e: any) {
      alert('❌ 网络错误');
    }
    setIsScanning(false);
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <Cloud className="w-8 h-8 text-indigo-500" />
          <h1 className="text-xl font-bold tracking-tight">管理后台</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">返回首页</span>
          </Link>
          <div className="pt-4 pb-2 px-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">设置</p>
          </div>
          <Link
            to="/admin/system"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              location.pathname.includes('/system')
                ? 'bg-indigo-500/10 text-indigo-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">系统设置</span>
          </Link>
          <Link
            to="/admin/115"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              location.pathname.includes('/115')
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Cloud className="w-5 h-5" />
            <span className="font-medium">115网盘配置</span>
          </Link>
          <Link
            to="/admin/openlist"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              location.pathname.includes('/openlist')
                ? 'bg-amber-500/10 text-amber-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">OpenList配置</span>
          </Link>
          
          <div className="pt-4 pb-2 px-4">
             <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">操作</p>
          </div>
          <button
            onClick={handleScanBaidu}
            disabled={isScanning}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 text-left"
          >
            <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="font-medium">扫描百度网盘</span>
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
