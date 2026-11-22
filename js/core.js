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
        avatar: '👤', id: 'U'+U.uid().toUpperCase(), games: 0, wins: 0, createdAt: Date.now()
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
        avatar: '👤', id: 'U'+U.uid().toUpperCase(), games: 0, wins: 0, createdAt: Date.now()
      };
      dirty = true;
    }
    // Mỗi tài khoản có một ID công khai, ổn định và duy nhất. Bổ sung ID cho tài khoản cũ.
    const used = new Set();
    for(const [name, acc] of Object.entries(users)){
      if(!acc.id || used.has(acc.id)){ do { acc.id = 'U' + U.uid().toUpperCase(); } while(used.has(acc.id)); dirty = true; }
      used.add(acc.id);
      if(!acc.avatar || ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🐰','🐹','🦄','🐲','🐺'].includes(acc.avatar)){ acc.avatar='👤'; dirty=true; }
    }
    if(dirty) Storage.saveUsers(users);
    // Chuyển quan hệ bạn bè cũ (username) sang ID một lần để tương thích dữ liệu đã lưu.
    const social = Storage.social();
    let socialDirty = false;
    for(const [owner, list] of Object.entries(social.friends||{})){
      const ownerKey = Object.keys(users).find(k=>k.toLowerCase()===String(owner).toLowerCase());
      if(!ownerKey) continue; const ownerId=users[ownerKey].id;
      const ids=(list||[]).map(v=>{ const key=Object.keys(users).find(k=>k.toLowerCase()===String(v).toLowerCase()); return key?users[key].id:v; });
      if(owner!==ownerId || JSON.stringify(ids)!==JSON.stringify(list)){ social.friends[ownerId]=[...new Set([...(social.friends[ownerId]||[]),...ids])]; delete social.friends[owner]; socialDirty=true; }
    }
    for(const r of social.requests||[]){ for(const f of ['from','to']){ const key=Object.keys(users).find(k=>k.toLowerCase()===String(r[f]).toLowerCase()); if(key && r[f]!==users[key].id){r[f]=users[key].id; socialDirty=true;} } }
    if(socialDirty) Storage.saveSocial(social);
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
    users[u] = { password: hashed, salt, isAdmin:false, isManager:false, banned:false, avatar:'👤', id:'U'+U.uid().toUpperCase(), games:0, wins:0, createdAt: Date.now() };
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

  findUserById(id){ if(!id) return null; const users=Storage.users(); return Object.keys(users).find(k=>users[k].id===String(id).toUpperCase()) || null; },

  current(){
    const u = Storage.session();
    if(!u) return null;
    const users = Storage.users();
    const acc = users[u];
    if(!acc) return null;
    return { username:u, id:acc.id, avatar:acc.avatar||'👤', games:acc.games||0, wins:acc.wins||0,
             isAdmin:!!acc.isAdmin, isManager:!!acc.isManager, banned:!!acc.banned,
             isGuest:false, createdAt: acc.createdAt };
  },

  guest(){
    let g = Storage.guest();
    if(!g){ g = { name:'Khách_' + Math.floor(Math.random()*9000+1000), id:'G'+U.uid().toUpperCase(), avatar:'👤' }; }
    if(!g.id) g.id='G'+U.uid().toUpperCase();
    if(!g.avatar || ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🐰','🐹','🦄','🐲','🐺'].includes(g.avatar)) g.avatar='👤';
    Storage.saveGuest(g);
    return { username:g.name, id:g.id, avatar:g.avatar, games:0, wins:0, isAdmin:false, isManager:false, isGuest:true };
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
  sendRequest(fromId, toId){
    if(!toId) return {ok:false,msg:'Nhập ID người chơi'};
    const from=Auth.findUserById(fromId), real=Auth.findUserById(toId);
    if(!from) return {ok:false,msg:'Tài khoản gửi không hợp lệ'};
    if(!real) return {ok:false,msg:'Không tìm thấy ID người chơi'};
    if(from===real) return {ok:false,msg:'Không thể tự kết bạn'};
    const s=this.get(); const a=Storage.users()[from].id, b=Storage.users()[real].id;
    if((s.friends[a]||[]).includes(b)) return {ok:false,msg:'Đã là bạn'};
    if(s.requests.some(r=>r.from===a&&r.to===b&&r.status==='pending')) return {ok:false,msg:'Đã gửi lời mời'};
    if(s.requests.some(r=>r.from===b&&r.to===a&&r.status==='pending')) return {ok:false,msg:'Người này đã gửi lời mời cho bạn'};
    s.requests.push({from:a,to:b,status:'pending',ts:Date.now()+Math.random()}); this.save(s);
    return {ok:true,msg:'Đã gửi lời mời kết bạn'};
  },
  incoming(id){ return this.get().requests.filter(r=>r.to===id&&r.status==='pending'); },
  outgoing(id){ return this.get().requests.filter(r=>r.from===id&&r.status==='pending'); },
  accept(ts){ const s=this.get(),r=s.requests.find(x=>x.ts===ts&&x.status==='pending'); if(!r)return false; r.status='accepted'; s.friends[r.from] ||= []; s.friends[r.to] ||= []; if(!s.friends[r.from].includes(r.to))s.friends[r.from].push(r.to); if(!s.friends[r.to].includes(r.from))s.friends[r.to].push(r.from); this.save(s); return true; },
  reject(ts){ const s=this.get(),r=s.requests.find(x=>x.ts===ts&&x.status==='pending'); if(r){r.status='rejected';this.save(s);} },
  getFriends(id){ return this.get().friends[id] || []; },
  removeFriend(a,b){ const s=this.get(); if(s.friends[a])s.friends[a]=s.friends[a].filter(x=>x!==b); if(s.friends[b])s.friends[b]=s.friends[b].filter(x=>x!==a); this.save(s); },
  sendInvite(from,to,roomCode){ const s=this.get(); s.invites.push({from,to,roomCode,status:'pending',ts:Date.now()+Math.random()}); this.save(s); },
  incomingInvites(username){ return this.get().invites.filter(i=>i.to===username&&i.status==='pending'); },
  acceptInvite(ts){ const s=this.get(),i=s.invites.find(x=>x.ts===ts); if(!i)return null; i.status='accepted';this.save(s);return i; },
  rejectInvite(ts){ const s=this.get(),i=s.invites.find(x=>x.ts===ts); if(i){i.status='rejected';this.save(s);} }
};
