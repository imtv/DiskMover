import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Cloud, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500 shrink-0" />
            <span className="font-bold text-base sm:text-lg tracking-tight truncate">网盘转存助手</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <Link to="/admin" className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap">
                进入后台
              </Link>
            ) : (
              <Link to="/login" className="text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">管理员登录</span>
                <span className="sm:hidden">登录</span>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
