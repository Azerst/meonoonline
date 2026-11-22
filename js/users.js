/* ==============================================
   USERS — User database module
   ⚠️ STABLE: Không đổi API khi update game
   ============================================== */
(function(window){
  'use strict';
  const S = window.Storage;

  const ADMIN_USERNAME = 'vanbacazerst.vn2908';
  const ADMIN_PASSWORD = 'aBc@2908vanbac0809';
  const ADMIN_SALT = 'ek_admin_salt_2024';

  function loadAll(){ return S.read(S.KEYS.USERS, {}); }
  function saveAll(db){ S.write(S.KEYS.USERS, db); }

  function findRealName(username, db){
    if (!username) return null;
    const target = String(username).trim().toLowerCase();
    for (const name of Object.keys(db)){
      if (name.toLowerCase() === target) return name;
    }
    return null;
  }

  function migrate(){
    if (S.readStr(S.KEYS.MIGRATED)) return;
    const db = loadAll();
    let changed = false;
    const oldKeys = ['ek_accounts_v7','ek_accounts_v6','ek_accounts_v5','ek_accounts_v4'];
    for (const oldKey of oldKeys){
      let oldDb;
      try {
        const raw = localStorage.getItem(oldKey);
        if (!raw) continue;
        oldDb = JSON.parse(raw);
      } catch(e){ continue; }
      for (const [name, data] of Object.entries(oldDb)){
        if (db[name] || !data || !data.password) continue;
        const salt = S.generateSalt();
        db[name] = {
          salt,
          passwordHash: S.hashPassword(data.password, salt),
          isAdmin: !!data.isAdmin,
          banned: !!data.banned,
          avatar: data.avatar || '🐱',
          games: data.games || 0,
          wins: data.wins || 0,
          createdAt: data.createdAt || Date.now(),
          migratedFrom: oldKey
        };
        changed = true;
      }
    }
    if (changed) saveAll(db);
    S.writeStr(S.KEYS.MIGRATED, '1');
  }

  function ensureAdmin(){
    const db = loadAll();
    if (!db[ADMIN_USERNAME]){
      db[ADMIN_USERNAME] = {
        salt: ADMIN_SALT,
        passwordHash: S.hashPassword(ADMIN_PASSWORD, ADMIN_SALT),
        isAdmin: true, banned: false, avatar: '👑',
        games: 0, wins: 0, createdAt: Date.now()
      };
      saveAll(db);
    }
  }

  function init(){ migrate(); ensureAdmin(); }

  window.Users = {
    // Session
    current(){
      const u = S.readStr(S.KEYS.SESSION);
      if (!u) return null;
      const db = loadAll();
      const user = db[u];
      if (!user || user.banned) return null;
      return {
        username: u, avatar: user.avatar || '🐱',
        isAdmin: !!user.isAdmin, banned: !!user.banned,
        games: user.games || 0, wins: user.wins || 0,
        isGuest: false, createdAt: user.createdAt
      };
    },
    setSession(username){ S.writeStr(S.KEYS.SESSION, username); },
    clearSession(){ S.remove(S.KEYS.SESSION); },

    // Auth
    login(username, password){
      username = String(username || '').trim();
      const db = loadAll();
      const realName = findRealName(username, db);
      if (!realName) return {ok:false, msg:'Không tìm thấy tài khoản'};
      const user = db[realName];
      if (user.banned) return {ok:false, msg:'Tài khoản đã bị khóa'};
      if (S.hashPassword(password, user.salt) !== user.passwordHash)
        return {ok:false, msg:'Mật khẩu sai'};
      S.writeStr(S.KEYS.SESSION, realName);
      return {ok:true};
    },
    register(username, password){
      username = String(username || '').trim();
      if (username.length < 3) return {ok:false, msg:'Tên phải ≥ 3 ký tự'};
      if (!password || password.length < 4) return {ok:false, msg:'Mật khẩu phải ≥ 4 ký tự'};
      const db = loadAll();
      if (findRealName(username, db)) return {ok:false, msg:'Tên đã tồn tại'};
      const salt = S.generateSalt();
      db[username] = {
        salt,
        passwordHash: S.hashPassword(password, salt),
        isAdmin: false, banned: false, avatar: '🐱',
        games: 0, wins: 0, createdAt: Date.now()
      };
      saveAll(db);
      S.writeStr(S.KEYS.SESSION, username);
      return {ok:true};
    },
    logout(){ S.remove(S.KEYS.SESSION); },

    // Guest
    guest(){
      let data = S.read(S.KEYS.GUEST, null);
      if (!data){
        data = {name: 'Khách_' + Math.floor(Math.random()*9000+1000), avatar: '🎭'};
        S.write(S.KEYS.GUEST, data);
      }
      return {
        username: data.name, avatar: data.avatar,
        isGuest: true, isAdmin: false, games: 0, wins: 0
      };
    },
    setGuestAvatar(avatar){
      const data = S.read(S.KEYS.GUEST, {name: 'Khách_' + Math.floor(Math.random()*9000+1000)});
      data.avatar = avatar;
      S.write(S.KEYS.GUEST, data);
    },

    // Stats
    updateStats(won){
      const u = S.readStr(S.KEYS.SESSION);
      if (!u) return;
      const db = loadAll();
      if (!db[u]) return;
      db[u].games = (db[u].games || 0) + 1;
      if (won) db[u].wins = (db[u].wins || 0) + 1;
      saveAll(db);
    },
    setAvatar(avatar){
      const u = S.readStr(S.KEYS.SESSION);
      if (!u) return;
      const db = loadAll();
      if (!db[u]) return;
      db[u].avatar = avatar;
      saveAll(db);
    },

    // Lookup (for friends)
    findUser(username){
      if (!username) return null;
      return findRealName(username, loadAll());
    },
    getUserPublic(username){
      const db = loadAll();
      const real = findRealName(username, db);
      if (!real) return null;
      const u = db[real];
      return {username: real, avatar: u.avatar || '🐱', isAdmin: !!u.isAdmin, games: u.games || 0, wins: u.wins || 0};
    },

    // Admin
    isAdmin(username){
      const db = loadAll();
      const real = findRealName(username, db);
      return real ? !!db[real].isAdmin : false;
    },
    adminListAll(){
      const db = loadAll();
      return Object.entries(db).map(([username, u]) => ({
        username, avatar: u.avatar || '🐱',
        isAdmin: !!u.isAdmin, banned: !!u.banned,
        games: u.games || 0, wins: u.wins || 0, createdAt: u.createdAt
      }));
    },
    adminDelete(username){
      if (username === ADMIN_USERNAME) return false;
      const db = loadAll();
      if (!db[username]) return false;
      delete db[username];
      saveAll(db);
      return true;
    },
    adminToggleAdmin(username){
      const db = loadAll();
      if (!db[username]) return;
      db[username].isAdmin = !db[username].isAdmin;
      saveAll(db);
    },
    adminToggleBan(username){
      const db = loadAll();
      if (!db[username]) return;
      db[username].banned = !db[username].banned;
      saveAll(db);
    },
    adminSetAvatar(username, avatar){
      const db = loadAll();
      if (!db[username]) return;
      db[username].avatar = avatar;
      saveAll(db);
    },
    adminResetUserStats(username){
      const db = loadAll();
      if (!db[username]) return;
      db[username].games = 0; db[username].wins = 0;
      saveAll(db);
    },
    adminResetAllStats(){
      const db = loadAll();
      for (const k of Object.keys(db)){ db[k].games = 0; db[k].wins = 0; }
      saveAll(db);
    }
  };

  try { init(); } catch(e){ console.error('[Users] init fail:', e); }
})(window);
