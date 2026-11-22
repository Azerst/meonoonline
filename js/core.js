'use strict';

/* ==================== CRYPTO ==================== */
const Crypto = {
  async hash(password, salt = ''){
    const text = salt + ':' + password;
    if (window.crypto && crypto.subtle) {
      try {
        const data = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return 'sha256_' + Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
      } catch(e) {}
    }
    // Fallback for file:// (không có secure context)
    let h = 5381;
    for (let i=0;i<text.length;i++) h = ((h<<5)+h) ^ text.charCodeAt(i);
    return 'fb_' + (h >>> 0).toString(16);
  },
  salt(username){ return 'EK::' + String(username).toLowerCase(); }
};

/* ==================== STORAGE (ổn định qua mọi version) ==================== */
const Storage = {
  // KHOÁ CỐ ĐỊNH — KHÔNG ĐỔI KHI UPDATE APP
  KEYS: {
    USERS:   'EKGAME_USERS_STABLE_V1',
    SESSION: 'EKGAME_SESSION_STABLE_V1',
    SOCIAL:  'EKGAME_SOCIAL_STABLE_V1',
    GUEST:   'EKGAME_GUEST_STABLE_V1'
  },
  read(key, def){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e){ return def; }
  },
  write(key, val){
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){ console.error('[Storage]',e); }
  },
  remove(key){ try { localStorage.removeItem(key); } catch(e){} },

  users(){ return this.read(this.KEYS.USERS, {}); },
  saveUsers(u){ this.write(this.KEYS.USERS, u); },
  social(){ return this.read(this.KEYS.SOCIAL, {requests:[], friends:{}, invites:[]}); },
  saveSocial(s){ this.write(this.KEYS.SOCIAL, s); },
  session(){ return this.read(this.KEYS.SESSION, null); },
  saveSession(val){ if(val===null) this.remove(this.KEYS.SESSION); else this.write(this.KEYS.SESSION, val); },
  guest(){ return this.read(this.KEYS.GUEST, null); },
  saveGuest(val){ this.write(this.KEYS.GUEST, val); }
};

/* ==================== AUTH ==================== */
const Auth = {
  ADMIN: { username:'vanbacazerst.vn2908', password:'aBc@2908vanbac0809' },
  MANAGER: { username:'T gaming', password:'1234231' },

  async init(){
    const users = Storage.users();
    let dirty = false;

    // Seed admin
    if(!users[this.ADMIN.username] || !users[this.ADMIN.username].password){
      const salt = Crypto.salt(this.ADMIN.username);
      const hashed = await Crypto.hash(this.ADMIN.password, salt);
      users[this.ADMIN.username] = {
        password: hashed, salt,
        isAdmin: true, isManager: false, banned: false,
        avatar: '👑', games: 0, wins: 0, createdAt: Date.now()
      };
      dirty = true;
    }
    // Seed manager
    if(!users[this.MANAGER.username] || !users[this.MANAGER.username].password){
      const salt = Crypto.salt(this.MANAGER.username);
      const hashed = await Crypto.hash(this.MANAGER.password, salt);
      users[this.MANAGER.username] = {
        password: hashed, salt,
        isAdmin: false, isManager: true, banned: false,
        avatar: '🎭', games: 0, wins: 0, createdAt: Date.now()
      };
      dirty = true;
    }
    if(dirty) Storage.saveUsers(users);
  },

  findUser(name){
    if(!name) return null;
    const target = String(name).trim().toLowerCase();
    const users = Storage.users();
    for(const k of Object.keys(users)){
      if(k.toLowerCase() === target) return k;
    }
    return null;
  },

  async register(u, p){
    u = String(u||'').trim();
    if(u.length < 3) return {ok:false, msg:'Tên ≥ 3 ký tự'};
    if(!p || p.length < 4) return {ok:false, msg:'Mật khẩu ≥ 4 ký tự'};
    if(this.findUser(u)) return {ok:false, msg:'Tên đã tồn tại'};
    const users = Storage.users();
    const salt = Crypto.salt(u);
    const hashed = await Crypto.hash(p, salt);
    users[u] = { password: hashed, salt, isAdmin:false, isManager:false, banned:false, avatar:'🐱', games:0, wins:0, createdAt: Date.now() };
    Storage.saveUsers(users);
    Storage.saveSession(u);
    return {ok:true};
  },

  async login(u, p){
    u = String(u||'').trim();
    const real = this.findUser(u);
    if(!real) return {ok:false, msg:'Không tìm thấy tài khoản'};
    const users = Storage.users();
    const acc = users[real];
    if(acc.banned) return {ok:false, msg:'Tài khoản đã bị khóa'};
    const salt = acc.salt || Crypto.salt(real);
    const hashed = await Crypto.hash(p, salt);
    if(acc.password !== hashed) return {ok:false, msg:'Mật khẩu sai'};
    Storage.saveSession(real);
    return {ok:true};
  },

  current(){
    const u = Storage.session();
    if(!u) return null;
    const users = Storage.users();
    const acc = users[u];
    if(!acc) return null;
    return { username:u, avatar:acc.avatar||'🐱', games:acc.games||0, wins:acc.wins||0,
             isAdmin:!!acc.isAdmin, isManager:!!acc.isManager, banned:!!acc.banned,
             isGuest:false, createdAt: acc.createdAt };
  },

  guest(){
    let g = Storage.guest();
    if(!g){
      g = { name:'Khách_' + Math.floor(Math.random()*9000+1000), avatar:'🎭' };
      Storage.saveGuest(g);
    }
    return { username:g.name, avatar:g.avatar, games:0, wins:0, isAdmin:false, isManager:false, isGuest:true };
  },

  updateStats(won){
    const s = Storage.session();
    if(!s) return;
    const users = Storage.users();
    if(!users[s]) return;
    users[s].games = (users[s].games||0) + 1;
    if(won) users[s].wins = (users[s].wins||0) + 1;
    Storage.saveUsers(users);
  },

  setAvatar(avatar){
    const s = Storage.session();
    if(!s) return;
    const users = Storage.users();
    if(!users[s]) return;
    users[s].avatar = avatar;
    Storage.saveUsers(users);
  },

  logout(){ Storage.saveSession(null); },

  // Admin / Manager ops
  setAvatarAs(username, avatar){ const u = Storage.users(); if(u[username]) { u[username].avatar = avatar; Storage.saveUsers(u); } },
  deleteUser(username){ const u = Storage.users(); if(u[username]){ delete u[username]; Storage.saveUsers(u); return true; } return false; },
  toggleAdmin(username){ const u = Storage.users(); if(u[username]){ u[username].isAdmin = !u[username].isAdmin; Storage.saveUsers(u); } },
  toggleManager(username){ const u = Storage.users(); if(u[username]){ u[username].isManager = !u[username].isManager; Storage.saveUsers(u); } },
  toggleBan(username){ const u = Storage.users(); if(u[username]){ u[username].banned = !u[username].banned; Storage.saveUsers(u); } },
  resetUserStats(username){ const u = Storage.users(); if(u[username]){ u[username].games = 0; u[username].wins = 0; Storage.saveUsers(u); } },
  resetAllStats(){ const u = Storage.users(); for(const k of Object.keys(u)){ u[k].games = 0; u[k].wins = 0; } Storage.saveUsers(u); },
  changePassword(username, newPassword){
    return new Promise(async resolve => {
      const u = Storage.users();
      if(!u[username]) return resolve(false);
      const salt = u[username].salt || Crypto.salt(username);
      u[username].password = await Crypto.hash(newPassword, salt);
      u[username].salt = salt;
      Storage.saveUsers(u);
      resolve(true);
    });
  }
};

/* ==================== SOCIAL ==================== */
const Social = {
  get(){ return Storage.social(); },
  save(s){ Storage.saveSocial(s); },

  sendRequest(from, to){
    if(!to) return {ok:false, msg:'Nhập tên'};
    const real = Auth.findUser(to);
    if(!real) return {ok:false, msg:'Không tìm thấy user'};
    if(from === real) return {ok:false, msg:'Không thể tự kết bạn'};
    const s = this.get();
    if((s.friends[from]||[]).includes(real)) return {ok:false, msg:'Đã là bạn'};
    if(s.requests.some(r => r.from===from && r.to===real && r.status==='pending')) return {ok:false, msg:'Đã gửi'};
    if(s.requests.some(r => r.from===real && r.to===from && r.status==='pending')) return {ok:false, msg:'Họ đã gửi cho bạn!'};
    s.requests.push({from, to:real, status:'pending', ts:Date.now()});
    this.save(s);
    return {ok:true, msg:'Đã gửi tới ' + real};
  },
  incoming(username){ return this.get().requests.filter(r => r.to===username && r.status==='pending'); },
  outgoing(username){ return this.get().requests.filter(r => r.from===username && r.status==='pending'); },
  accept(ts){
    const s = this.get();
    const req = s.requests.find(r => r.ts===ts);
    if(!req) return;
    req.status = 'accepted';
    if(!s.friends[req.from]) s.friends[req.from] = [];
    if(!s.friends[req.to]) s.friends[req.to] = [];
    if(!s.friends[req.from].includes(req.to)) s.friends[req.from].push(req.to);
    if(!s.friends[req.to].includes(req.from)) s.friends[req.to].push(req.from);
    this.save(s);
  },
  reject(ts){
    const s = this.get();
    const req = s.requests.find(r => r.ts===ts);
    if(req) { req.status = 'rejected'; this.save(s); }
  },
  getFriends(username){ return this.get().friends[username] || []; },
  removeFriend(a, b){
    const s = this.get();
    if(s.friends[a]) s.friends[a] = s.friends[a].filter(x => x!==b);
    if(s.friends[b]) s.friends[b] = s.friends[b].filter(x => x!==a);
    this.save(s);
  },
  sendInvite(from, to, roomCode){
    const s = this.get();
    s.invites.push({from, to, roomCode, status:'pending', ts:Date.now()});
    this.save(s);
  },
  incomingInvites(username){ return this.get().invites.filter(i => i.to===username && i.status==='pending'); },
  acceptInvite(ts){
    const s = this.get();
    const inv = s.invites.find(i => i.ts===ts);
    if(!inv) return null;
    inv.status = 'accepted'; this.save(s); return inv;
  },
  rejectInvite(ts){
    const s = this.get();
    const inv = s.invites.find(i => i.ts===ts);
    if(inv){ inv.status = 'rejected'; this.save(s); }
  }
};
