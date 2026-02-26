import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';

process.env.TZ = 'Asia/Shanghai';

import { fileURLToPath } from 'url';
import * as cron from 'node-cron';
import service115 from './src/services/service115.js';
import axios from 'axios';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || 'app.db';
const dbDir = path.dirname(dbPath);

if (dbDir !== '.' && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

function getCSTNow() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).replace(/\//g, '-');
}

const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    share_url TEXT,
    share_code TEXT,
    category TEXT,
    cron_expr TEXT,
    status TEXT DEFAULT 'pending',
    last_share_hash TEXT,
    last_saved_file_ids TEXT,
    last_success_date TEXT,
    executed_share_urls TEXT DEFAULT '[]',
    created_at DATETIME,
    updated_at DATETIME,
    is_pinned INTEGER DEFAULT 0,
    resource_url TEXT
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    message TEXT,
    created_at DATETIME
  );
`);

// Migration: Add resource_url column if not exists
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN resource_url TEXT').run();
} catch (e) {
  // Column likely already exists
}

// Insert default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', 'admin123');
}

// Default settings
const defaultSettings: Record<string, string> = {
  cookie_115: '',
  cat_tv_cid: '0', cat_tv_name: '电视剧', cat_tv_path: '',
  cat_movie_cid: '0', cat_movie_name: '电影', cat_movie_path: '',
  cat_variety_cid: '0', cat_variety_name: '综艺', cat_variety_path: '',
  cat_anime_cid: '0', cat_anime_name: '动漫', cat_anime_path: '',
  cat_other_cid: '0', cat_other_name: '其他', cat_other_path: '',
  ol_url: '', ol_token: '', ol_mount_prefix: '',
  ol_115_mount_point: '', // OpenList's mount point for 115 (e.g. /115Drive)
  root_115_path: '', // The real 115 root path corresponding to the mount point (e.g. /Root/Videos-115)
  enable_cron: 'false'
};

function getSettings() {
  const rows = db.prepare('SELECT * FROM settings').all() as { key: string, value: string }[];
  const settings = { ...defaultSettings };
  rows.forEach(row => { settings[row.key] = row.value; });
  return settings;
}

const cronJobs: Record<number, cron.ScheduledTask> = {};

function startCronJob(task: any) {
  if (cronJobs[task.id]) {
    cronJobs[task.id].stop();
    delete cronJobs[task.id];
  }

  if (!task.cron_expr || !cron.validate(task.cron_expr)) {
    return;
  }

  console.log(`[Cron] 启动/重启任务 ${task.name}: ${task.cron_expr}`);
  
  cronJobs[task.id] = cron.schedule(task.cron_expr, () => {
    executeTask(task.id, true);
  });
}

function initCronJobs() {
  const tasks = db.prepare("SELECT * FROM tasks WHERE cron_expr IS NOT NULL AND cron_expr != ''").all();
  tasks.forEach(task => startCronJob(task));
}

// Extract share code and password from URL
function extractShareCode(url: string) {
  let code = "";
  let password = "";
  try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      code = pathParts[pathParts.length - 1];
      password = urlObj.searchParams.get('password') || "";
  } catch (e) {
      const match = url.match(/s\/([a-zA-Z0-9]+)/);
      if (match) code = match[1];
      const passMatch = url.match(/password=([a-zA-Z0-9]+)/);
      if (passMatch) password = passMatch[1];
  }
  return { code, password };
}

// Helper for Path Mapping
function applyPathMapping(fullPath: string, settings: any): string {
    if (settings.root_115_path && settings.ol_115_mount_point) {
        const rootPath = settings.root_115_path.replace(/\/$/, '');
        const mountPoint = settings.ol_115_mount_point.replace(/\/$/, '');
        
        if (fullPath.startsWith(rootPath)) {
            const mapped = fullPath.replace(rootPath, mountPoint);
            console.log(`[PathMap] 应用映射: ${fullPath} -> ${mapped}`);
            return mapped;
        }
    }
    return fullPath;
}

async function executeTask(taskId: number, isCron = false, successStatus = 'completed') {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) return;

  const settings = getSettings();
  const cookie = settings.cookie_115;

  const log = (msg: string) => {
    db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, msg, getCSTNow());
    console.log(`[Task ${taskId}] ${msg}`);
  };

  const updateStatus = (status: string) => {
    db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, taskId);
  };

  if (!cookie) {
    log(`Cookie配置缺失或失效`);
    updateStatus(isCron ? 'pending' : 'error');
    return;
  }

  const todayStr = getCSTNow().split(' ')[0];

  if (isCron && task.status === 'pending' && task.last_success_date === todayStr) {
    log(`今日已成功转存，跳过本次执行`);
    return; 
  }

  updateStatus('running');
  log(`开始执行项目转存: ${task.name || '未命名'}`);

  try {
    let shareInfo = await service115.getShareInfo(cookie, extractShareCode(task.share_url).code, task.share_code);
    log(`成功读取分享链接: ${shareInfo.shareTitle}`);

    const fileIds = shareInfo.fileIds;

    if (!fileIds || fileIds.length === 0) {
      log(`分享链接内无文件`);
      updateStatus(isCron ? 'pending' : 'error');
      return; 
    }

    // Determine target CID and Path based on category
    let targetCid = '0';
    let targetName = '根目录';
    let targetPath = '';
    
    if (task.category === 'tv') { 
        targetCid = settings.cat_tv_cid; 
        targetName = settings.cat_tv_name; 
        targetPath = settings.cat_tv_path;
    }
    else if (task.category === 'movie') { 
        targetCid = settings.cat_movie_cid; 
        targetName = settings.cat_movie_name; 
        targetPath = settings.cat_movie_path;
    }
    else if (task.category === 'variety') { 
        targetCid = settings.cat_variety_cid; 
        targetName = settings.cat_variety_name; 
        targetPath = settings.cat_variety_path;
    }
    else if (task.category === 'anime') { 
        targetCid = settings.cat_anime_cid; 
        targetName = settings.cat_anime_name; 
        targetPath = settings.cat_anime_path;
    }
    else if (task.category === 'other') { 
        targetCid = settings.cat_other_cid; 
        targetName = settings.cat_other_name; 
        targetPath = settings.cat_other_path;
    }

    // Step 1: Check if folder exists and delete it
    log(`检查目标路径下是否存在同名文件夹: ${task.name}`);
    try {
        const listRes = await service115.getFolderList(cookie, targetCid, 1000);
        if (listRes.success && listRes.list) {
            const existing = listRes.list.find((f: any) => f.name === task.name);
            if (existing) {
                log(`发现已存在同名文件夹/文件 [${existing.name}] (CID/FID: ${existing.id})，正在删除...`);
                const delRes = await service115.deleteFiles(cookie, [existing.id]);
                if (delRes.success) {
                    log(`删除成功`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion to propagate
                } else {
                    log(`删除失败: ${delRes.msg}`);
                    throw new Error(`无法删除已存在的同名文件夹: ${delRes.msg}`);
                }
            } else {
                log(`未发现同名文件夹，继续执行`);
            }
        }
    } catch (e: any) {
        log(`检查同名文件夹失败: ${e.message}`);
        // Continue anyway? Or stop? Let's continue but warn.
    }

    // Step 2: Save files
    log(`开始转存文件...`);
    
    // Logic: 
    // If share has 1 folder -> Save it directly to targetCid. Then rename it to task.name.
    // If share has multiple files/folders -> Create folder task.name in targetCid. Save files into that new folder.

    let finalTargetCid = targetCid;
    let createdFolderId = null;
    let isMultiFile = shareInfo.list.length > 1 || (shareInfo.list.length === 1 && shareInfo.list[0].fid); // Multiple items OR single file (not folder)

    if (isMultiFile) {
        log(`资源为零散文件或多个文件，创建文件夹: ${task.name}`);
        const createRes = await service115.addFolder(cookie, targetCid, task.name);
        if (createRes.success) {
            finalTargetCid = createRes.cid;
            createdFolderId = createRes.cid;
            log(`文件夹创建成功 (CID: ${finalTargetCid})`);
        } else {
            throw new Error(`创建文件夹失败: ${createRes.msg}`);
        }
    }

    const saveResult = await service115.saveFiles(cookie, finalTargetCid, extractShareCode(task.share_url).code, task.share_code, fileIds);

    if (saveResult.success) {
        db.prepare("UPDATE tasks SET last_success_date = ? WHERE id = ?").run(todayStr, taskId);
        
        // Add current URL to executed list
        const currentUrls = JSON.parse(task.executed_share_urls || '[]');
        if (!currentUrls.includes(task.share_url)) {
            currentUrls.push(task.share_url);
            db.prepare('UPDATE tasks SET executed_share_urls = ? WHERE id = ?').run(JSON.stringify(currentUrls), taskId);
        }

        log(`成功保存文件`);

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 3: Rename if needed (Only if we saved a single folder directly to targetCid)
        if (!isMultiFile) {
            // We saved a single folder. We need to find it and rename it to task.name
            // Since we deleted the old one, the new one should be the one we just saved.
            // But 115 saveFiles doesn't return the new CID. We have to find it.
            // It should be the most recent folder in targetCid.
            
            const recent = await service115.getRecentItems(cookie, targetCid, 20);
            if (recent.success && recent.items.length > 0) {
                // Find the folder that matches the share content name (roughly) or just take the newest one?
                // The share info has the name.
                const sharedItemName = shareInfo.list[0].n;
                const savedItem = recent.items.find((i: any) => i.name === sharedItemName);
                
                if (savedItem) {
                    if (savedItem.name !== task.name) {
                        log(`正在重命名: ${savedItem.name} -> ${task.name}`);
                        const renameRes = await service115.renameFile(cookie, savedItem.id, task.name);
                        if (renameRes.success) {
                            log(`重命名成功`);
                        } else {
                            log(`重命名失败: ${renameRes.msg}`);
                        }
                    }
                } else {
                    log(`警告: 未能在目标目录找到刚转存的文件夹 [${sharedItemName}]，可能需要手动重命名`);
                }
            }
        }

        // Step 4: OpenList Scan
        if (targetPath) {
             let fullPath115 = targetPath.endsWith('/') ? targetPath + task.name : targetPath + '/' + task.name;
             log(`文件保存完整路径: ${fullPath115}`);

             const scanPath = applyPathMapping(fullPath115, settings);
             log(`开始扫描 OpenList 路径: ${scanPath}`);

             const olRes = await refreshOpenListPath(scanPath, taskId); 
             if (olRes.success) {
                log(`OpenList 扫描请求成功`);
             } else {
                log(`OpenList 扫描失败: ${olRes.msg}`);
             }
        } else {
            log(`未配置分类路径，跳过 OpenList 精确扫描 (仅支持 CID 扫描可能不准确)`);
        }
      
        updateStatus(isCron ? 'pending' : successStatus);
        log(`任务执行完成`);

    } else if (saveResult.status === 'exists') {
      log(`文件已存在(115自动去重)`);
      updateStatus(isCron ? 'pending' : successStatus);
    } else {
      log(`转存失败: ${saveResult.msg}`);
      updateStatus(isCron ? 'pending' : 'error');
    }

  } catch (e: any) {
    log(`执行出错: ${e.message}`);
    updateStatus(isCron ? 'pending' : 'error');
  }
}

// Helper for OpenList Path Scan
async function refreshOpenListPath(path: string, taskId?: number) {
    const settings = getSettings();
    if (!settings.ol_url || !settings.ol_token) {
        return { success: false, msg: "OpenList 未配置" };
    }
    
    // Ensure path starts with / if not
    if (!path.startsWith('/')) path = '/' + path;

    // Remove double slashes
    path = path.replace(/\/\//g, '/');

    const baseUrl = settings.ol_url.replace(/\/$/, "");
    const headers = {
        'Authorization': settings.ol_token,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Force Refresh (to clear cache and detect new files)
        // API: /api/fs/list
        // Body: { path: "/path/to/dir", password: "", page: 1, per_page: 0, refresh: true }
        
        // Calculate parent path for refresh
        // e.g. /Videos-115/影集/除恶 -> /Videos-115/影集
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    const log = (msg: string) => {
        if (taskId) {
          db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, msg, getCSTNow());
        }
        console.log(`[Task ${taskId || 'N/A'}] ${msg}`);
    };

        log(`[OpenList] 正在强制刷新父路径: ${parentPath}`);
        try {
            await axios.post(`${baseUrl}/api/fs/list`, {
                path: parentPath,
                password: "",
                page: 1,
                per_page: 0,
                refresh: true
            }, { headers, timeout: 10000 });
            log(`[OpenList] 强制刷新请求成功`);
        } catch (e: any) {
            log(`[OpenList] 强制刷新失败 (可能不影响后续扫描): ${e.message}`);
            // Don't return error here, continue to scan
        }

        // Delay to allow refresh to propagate
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 2. Scan Index
        log(`[OpenList] 开始扫描路径: ${path}`);
        const res = await axios.post(`${baseUrl}/api/admin/scan/start`, {
            path: path,
            limit: 0
        }, { headers, timeout: 10000 });

        if (res.data.code === 200) {
            return { success: true, msg: "扫描请求已发送" };
        } else {
            if (res.data.code === 404 && res.data.message && res.data.message.includes("search not available")) {
                return { success: false, msg: "OpenList未开启索引功能，请去后台开启！" };
            }
            return { success: false, msg: `API错误: ${res.data.message} (Code: ${res.data.code})` };
        }
    } catch (e: any) {
        return { success: false, msg: "请求 OpenList 异常: " + e.message };
    }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  initCronJobs();

  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // First check if there are any settings overrides
    const settings = getSettings();
    const adminUser = settings.admin_username || 'admin';
    const adminPass = settings.admin_password || 'admin123';

    if (username === adminUser && password === adminPass) {
       // We don't really use the users table for single admin anymore, but let's keep it consistent
       res.json({ success: true, user: { username: adminUser } });
    } else {
       // Fallback to DB users table if settings match fails (legacy support)
       const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
       if (user) {
         res.json({ success: true, user: { id: (user as any).id, username: (user as any).username } });
       } else {
         res.status(401).json({ error: 'Invalid credentials' });
       }
    }
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    res.json(getSettings());
  });

  app.get('/api/public-settings', (req, res) => {
    const settings = getSettings();
    res.json({ 
      enable_cron: settings.enable_cron === 'true',
      cat_tv_name: settings.cat_tv_name,
      cat_movie_name: settings.cat_movie_name,
      cat_variety_name: settings.cat_variety_name,
      cat_anime_name: settings.cat_anime_name,
      cat_other_name: settings.cat_other_name
    });
  });

  app.post('/api/settings', (req, res) => {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) stmt.run(key, String(value));
      }
    })();
    res.json({ success: true });
  });

  app.post('/api/115/folders', async (req, res) => {
    const { cookie, cid = '0' } = req.body;
    if (!cookie) return res.status(400).json({ success: false, msg: 'Cookie is required' });
    try {
      const result = await service115.getFolderList(cookie, cid, 1000);
      if (result.success) {
        // Filter only folders
        const folders = result.list.filter((item: any) => item.type === 'folder').map((item: any) => ({
          id: item.id,
          name: item.name,
          cid: item.cid
        }));
        res.json({ success: true, folders });
      } else {
        res.status(500).json({ success: false, msg: (result as any).msg || 'Failed to fetch folders' });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, msg: e.message });
    }
  });

  // Tasks
  app.get('/api/tasks', (req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY is_pinned DESC, created_at DESC').all();
    res.json(tasks);
  });

  app.post('/api/tasks/:id/pin', (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = db.prepare('SELECT is_pinned FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const newPinned = task.is_pinned ? 0 : 1;
    db.prepare('UPDATE tasks SET is_pinned = ? WHERE id = ?').run(newPinned, taskId);
    res.json({ success: true, is_pinned: newPinned });
  });

  app.post('/api/tasks', (req, res) => {
    const { name, share_url, share_code, category, cron_expr, resource_url } = req.body;

    // Check for uniqueness across all tasks
    const allTasks = db.prepare('SELECT executed_share_urls FROM tasks').all() as { executed_share_urls: string }[];
    const isExecuted = allTasks.some(t => {
        const urls = JSON.parse(t.executed_share_urls || '[]');
        return urls.includes(share_url);
    });

    if (isExecuted) {
        return res.status(400).json({ success: false, msg: '此分享链接已被其他任务成功执行过，无法重复添加。' });
    }

    const urlInfo = extractShareCode(share_url);
    const finalShareCode = urlInfo.code;
    // We store the password in share_code if it was provided, else extract it
    const receiveCode = share_code || urlInfo.password;

    const stmt = db.prepare('INSERT INTO tasks (name, share_url, share_code, category, cron_expr, resource_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(name, share_url, receiveCode, category, cron_expr, resource_url, getCSTNow(), getCSTNow());
    const taskId = info.lastInsertRowid as number;
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    startCronJob(task);

    // Trigger execution asynchronously
    setTimeout(() => executeTask(taskId, false), 100);

    res.json({ success: true, id: taskId });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    if (cronJobs[taskId]) {
      cronJobs[taskId].stop();
      delete cronJobs[taskId];
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    res.json({ success: true });
  });

  app.post('/api/tasks/:id/replace-link', (req, res) => {
    const { share_url, share_code } = req.body;
    const taskId = Number(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Check for uniqueness across all tasks
    const allTasks = db.prepare('SELECT id, executed_share_urls FROM tasks').all() as { id: number, executed_share_urls: string }[];
    const isExecuted = allTasks.some(t => {
        // Don't check against the current task's own history if it's the same task
        if (t.id === taskId) return false;
        const urls = JSON.parse(t.executed_share_urls || '[]');
        return urls.includes(share_url);
    });

    if (isExecuted) {
        return res.status(400).json({ success: false, msg: '此分享链接已被其他任务成功执行过，无法使用。' });
    }

    const urlInfo = extractShareCode(share_url);
    const finalShareCode = share_code || urlInfo.password;

    db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(req.params.id, '[系统] 更换链接并重新执行', getCSTNow());

    db.prepare('UPDATE tasks SET share_url = ?, share_code = ?, status = ?, last_share_hash = NULL, updated_at = ? WHERE id = ?')
      .run(share_url, finalShareCode, 'link_replaced', getCSTNow(), req.params.id);
    
    // Trigger execution immediately
    executeTask(taskId, false, 'link_replaced');
    
    res.json({ success: true });
  });

  app.patch('/api/tasks/:id/resource-url', (req, res) => {
    const { resource_url } = req.body;
    const taskId = Number(req.params.id);
    if (!taskId) return res.status(400).json({ error: 'Invalid task ID' });

    try {
      db.prepare('UPDATE tasks SET resource_url = ? WHERE id = ?').run(resource_url, taskId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/tasks/:id/run', (req, res) => {
    const taskId = parseInt(req.params.id);
    executeTask(taskId, false);
    res.json({ success: true, message: 'Task execution triggered' });
  });

  app.get('/api/tasks/:id/logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM logs WHERE task_id = ? ORDER BY created_at ASC').all(req.params.id);
    res.json(logs);
  });

  app.post('/api/tasks/:id/logs', (req, res) => {
    const { message } = req.body;
    db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(req.params.id, message, getCSTNow());
    res.json({ success: true });
  });

  app.post('/api/tasks/:id/refresh-index', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ success: false, msg: "任务不存在" });

    const settings = getSettings();
    let targetPath = '';
    if (task.category === 'tv') targetPath = settings.cat_tv_path;
    else if (task.category === 'movie') targetPath = settings.cat_movie_path;
    else if (task.category === 'variety') targetPath = settings.cat_variety_path;
    else if (task.category === 'anime') targetPath = settings.cat_anime_path;
    else if (task.category === 'other') targetPath = settings.cat_other_path;

    if (!targetPath) {
         const time = getCSTNow();
         db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, `❌ [${time}] 手动扫描: 失败 (未配置分类路径)`, time);
         return res.status(400).json({ success: false, msg: "未配置分类路径" });
    }

    let fullPath115 = targetPath.endsWith('/') ? targetPath + task.name : targetPath + '/' + task.name;
    let scanPath = applyPathMapping(fullPath115, settings);

    try {
        const result = await refreshOpenListPath(scanPath, taskId);
        const time = getCSTNow();
        if (result.success) {
            db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, `✅ [${time}] 手动扫描: 请求已发送 (${scanPath})`, time);
            db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run('scanned', time, taskId);
        } else {
            db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, `❌ [${time}] 手动扫描: 失败 (${result.msg})`, time);
        }
        res.json(result);
    } catch (e: any) {
        const time = getCSTNow();
        db.prepare('INSERT INTO logs (task_id, message, created_at) VALUES (?, ?, ?)').run(taskId, `❌ [${time}] 手动扫描: 错误`, time);
        res.status(500).json({ success: false, msg: e.message });
    }
  });

  let lastBaiduScanTime = 0;
  app.post('/api/scan/path', async (req, res) => {
    const { path: scanPath } = req.body;
    if (!scanPath) return res.status(400).json({ success: false, msg: "路径不能为空" });

    if (scanPath === '/百度网盘') {
        const now = Date.now();
        const cooldown = 3600 * 1000;
        if (now - lastBaiduScanTime < cooldown) {
            const waitMin = Math.ceil((cooldown - (now - lastBaiduScanTime)) / 60000);
            return res.status(429).json({ success: false, msg: `百度网盘扫描冷却中，请等待 ${waitMin} 分钟后再试` });
        }
        lastBaiduScanTime = now;
    }

    try {
        const result = await refreshOpenListPath(scanPath);
        if (result.success) {
            res.json({ success: true, msg: result.msg });
        } else {
            res.status(500).json({ success: false, msg: result.msg });
        }
    } catch (e: any) {
        res.status(500).json({ success: false, msg: e.message });
    }
  });

  app.delete('/api/tasks', (req, res) => {
    Object.keys(cronJobs).forEach(id => {
        if (cronJobs[parseInt(id)]) cronJobs[parseInt(id)].stop();
    });
    for (const key in cronJobs) delete cronJobs[key];
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM logs').run();
    res.json({ success: true, msg: "所有任务已清空" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
