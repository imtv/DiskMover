import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cron from 'node-cron';
import service115 from './src/services/service115';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('app.db');

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default admin if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', 'admin123');
}

// Default settings
const defaultSettings: Record<string, string> = {
  cookie_115: '',
  cat_tv_cid: '0', cat_tv_name: '电视剧',
  cat_movie_cid: '0', cat_movie_name: '电影',
  cat_variety_cid: '0', cat_variety_name: '综艺',
  cat_anime_cid: '0', cat_anime_name: '动漫',
  cat_other_cid: '0', cat_other_name: '其他',
  ol_url: '', ol_token: '', ol_mount_prefix: '',
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

async function refreshOpenList(targetCid: string) {
  const settings = getSettings();
  if (!settings.ol_url || !settings.ol_token) {
      return { success: false, msg: "OpenList 未配置" };
  }

  try {
      const pathRes = await service115.getPath(settings.cookie_115, targetCid);
      if (!pathRes.success || !pathRes.path) {
          return { success: false, msg: "获取目标路径失败" };
      }

      let fullPath = pathRes.path.map((p: any) => p.name).join('/');
      if (fullPath.startsWith('根目录/')) {
          fullPath = fullPath.substring(4);
      }
      
      const prefix = settings.ol_mount_prefix || '';
      const scanPath = prefix ? `${prefix}/${fullPath}` : `/${fullPath}`;

      console.log(`[OpenList] 准备扫描路径: ${scanPath}`);

      const res = await axios.post(`${settings.ol_url}/api/fs/scan`, {
          path: scanPath
      }, {
          headers: {
              'Authorization': settings.ol_token,
              'Content-Type': 'application/json'
          }
      });

      if (res.data.code === 200) {
          return { success: true, msg: "扫描请求已发送" };
      } else {
          return { success: false, msg: res.data.message || "扫描请求失败" };
      }
  } catch (e: any) {
      return { success: false, msg: "请求 OpenList 异常: " + e.message };
  }
}

async function executeTask(taskId: number, isCron = false) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
  if (!task) return;

  const settings = getSettings();
  const cookie = settings.cookie_115;

  const log = (msg: string) => {
    db.prepare('INSERT INTO logs (task_id, message) VALUES (?, ?)').run(taskId, msg);
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

  const todayStr = new Date().toISOString().split('T')[0];

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

    const currentShareHash = fileIds.join(',');

    if (isCron && task.last_share_hash && task.last_share_hash === currentShareHash) {
      log(`内容无更新，跳过转存`);
      updateStatus('pending');
      return; 
    }

    db.prepare("UPDATE tasks SET last_share_hash = ? WHERE id = ?").run(currentShareHash, taskId);

    // Clean old versions
    if (task.last_saved_file_ids) {
      const oldIds = JSON.parse(task.last_saved_file_ids);
      if (oldIds.length > 0) {
        log(`正在清理旧版本文件: ${oldIds.length} 个`);
        await service115.deleteFiles(cookie, oldIds);
      }
    }

    // Determine target CID based on category
    let targetCid = '0';
    let targetName = '根目录';
    if (task.category === 'tv') { targetCid = settings.cat_tv_cid; targetName = settings.cat_tv_name; }
    else if (task.category === 'movie') { targetCid = settings.cat_movie_cid; targetName = settings.cat_movie_name; }
    else if (task.category === 'variety') { targetCid = settings.cat_variety_cid; targetName = settings.cat_variety_name; }
    else if (task.category === 'anime') { targetCid = settings.cat_anime_cid; targetName = settings.cat_anime_name; }
    else if (task.category === 'other') { targetCid = settings.cat_other_cid; targetName = settings.cat_other_name; }

    let finalTargetCid = targetCid;
    let createdFolderId = null;

    const isSingleFolder = shareInfo.list.length === 1 && !!shareInfo.list[0].cid;

    if (!isSingleFolder) {
      const folderName = task.name;
      log(`检测到散文件，正在创建文件夹: ${folderName}`);
      const createRes = await service115.addFolder(cookie, targetCid, folderName);
      if (createRes.success) {
          finalTargetCid = createRes.cid;
          createdFolderId = createRes.cid;
          log(`文件夹就绪 (CID: ${finalTargetCid})`);
      } else {
          throw new Error(createRes.msg);
      }
    }

    const saveResult = await service115.saveFiles(cookie, finalTargetCid, extractShareCode(task.share_url).code, task.share_code, fileIds);

    if (saveResult.success) {
      db.prepare("UPDATE tasks SET last_success_date = ? WHERE id = ?").run(todayStr, taskId);
      log(`成功保存到${targetName}路径`);

      await new Promise(resolve => setTimeout(resolve, 3000));

      let savedIds: string[] = [];

      if (createdFolderId) {
          savedIds = [createdFolderId];
      } else {
          const recent = await service115.getRecentItems(cookie, targetCid, 10);
          if (recent.success && recent.items.length > 0) {
              if (saveResult.count === 1 && recent.items[0].isFolder && task.name) {
                  const item = recent.items[0];
                  savedIds = [item.id];

                  if (item.name !== task.name) {
                      try {
                          const listRes = await service115.getFolderList(cookie, targetCid, 1000);
                          if (listRes.success && listRes.list) {
                              const existing = listRes.list.find((f: any) => f.name === task.name);
                              if (existing) {
                                  log(`发现同名文件/文件夹 [${existing.name}]，正在删除旧文件...`);
                                  await service115.deleteFiles(cookie, [existing.id]);
                                  log(`删除旧同名文件: ${task.name}`);
                                  await new Promise(resolve => setTimeout(resolve, 2000)); 
                              }
                          }
                      } catch (e) {
                          console.warn("[Task] 检查同名文件失败:", e);
                      }

                      await service115.renameFile(cookie, item.id, task.name);
                      log(`成功修改文件夹名称: ${task.name}`);
                  }
              } else {
                  savedIds = recent.items.slice(0, saveResult.count).map((i: any) => i.id);
              }
          }
      }

      db.prepare("UPDATE tasks SET last_saved_file_ids = ? WHERE id = ?").run(JSON.stringify(savedIds), taskId);

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
          const olRes = await refreshOpenList(targetCid);
          if (olRes.success) {
            log(`成功扫描 OpenList 生成 STRM`);
          } else {
            log(`OpenList 扫描失败: ${olRes.msg}`);
          }
      } catch (e) {
          log(`OpenList 扫描失败`);
      }
      
      updateStatus(isCron ? 'pending' : 'completed');

    } else if (saveResult.status === 'exists') {
      log(`文件已存在(115自动去重)`);
      updateStatus(isCron ? 'pending' : 'completed');
    } else {
      log(`转存失败: ${saveResult.msg}`);
      updateStatus(isCron ? 'pending' : 'error');
    }

  } catch (e: any) {
    log(`执行出错: ${e.message}`);
    updateStatus(isCron ? 'pending' : 'error');
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
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ success: true, user: { id: (user as any).id, username: (user as any).username } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
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
        const folders = result.list.filter((item: any) => item.isFolder).map((item: any) => ({
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
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    res.json(tasks);
  });

  app.post('/api/tasks', (req, res) => {
    const { name, share_url, share_code, category, cron_expr } = req.body;
    
    const urlInfo = extractShareCode(share_url);
    const finalShareCode = urlInfo.code;
    // We store the password in share_code if it was provided, else extract it
    const receiveCode = share_code || urlInfo.password;

    const stmt = db.prepare('INSERT INTO tasks (name, share_url, share_code, category, cron_expr) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(name, share_url, receiveCode, category, cron_expr);
    const taskId = info.lastInsertRowid as number;
    
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    startCronJob(task);

    // Trigger execution asynchronously
    setTimeout(() => executeTask(taskId, false), 100);

    res.json({ success: true, id: taskId });
  });

  // Extract execution logic into a function
  async function executeTask(taskId: number, isCron = false) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return;

    const settings = getSettings();
    const cookie = settings.cookie_115;

    const log = (msg: string) => {
      db.prepare('INSERT INTO logs (task_id, message) VALUES (?, ?)').run(taskId, msg);
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

    const todayStr = new Date().toISOString().split('T')[0];

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

      const currentShareHash = fileIds.join(',');

      if (isCron && task.last_share_hash && task.last_share_hash === currentShareHash) {
        log(`内容无更新，跳过转存`);
        updateStatus('pending');
        return; 
      }

      db.prepare("UPDATE tasks SET last_share_hash = ? WHERE id = ?").run(currentShareHash, taskId);

      // Clean old versions
      if (task.last_saved_file_ids) {
        const oldIds = JSON.parse(task.last_saved_file_ids);
        if (oldIds.length > 0) {
          log(`正在清理旧版本文件: ${oldIds.length} 个`);
          await service115.deleteFiles(cookie, oldIds);
        }
      }

      // Determine target CID based on category
      let targetCid = '0';
      let targetName = '根目录';
      if (task.category === 'tv') { targetCid = settings.cat_tv_cid; targetName = settings.cat_tv_name; }
      else if (task.category === 'movie') { targetCid = settings.cat_movie_cid; targetName = settings.cat_movie_name; }
      else if (task.category === 'variety') { targetCid = settings.cat_variety_cid; targetName = settings.cat_variety_name; }
      else if (task.category === 'anime') { targetCid = settings.cat_anime_cid; targetName = settings.cat_anime_name; }
      else if (task.category === 'other') { targetCid = settings.cat_other_cid; targetName = settings.cat_other_name; }

      let finalTargetCid = targetCid;
      let createdFolderId = null;

      const isSingleFolder = shareInfo.list.length === 1 && !!shareInfo.list[0].cid;

      if (!isSingleFolder) {
        const folderName = task.name;
        log(`检测到散文件，正在创建文件夹: ${folderName}`);
        const createRes = await service115.addFolder(cookie, targetCid, folderName);
        if (createRes.success) {
            finalTargetCid = createRes.cid;
            createdFolderId = createRes.cid;
            log(`文件夹就绪 (CID: ${finalTargetCid})`);
        } else {
            throw new Error(createRes.msg);
        }
      }

      const saveResult = await service115.saveFiles(cookie, finalTargetCid, extractShareCode(task.share_url).code, task.share_code, fileIds);

      if (saveResult.success) {
        db.prepare("UPDATE tasks SET last_success_date = ? WHERE id = ?").run(todayStr, taskId);
        log(`成功保存到${targetName}路径`);

        await new Promise(resolve => setTimeout(resolve, 3000));

        let savedIds: string[] = [];

        if (createdFolderId) {
            savedIds = [createdFolderId];
        } else {
            const recent = await service115.getRecentItems(cookie, targetCid, 10);
            if (recent.success && recent.items.length > 0) {
                if (saveResult.count === 1 && recent.items[0].isFolder && task.name) {
                    const item = recent.items[0];
                    savedIds = [item.id];

                    if (item.name !== task.name) {
                        try {
                            const listRes = await service115.getFolderList(cookie, targetCid, 1000);
                            if (listRes.success && listRes.list) {
                                const existing = listRes.list.find((f: any) => f.name === task.name);
                                if (existing) {
                                    log(`发现同名文件/文件夹 [${existing.name}]，正在删除旧文件...`);
                                    await service115.deleteFiles(cookie, [existing.id]);
                                    log(`删除旧同名文件: ${task.name}`);
                                    await new Promise(resolve => setTimeout(resolve, 2000)); 
                                }
                            }
                        } catch (e) {
                            console.warn("[Task] 检查同名文件失败:", e);
                        }

                        await service115.renameFile(cookie, item.id, task.name);
                        log(`成功修改文件夹名称: ${task.name}`);
                    }
                } else {
                    savedIds = recent.items.slice(0, saveResult.count).map((i: any) => i.id);
                }
            }
        }

        db.prepare("UPDATE tasks SET last_saved_file_ids = ? WHERE id = ?").run(JSON.stringify(savedIds), taskId);

        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const olRes = await refreshOpenList(targetCid);
            if (olRes.success) {
              log(`成功扫描 OpenList 生成 STRM`);
            } else {
              log(`OpenList 扫描失败: ${olRes.msg}`);
            }
        } catch (e) {
            log(`OpenList 扫描失败`);
        }
        
        updateStatus(isCron ? 'pending' : 'completed');

      } else if (saveResult.status === 'exists') {
        log(`文件已存在(115自动去重)`);
        updateStatus(isCron ? 'pending' : 'completed');
      } else {
        log(`转存失败: ${saveResult.msg}`);
        updateStatus(isCron ? 'pending' : 'error');
      }

    } catch (e: any) {
      log(`执行出错: ${e.message}`);
      updateStatus(isCron ? 'pending' : 'error');
    }
  }

  app.delete('/api/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    if (cronJobs[taskId]) {
      cronJobs[taskId].stop();
      delete cronJobs[taskId];
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    res.json({ success: true });
  });

  app.post('/api/tasks/:id/run', (req, res) => {
    const taskId = parseInt(req.params.id);
    executeTask(taskId, false);
    res.json({ success: true, message: 'Task execution triggered' });
  });

  app.get('/api/tasks/:id/logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM logs WHERE task_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(logs);
  });

  app.post('/api/tasks/:id/refresh-index', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!task) return res.status(404).json({ success: false, msg: "任务不存在" });

    const settings = getSettings();
    let targetCid = '0';
    if (task.category === 'tv') targetCid = settings.cat_tv_cid;
    else if (task.category === 'movie') targetCid = settings.cat_movie_cid;
    else if (task.category === 'variety') targetCid = settings.cat_variety_cid;
    else if (task.category === 'anime') targetCid = settings.cat_anime_cid;
    else if (task.category === 'other') targetCid = settings.cat_other_cid;

    try {
        const result = await refreshOpenList(targetCid);
        const time = new Date().toISOString();
        if (result.success) {
            db.prepare('INSERT INTO logs (task_id, message) VALUES (?, ?)').run(taskId, `✅ [${time}] 手动扫描: 成功`);
        } else {
            db.prepare('INSERT INTO logs (task_id, message) VALUES (?, ?)').run(taskId, `❌ [${time}] 手动扫描: 失败`);
        }
        res.json(result);
    } catch (e: any) {
        const time = new Date().toISOString();
        db.prepare('INSERT INTO logs (task_id, message) VALUES (?, ?)').run(taskId, `❌ [${time}] 手动扫描: 错误`);
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

    const settings = getSettings();
    if (!settings.ol_url || !settings.ol_token) {
        return res.status(400).json({ success: false, msg: "OpenList 未配置" });
    }

    try {
        const result = await axios.post(`${settings.ol_url}/api/fs/scan`, {
            path: scanPath
        }, {
            headers: {
                'Authorization': settings.ol_token,
                'Content-Type': 'application/json'
            }
        });

        if (result.data.code === 200) {
            res.json({ success: true, msg: "扫描请求已发送" });
        } else {
            res.status(500).json({ success: false, msg: result.data.message || "扫描请求失败" });
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
