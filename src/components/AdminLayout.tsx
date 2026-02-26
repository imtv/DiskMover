import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, LogOut, Cloud, ArrowLeft } from 'lucide-react';

export default function AdminLayout() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-50">
      <aside className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-4 md:p-6 flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight">管理后台</h1>
          </div>
          <button 
            onClick={logout}
            className="md:hidden p-2 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible px-2 md:px-4 pb-2 md:pb-0 space-x-2 md:space-x-0 md:space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Link
            to="/admin/system"
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-colors whitespace-nowrap ${
              location.pathname.includes('/system')
                ? 'bg-indigo-500/10 text-indigo-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-medium text-sm md:text-base">系统设置</span>
          </Link>
          <Link
            to="/admin/115"
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-colors whitespace-nowrap ${
              location.pathname.includes('/115')
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Cloud className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-medium text-sm md:text-base">115网盘配置</span>
          </Link>
          <Link
            to="/admin/openlist"
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-colors whitespace-nowrap ${
              location.pathname.includes('/openlist')
                ? 'bg-amber-500/10 text-amber-400' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-medium text-sm md:text-base">OpenList配置</span>
          </Link>
          
          <Link
            to="/"
            className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-colors text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-medium text-sm md:text-base">返回首页</span>
          </Link>
        </nav>

        <div className="hidden md:block p-4 border-t border-zinc-800 mt-auto">
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
        <div className="px-[5px] py-[10px] md:p-8 max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
