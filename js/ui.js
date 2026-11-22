'use strict';

const UI = {
  myId:null, roomCode:null, isHost:false,
  lobbyPlayers:[], botScheduled:false, currentModal:null,
  _animatedDrawId:null, _animatedStealId:null, _lastShownPlayId:null, _lastEKEKId:null,
  selectedCatIndices:[], _handSig:'', _handRenderSig:'',
  isShuffling:false, _lastPendingTs:null, _dealing:false, _statsRecorded:false,
  _codeInput:'', _pollTimer:null, _shownInvites:new Set(),
  _friendsTab:'list', _alterCards:null,
  _showcaseTimeout:null, _nopeHighlightTimer:null, _hostWatchdogTimer:null,
  _lastAlive:null, _lastDeck:null, _lastTurn:null, _lastTurnsLeft:null,
  _oppsSig:'', _discSig:'', _lastCanDraw:null, _lastLogSig:'',

  async init(){
    await Auth.init();
    this.myId = 'p_' + U.uid();
    Engine.onChange = meta => this.onEngineChange(meta);
    this.switchAuthTab('login');
    const cur = Auth.current();
    if(cur) this.enterMenu(cur);
    else this.showScreen('sc-auth');
    this._pollTimer = setInterval(() => this._pollSocial(), 2500);
    this._setupExitGuards();
  },

  _setupExitGuards(){
    try{ history.pushState({ekPage:'app'}, '', location.href); } catch(e){}
    window.addEventListener('popstate', () => {
      const inGame = Engine.state && Engine.state.phase === 'playing';
      if(inGame){
        try{ history.pushState({ekPage:'app'}, '', location.href); } catch(e){}
        if(confirm('Trận đấu đang diễn ra!\n\nBạn có chắc muốn thoát? Bạn sẽ bị xử thua.')){
          Engine.state = null;
          this.leaveRoom();
        }
      }
    });
    window.addEventListener('beforeunload', e => {
      if(Engine.state && Engine.state.phase === 'playing'){
        const msg = 'Trận đấu đang diễn ra. Thoát?';
        e.preventDefault(); e.returnValue = msg; return msg;
      }
    });
  },

  _pollSocial(){
    const acc = Auth.current();
    if(!acc || acc.isGuest) return;
    const incoming = Social.incoming(acc.id);
    const badge = document.getElementById('friendsBadge');
    if(badge){
      if(incoming.length > 0){ badge.textContent = incoming.length; badge.style.display = 'flex'; }
      else badge.style.display = 'none';
    }
    const invites = Social.incomingInvites(acc.username);
    invites.forEach(inv => {
      if(this._shownInvites.has(inv.ts)) return;
      this._shownInvites.add(inv.ts);
      this.showTeamInvite(inv);
    });
  },

  showTeamInvite(inv){
    const el = document.createElement('div');
    el.className = 'glass bevel';
    el.style.cssText = `position:fixed;top:20px;right:20px;max-width:320px;padding:16px;z-index:9999`;
    el.innerHTML = `
      <div style="font-weight:900;margin-bottom:6px">Lời mời vào phòng</div>
      <div style="font-size:12px;color:#fff;margin-bottom:10px">
        <b>${this.escapeHtml(inv.from)}</b> mời bạn vào phòng <b>${inv.roomCode}</b>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-primary" style="flex:1;padding:8px;font-size:12px" onclick='UI.acceptTeamInvite(${inv.ts},"${inv.roomCode}")'>Đồng ý</button>
        <button class="btn-outline" style="flex:1;padding:8px;font-size:12px" onclick='UI.rejectTeamInvite(${inv.ts})'>Từ chối</button>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 15000);
  },
  acceptTeamInvite(ts, code){ Social.acceptInvite(ts); this.toast('Đã chấp nhận'); setTimeout(() => this.doJoinRoom(code), 300); },
  rejectTeamInvite(ts){ Social.rejectInvite(ts); this.toast('Đã từ chối'); },

  showScreen(id){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    document.getElementById(id)?.classList.add('on');
  },
  currentUser(){ return Auth.current() || (Storage.guest() ? Auth.guest() : null); },
  escapeHtml(str){ return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

  switchAuthTab(tab){
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('authLoginForm').style.display = tab==='login'?'flex':'none';
    document.getElementById('authRegisterForm').style.display = tab==='register'?'flex':'none';
    document.getElementById('authMsg').textContent = '';
    document.getElementById('authMsg').className = 'auth-msg';
  },
  authMsg(text, isErr){
    const el = document.getElementById('authMsg');
    el.textContent = text;
    el.className = 'auth-msg ' + (isErr ? 'err' : 'ok');
  },
  async doLogin(){
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    this.authMsg('Đang kiểm tra...', false);
    const res = await Auth.login(u, p);
    if(!res.ok){ this.authMsg(res.msg, true); return; }
    this.authMsg('Đăng nhập thành công', false);
    setTimeout(() => this.enterMenu(Auth.current()), 300);
  },
  async doRegister(){
    const u = document.getElementById('regUser').value;
    const p = document.getElementById('regPass').value;
    const p2 = document.getElementById('regPass2').value;
    if(p !== p2){ this.authMsg('Mật khẩu nhập lại không khớp', true); return; }
    this.authMsg('Đang tạo tài khoản...', false);
    const res = await Auth.register(u, p);
    if(!res.ok){ this.authMsg(res.msg, true); return; }
    this.authMsg('Tạo tài khoản thành công', false);
    setTimeout(() => this.enterMenu(Auth.current()), 300);
  },
  playAsGuest(){ this.enterMenu(Auth.guest()); },

  enterMenu(user){
    if(!user){ this.showScreen('sc-auth'); return; }
    this.myId = 'p_' + U.uid();
    this._statsRecorded = false;
    document.getElementById('topbarName').textContent = user.username;
    document.getElementById('topbarGames').textContent = user.games || 0;
    document.getElementById('topbarWins').textContent = user.wins || 0;
    document.getElementById('topbarAvatar').innerHTML = renderAvatarHTML(user.avatar || '👤', 66);

    const badge = document.getElementById('topbarRoleBadge');
    if(user.isAdmin){ badge.textContent = 'ADMIN'; badge.className = 'role-badge role-admin'; badge.style.display='inline-flex'; }
    else if(user.isManager){ badge.textContent = 'MANAGER'; badge.className = 'role-badge role-manager'; badge.style.display='inline-flex'; }
    else if(user.isGuest){ badge.textContent = 'GUEST'; badge.className = 'role-badge role-guest'; badge.style.display='inline-flex'; }
    else badge.style.display = 'none';

    document.getElementById('adminCard').style.display = (user.isAdmin || user.isManager) ? 'flex' : 'none';
    if(user.isGuest){
      document.getElementById('topbarFriends').textContent = '—';
      document.getElementById('friendsCard').classList.add('locked');
    } else {
      document.getElementById('topbarFriends').textContent = Social.getFriends(user.id).length;
      document.getElementById('friendsCard').classList.remove('locked');
    }
    this.showScreen('sc-menu');
    this._pollSocial();
  },

  openModal(id, html){
    this.currentModal = id;
    document.getElementById('modalContent').innerHTML =
      `<button class="modal-close" onclick="UI.closeModal()" aria-label="Đóng">×</button>${html}`;
    document.getElementById('overlayModal').classList.add('on');
  },
  closeModal(){
    document.getElementById('overlayModal').classList.remove('on');
    this.currentModal = null;
  },

  /* ===== PROFILE ===== */
  openProfile(){
    const user=this.currentUser(); if(!user)return;
    const winRate=user.games?Math.round(user.wins/user.games*100):0;
    const level=user.games<5?'Tân binh':user.games<20?'Chiến binh':user.games<50?'Cao thủ':'Huyền thoại';
    const progress=Math.min(100,(user.games%50)*2);
    this.openModal('profile', `
      <section class="profile-v2">
        <div class="profile-v2-head"><div class="profile-v2-orbit"></div><div class="profile-v2-avatar" onclick="UI.openAvatarPicker()">${renderAvatarHTML(user.avatar||'👤',92)}<span class="profile-edit">✎</span></div><div class="profile-v2-name">${this.escapeHtml(user.username)}</div><div class="profile-v2-role">${user.isAdmin?'ADMIN':user.isManager?'QUẢN LÝ':user.isGuest?'KHÁCH':level.toUpperCase()}</div></div>
        <div class="profile-id"><span>ID NGƯỜI CHƠI</span><strong>${this.escapeHtml(user.id||'—')}</strong><button onclick="navigator.clipboard?.writeText('${this.escapeHtml(user.id||'')}').then(()=>UI.toast('Đã sao chép ID'))">Sao chép</button></div>
        ${user.isGuest?'<p class="profile-v2-note">Đăng ký tài khoản để lưu thành tích và kết bạn.</p><button class="btn-primary" onclick="UI.closeModal();UI.showScreen(\'sc-auth\')">Đăng ký ngay</button>':`
        <div class="profile-v2-level"><div><b>${level}</b><span>${progress}% tiến độ</span></div><div class="profile-progress-bar"><div class="profile-progress-fill" style="width:${progress}%"></div></div></div>
        <div class="profile-v2-stats"><div><b>${user.games||0}</b><span>TRẬN ĐẤU</span></div><div><b>${user.wins||0}</b><span>CHIẾN THẮNG</span></div><div><b>${winRate}%</b><span>TỈ LỆ THẮNG</span></div></div>
        <div class="profile-v2-actions"><button class="btn-primary" onclick="UI.openAvatarPicker()">Đổi ảnh đại diện</button><button class="btn-danger" onclick="UI.doLogout()">Đăng xuất</button></div>`}
      </section>`);
  },
  openAvatarPicker(){
    const user = this.currentUser();
    if(!user) return;
    const opts = AVATARS.map(a => {
      const isImg = a.startsWith('http');
      const sel = user.avatar === a ? 'selected' : '';
      return `<div class="avatar-opt ${sel}" onclick="UI.pickAvatar('${a.replace(/'/g,"\\'")}')">${isImg ? `<img src="${a}" alt="">` : a}</div>`;
    }).join('');
    this.openModal('avatar', `
      <h2>Chọn Avatar</h2>
      <p style="font-size:12px">Chọn icon hoặc ảnh đại diện</p>
      <div class="avatar-grid">${opts}</div>
      <button class="btn-outline bevel-sm" onclick="UI.openProfile()">Quay Lại</button>
    `);
  },
  pickAvatar(avatar){
    const user = this.currentUser();
    if(!user) return;
    if(user.isGuest){
      const g = Auth.guest();
      Storage.saveGuest({name:g.name, avatar});
    } else {
      Auth.setAvatar(avatar);
    }
    document.getElementById('topbarAvatar').innerHTML = renderAvatarHTML(avatar, 66);
    this.toast('Đã đổi avatar');
    setTimeout(() => this.openProfile(), 200);
  },
  doLogout(){
    Auth.logout(); this.closeModal();
    this.myId = 'p_' + U.uid();
    this.showScreen('sc-auth');
  },

  /* ===== FRIENDS ===== */
  openFriends(){
    const user = this.currentUser();
    if(!user || user.isGuest){ this.toast('Cần đăng nhập'); return; }
    const accs = Storage.users();
    const friends = Social.getFriends(user.id);
    const incoming = Social.incoming(user.id);
    const outgoing = Social.outgoing(user.id);
    let content = '';
    if(this._friendsTab === 'list'){
      content = friends.length === 0
        ? `<div class="empty"><div class="empty-txt">Chưa có bạn bè</div></div>`
        : friends.map(f => {
            const av = accs[Auth.findUserById(f)]?.avatar || '👤';
            return `<div class="friend-row">
              <div class="friend-av">${renderAvatarHTML(av, 38)}</div>
              <div class="friend-name">${this.escapeHtml(Auth.findUserById(f)||'Tài khoản không còn tồn tại')} <small>${this.escapeHtml(f)}</small></div>
              <button class="btn-danger bevel-sm" onclick="UI.friendRemove('${this.escapeHtml(f)}')">Xóa</button>
            </div>`;
          }).join('');
    } else if(this._friendsTab === 'add'){
      content = `
        <div class="search-row">
          <input type="text" id="friendSearchInput" placeholder="Nhập ID người chơi..." maxlength="24" onkeypress="if(event.key==='Enter')UI.friendSearch()">
          <button class="btn-primary bevel-sm" onclick="UI.friendSearch()">Kết Bạn</button>
        </div>
        <div id="friendSearchResult" style="min-height:20px;font-size:12px;padding:8px;color:#fff"></div>
        <div style="font-size:11px;color:var(--white-dim);margin-top:8px;text-align:left">Nhập ID riêng của người chơi để gửi lời mời.</div>
      `;
    } else if(this._friendsTab === 'incoming'){
      content = incoming.length === 0
        ? `<div class="empty"><div class="empty-txt">Không có lời mời</div></div>`
        : incoming.map(r => {
            const av = accs[Auth.findUserById(r.from)]?.avatar || '👤';
            return `<div class="friend-row">
              <div class="friend-av">${renderAvatarHTML(av, 38)}</div>
              <div class="friend-name">${this.escapeHtml(Auth.findUserById(r.from)||'Người chơi')} <small>${this.escapeHtml(r.from)}</small></div>
              <button class="btn-primary bevel-sm" onclick="UI.friendAccept(${r.ts})">Đồng ý</button>
              <button class="btn-danger bevel-sm" onclick="UI.friendReject(${r.ts})">Từ chối</button>
            </div>`;
          }).join('');
    } else if(this._friendsTab === 'outgoing'){
      content = outgoing.length === 0
        ? `<div class="empty"><div class="empty-txt">Không có lời mời đã gửi</div></div>`
        : outgoing.map(r => `<div class="friend-row">
            <div class="friend-av">…</div>
            <div class="friend-name">${this.escapeHtml(Auth.findUserById(r.to)||'Người chơi')} <small>${this.escapeHtml(r.to)}</small></div>
            <span style="font-size:11px;color:var(--white-dim)">Đang chờ</span>
          </div>`).join('');
    }
    this.openModal('friends', `
      <h2>Bạn Bè</h2>
      <div class="tabs">
        <button class="tab ${this._friendsTab==='list'?'active':''}" onclick="UI.friendsSwitch('list')">Danh Sách</button>
        <button class="tab ${this._friendsTab==='add'?'active':''}" onclick="UI.friendsSwitch('add')">Kết Bạn</button>
        <button class="tab ${this._friendsTab==='incoming'?'active':''}" onclick="UI.friendsSwitch('incoming')">Đến (${incoming.length})</button>
        <button class="tab ${this._friendsTab==='outgoing'?'active':''}" onclick="UI.friendsSwitch('outgoing')">Đi (${outgoing.length})</button>
      </div>
      <div style="max-height:50vh;overflow-y:auto;text-align:left">${content}</div>
    `);
  },
  friendsSwitch(tab){ this._friendsTab = tab; this.openFriends(); },
  friendSearch(){
    const input = document.getElementById('friendSearchInput');
    const result = document.getElementById('friendSearchResult');
    if(!input || !result) return;
    const val = input.value.trim();
    if(!val){ result.textContent = 'Nhập ID người chơi'; result.style.color = '#ff8a7a'; return; }
    const user = this.currentUser();
    if(!user) return;
    const real = Auth.findUserById(val);
    if(!real){
      result.textContent = `Không tìm thấy ID "${val}"`;
      result.style.color = '#ff8a7a'; return;
    }
    const res = Social.sendRequest(user.id, val);
    result.textContent = res.ok ? `Đã gửi tới "${real}"` : res.msg;
    result.style.color = res.ok ? '#8affa8' : '#ffc766';
    if(res.ok) setTimeout(() => this.openFriends(), 800);
  },
  friendAccept(ts){ Social.accept(ts); this.toast('Đã chấp nhận'); this.openFriends(); },
  friendReject(ts){ Social.reject(ts); this.toast('Đã từ chối'); this.openFriends(); },
  friendRemove(name){
    const user = this.currentUser();
    if(!user) return;
    if(!confirm(`Xóa "${name}" khỏi danh sách bạn bè?`)) return;
    Social.removeFriend(user.id, name);
    this.toast('Đã xóa'); this.openFriends();
  },

  /* ===== HOW TO PLAY ===== */
  openHowToPlay(){
    const rules = `
      <div class="rules-section">
        <h3>Mục tiêu</h3>
        <p>Sống sót đến cuối cùng. Người cuối cùng không bị nổ là người thắng.</p>
        <h3>Cách chơi</h3>
        <ul>
          <li>Mỗi lượt đánh nhiều lá hoặc rút 1 lá để kết thúc lượt.</li>
          <li>Rút trúng Mèo Nổ phải có Gỡ Bom để sống. Không có sẽ bị loại.</li>
          <li>Khi đánh bài có thể bị NOPE để hủy (trong 4 giây).</li>
        </ul>
        <h3>Mèo Thường (Combo)</h3>
        <p>Chỉ ghép các lá Mèo CÙNG LOẠI:</p>
        <ul>
          <li>Mèo 1 với Mèo 1</li>
          <li>Mèo 2 với Mèo 2...</li>
        </ul>
        <p>Đánh 2 lá: cướp 1 lá ngẫu nhiên. Đánh 3 lá: gọi tên lá.</p>
      </div>`;
    const cards = `<div class="card-list-grid">${Object.entries(CARD_TYPES).map(([k, info]) => {
      const sample = makeCard(k);
      return `<div class="card-list-item">
        <div class="card-list-thumb"><img src="${cardImage(sample)}" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=&quot;color:#fff;font-weight:900;font-size:9px&quot;>${info.short}</div>'" alt=""></div>
        <div class="card-list-body">
          <div class="card-list-name">${info.name}</div>
          <div class="card-list-desc">${info.desc}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
    this.openModal('htp', `
      <h2>Hướng Dẫn</h2>
      <div class="tabs">
        <button class="tab active" onclick="UI.htpSwitch('rules')">Luật</button>
        <button class="tab" onclick="UI.htpSwitch('cards')">Lá Bài</button>
      </div>
      <div id="htpContent">${rules}</div>
      <button class="btn-primary bevel-sm" onclick="UI.closeModal()">Đã Hiểu</button>
    `);
    this._htpData = {rules, cards};
  },
  htpSwitch(tab){
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (tab==='rules'&&i===0)||(tab==='cards'&&i===1)));
    const c = document.getElementById('htpContent');
    if(c && this._htpData) c.innerHTML = this._htpData[tab];
  },

  /* ===== ADMIN PANEL (NEW) ===== */
  openAdminPanel(){
    const user = this.currentUser();
    if(!user || (!user.isAdmin && !user.isManager)) return;
    this._adminTab = this._adminTab || 'overview';
    const isAdmin = user.isAdmin;

    const users = Storage.users();
    const userList = Object.entries(users);
    const totalUsers = userList.length;
    const totalGames = userList.reduce((s,[,u]) => s + (u.games||0), 0);
    const totalWins = userList.reduce((s,[,u]) => s + (u.wins||0), 0);
    const admins = userList.filter(([,u]) => u.isAdmin).length;
    const managers = userList.filter(([,u]) => u.isManager).length;

    const tabs = `
      <div class="tabs admin-tabs">
        <button class="tab ${this._adminTab==='overview'?'active':''}" onclick="UI.adminSwitch('overview')">Tổng Quan</button>
        <button class="tab ${this._adminTab==='users'?'active':''}" onclick="UI.adminSwitch('users')">Người Dùng</button>
        <button class="tab ${this._adminTab==='roles'?'active':''}" onclick="UI.adminSwitch('roles')">Phân Quyền</button>
        <button class="tab ${this._adminTab==='settings'?'active':''}" onclick="UI.adminSwitch('settings')">Hệ Thống</button>
      </div>`;

    let content = '';
    if(this._adminTab === 'overview'){
      content = `
        <div class="admin-stats">
          <div class="admin-stat"><div class="admin-stat-val">${totalUsers}</div><div class="admin-stat-lbl">Người dùng</div></div>
          <div class="admin-stat"><div class="admin-stat-val">${totalGames}</div><div class="admin-stat-lbl">Tổng trận</div></div>
          <div class="admin-stat"><div class="admin-stat-val">${totalWins}</div><div class="admin-stat-lbl">Tổng thắng</div></div>
          <div class="admin-stat"><div class="admin-stat-val">${admins}</div><div class="admin-stat-lbl">Admin</div></div>
          <div class="admin-stat"><div class="admin-stat-val">${managers}</div><div class="admin-stat-lbl">Manager</div></div>
        </div>`;
    } else if(this._adminTab === 'users'){
      content = `
        <div class="search-row">
          <input type="text" id="adminSearch" placeholder="Tìm user..." oninput="UI.adminFilterUsers()">
        </div>
        <div id="adminUserList" class="admin-list">${userList.map(([name, a]) => this._adminUserRow(name, a, isAdmin)).join('')}</div>
      `;
    } else if(this._adminTab === 'roles'){
      content = `
        <div class="admin-list">${userList.map(([name, a]) => `
          <div class="admin-row">
            <div class="admin-row-name">
              <b>${this.escapeHtml(name)}</b>
              ${a.isAdmin ? '<span class="role-badge role-admin">ADMIN</span>' : ''}
              ${a.isManager ? '<span class="role-badge role-manager">MANAGER</span>' : ''}
            </div>
            <div class="admin-row-actions">
              ${isAdmin && name !== Auth.ADMIN.username ? `
                <button class="btn-outline bevel-sm" onclick="UI.adminToggleRole('${this.escapeHtml(name)}','admin')">${a.isAdmin?'Bỏ Admin':'Set Admin'}</button>
                <button class="btn-outline bevel-sm" onclick="UI.adminToggleRole('${this.escapeHtml(name)}','manager')">${a.isManager?'Bỏ Manager':'Set Manager'}</button>
              ` : '<span style="font-size:11px;color:var(--white-dim)">—</span>'}
            </div>
          </div>
        `).join('')}</div>
      `;
    } else if(this._adminTab === 'settings'){
      content = `
        <div class="admin-danger-zone">
          <h3 class="danger-title">Vùng Nguy Hiểm</h3>
          <button class="btn-danger bevel-sm" onclick="UI.adminResetAll()">Reset TẤT CẢ Stats</button>
          <button class="btn-danger bevel-sm" onclick="UI.adminExport()">Xuất dữ liệu (JSON)</button>
        </div>
      `;
    }

    this.openModal('admin', `
      <div class="admin-head">
        <h2>Quản Trị Hệ Thống</h2>
        <div class="role-badge ${isAdmin?'role-admin':'role-manager'}">${isAdmin?'ADMIN':'MANAGER'}</div>
      </div>
      ${tabs}
      <div style="max-height:55vh;overflow-y:auto">${content}</div>
    `);
  },
  _adminUserRow(name, a, canDelete){
    const isMe = name === Auth.current()?.username;
    const isRootAdmin = name === Auth.ADMIN.username;
    return `
      <div class="admin-row" data-username="${this.escapeHtml(name.toLowerCase())}">
        <div class="admin-row-main">
          <div class="admin-row-av">${renderAvatarHTML(a.avatar||'👤', 40)}</div>
          <div style="min-width:0">
            <div class="admin-row-name">
              <b>${this.escapeHtml(name)}</b>
              ${a.isAdmin ? '<span class="role-badge role-admin">ADMIN</span>' : ''}
              ${a.isManager ? '<span class="role-badge role-manager">MANAGER</span>' : ''}
              ${a.banned ? '<span class="role-badge role-banned">BANNED</span>' : ''}
            </div>
            <div class="admin-row-sub">${a.games||0} trận · ${a.wins||0} thắng</div>
          </div>
        </div>
        <div class="admin-row-actions">
          <button class="btn-outline bevel-sm" onclick="UI.adminEditUser('${this.escapeHtml(name)}')">Sửa</button>
          ${canDelete && !isRootAdmin ? `
            <button class="btn-outline bevel-sm" onclick="UI.adminToggleBan('${this.escapeHtml(name)}')">${a.banned?'Unban':'Ban'}</button>
            <button class="btn-danger bevel-sm" onclick="UI.adminDelete('${this.escapeHtml(name)}')">Xóa</button>
          ` : ''}
        </div>
      </div>`;
  },
  adminSwitch(tab){ this._adminTab = tab; this.openAdminPanel(); },
  adminFilterUsers(){
    const q = (document.getElementById('adminSearch')?.value || '').toLowerCase();
    document.querySelectorAll('.admin-row').forEach(el => {
      el.style.display = el.dataset.username?.includes(q) ? '' : 'none';
    });
  },
  adminEditUser(username){
    const users = Storage.users();
    const a = users[username];
    if(!a) return;
    const avatarOpts = AVATARS.map(av => {
      const isImg = av.startsWith('http');
      const sel = a.avatar === av ? 'selected' : '';
      return `<div class="avatar-opt ${sel}" onclick="UI.adminSetAvatar('${this.escapeHtml(username)}','${av.replace(/'/g,"\\'")}')">${isImg ? `<img src="${av}">` : av}</div>`;
    }).join('');
    const user = this.currentUser();
    const isAdmin = user.isAdmin;
    this.openModal('admin-edit', `
      <h2>Sửa Người Dùng</h2>
      <p><b style="color:#ffd60a">${this.escapeHtml(username)}</b></p>
      <div class="admin-stats">
        <div class="admin-stat"><div class="admin-stat-val">${a.games||0}</div><div class="admin-stat-lbl">Trận</div></div>
        <div class="admin-stat"><div class="admin-stat-val">${a.wins||0}</div><div class="admin-stat-lbl">Thắng</div></div>
        <div class="admin-stat"><div class="admin-stat-val">${a.games?Math.round((a.wins/a.games)*100):0}%</div><div class="admin-stat-lbl">Tỷ lệ</div></div>
      </div>
      <div style="text-align:left;font-size:12px;font-weight:900;margin:8px 0">Đổi Avatar:</div>
      <div class="avatar-grid" style="max-height:35vh;overflow-y:auto">${avatarOpts}</div>
      <button class="btn-outline bevel-sm" onclick="UI.adminResetUserStats('${this.escapeHtml(username)}')">Reset Stats User Này</button>
      <button class="btn-outline bevel-sm" onclick="UI.openAdminPanel()">Quay Lại</button>
    `);
  },
  adminSetAvatar(username, avatar){ Auth.setAvatarAs(username, avatar); this.toast('Đã đổi avatar'); this.adminEditUser(username); },
  adminToggleRole(username, role){
    if(role === 'admin') Auth.toggleAdmin(username);
    else if(role === 'manager') Auth.toggleManager(username);
    this.toast('Đã cập nhật'); this.openAdminPanel();
  },
  adminToggleBan(username){ Auth.toggleBan(username); this.toast('Đã cập nhật'); this.openAdminPanel(); },
  adminDelete(username){
    if(username === Auth.ADMIN.username){ this.toast('Không thể xóa admin gốc'); return; }
    if(!confirm(`XÓA VĨNH VIỄN "${username}"?`)) return;
    Auth.deleteUser(username);
    this.toast('Đã xóa'); this.openAdminPanel();
  },
  adminResetUserStats(username){ Auth.resetUserStats(username); this.toast('Đã reset'); this.adminEditUser(username); },
  adminResetAll(){
    if(!confirm('Reset stats TẤT CẢ tài khoản?')) return;
    Auth.resetAllStats(); this.toast('Đã reset tất cả'); this.enterMenu(Auth.current()); this.openAdminPanel();
  },
  adminExport(){
    const data = JSON.stringify(Storage.users(), null, 2);
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ek-users-export-' + Date.now() + '.json';
    a.click();
    this.toast('Đã xuất dữ liệu');
  },

  /* ===== SOLO ===== */
  openSoloModal(){
    this.openModal('solo', `
      <h2>Solo với Bot</h2>
      <label class="lbl">Số người</label>
      <select id="soloCount">
        <option value="2">2</option>
        <option value="3" selected>3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </select>
      <label class="lbl">Độ khó Bot</label>
      <select id="soloBotMode">
        <option value="normal">Bình thường</option>
        <option value="smart" selected>Thông minh</option>
        <option value="ultimate">Tối thượng</option>
      </select>
      <button class="btn-primary bevel-sm" onclick="UI.startSoloFromModal()">Bắt Đầu</button>
      <button class="btn-outline bevel-sm" onclick="UI.closeModal()">Hủy</button>
    `);
  },
  startSoloFromModal(){
    const n = parseInt(document.getElementById('soloCount').value) || 3;
    const mode = document.getElementById('soloBotMode').value || 'smart';
    this.closeModal();
    this.startSoloGame(n, mode);
  },
  startSoloGame(total, botMode){
    const user = this.currentUser();
    if(!user) return;
    this.isHost = true;
    this.myId = 'p_' + U.uid();
    const players = [{id:this.myId, name:user.username, isBot:false, avatar:user.avatar}];
    for(let i=1;i<total;i++){
      players.push({id:'bot_'+i, name:BOT_NAMES[i % BOT_NAMES.length], isBot:true, avatar:'🤖'});
    }
    Engine.createGame(players, this.myId, botMode);
    this.enterGame(true);
  },

  /* ===== JOIN ROOM ===== */
  openJoinRoomModal(){
    this._codeInput = '';
    this.openModal('join', `
      <div class="keypad-modal">
        <h2>Vào Phòng</h2>
        <p>Nhập mã 6 số</p>
        <div class="keypad-display" id="keypadDisplay">
          ${[0,1,2,3,4,5].map(i => `<div class="code-slot" data-idx="${i}"></div>`).join('')}
        </div>
        <div class="keypad-grid">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="keypad-key" onclick="UI.keypadPress('${n}')">${n}</button>`).join('')}
          <button class="keypad-key del" onclick="UI.keypadBackspace()">⌫</button>
          <button class="keypad-key" onclick="UI.keypadPress('0')">0</button>
          <button class="keypad-key confirm" onclick="UI.keypadConfirm()">✓</button>
        </div>
        <button class="btn-outline bevel-sm" onclick="UI.closeModal()" style="width:100%;margin-top:8px">Hủy</button>
      </div>
    `);
    this._updateKeypadDisplay();
  },
  _updateKeypadDisplay(){
    const display = document.getElementById('keypadDisplay');
    if(!display) return;
    display.querySelectorAll('.code-slot').forEach((slot, i) => {
      slot.textContent = this._codeInput[i] || '';
      slot.classList.toggle('filled', i < this._codeInput.length);
      slot.classList.toggle('active', i === this._codeInput.length);
    });
  },
  keypadPress(d){ if(this._codeInput.length >= 6) return; this._codeInput += d; this._updateKeypadDisplay(); },
  keypadBackspace(){ this._codeInput = this._codeInput.slice(0, -1); this._updateKeypadDisplay(); },
  keypadConfirm(){
    if(this._codeInput.length !== 6) return this.toast('Nhập đủ 6 số');
    const c = this._codeInput; this._codeInput = ''; this.closeModal(); this.doJoinRoom(c);
  },

  /* ===== CREATE / JOIN ===== */
  createRoom(){
    const user = this.currentUser();
    if(!user) return;
    if(Net.peer) Net.close();
    this.roomCode = U.code();
    this.isHost = true;
    this.myId = 'p_' + U.uid();
    this.lobbyPlayers = [{id:this.myId, name:user.username, avatar:user.avatar, isHost:true, isBot:false}];
    this.showScreen('sc-lobby');
    document.getElementById('lobbyCode').textContent = this.roomCode;
    document.getElementById('lobbyStatus').innerHTML = '<span class="connecting"></span>Đang khởi tạo...';
    document.getElementById('hostControls').style.display = 'flex';
    document.getElementById('btnStart').style.display = 'block';
    document.getElementById('inviteFriendsBtn').style.display = user.isGuest ? 'none' : 'block';
    this.renderLobby();
    setTimeout(() => this.setupNet(true), 100);
  },
  doJoinRoom(code){
    if(Net.peer) Net.close();
    this.roomCode = code; this.isHost = false; this.lobbyPlayers = [];
    this.showScreen('sc-lobby');
    document.getElementById('lobbyCode').textContent = code;
    document.getElementById('lobbyStatus').innerHTML = '<span class="connecting"></span>Đang kết nối...';
    document.getElementById('hostControls').style.display = 'none';
    document.getElementById('btnStart').style.display = 'none';
    this.renderLobby();
    setTimeout(() => this.setupNet(false), 100);
  },
  setupNet(host){
    if(Net.peer) Net.close();
    if(host){
      Net.onHostReady = () => { document.getElementById('lobbyStatus').innerHTML = 'Phòng sẵn sàng · Chia sẻ mã'; };
      Net.onNewCode = (c) => { this.roomCode = c; document.getElementById('lobbyCode').textContent = c; };
      Net.onError = (msg) => {
        this.toast(msg);
        document.getElementById('lobbyStatus').innerHTML = `<span style="color:#ff8a7a">${this.escapeHtml(msg)}</span><br><button class="retry-btn" onclick="UI.leaveRoom()">Quay Lại</button>`;
      };
      Net.onJoin = (player, conn) => {
        if(this.lobbyPlayers.some(p => p.id === player.id)){ Net.send({type:'error', message:'ID trùng'}, conn); return; }
        if(this.lobbyPlayers.length >= 6){ Net.send({type:'error', message:'Phòng đầy'}, conn); return; }
        player.conn = conn;
        this.lobbyPlayers.push(player);
        this.broadcastLobby();
        this.renderLobby();
      };
      Net.onClientDisconnect = (conn, playerId) => {
        if(Engine.state && Engine.state.phase === 'playing' && playerId){
          const p = Engine.state.players.find(x => x.id === playerId);
          if(p && p.alive) Engine.handlePlayerDisconnect(playerId);
        }
        const idx = this.lobbyPlayers.findIndex(p => p.conn === conn);
        if(idx > -1){ this.lobbyPlayers.splice(idx, 1); this.broadcastLobby(); this.renderLobby(); }
      };
      Net.onAction = (pid, action, payload) => { try{ this.hostAction(pid, action, payload); } catch(e){ console.error(e); } };
      Net.onChat = (n, t) => this.addChatMsg(n, t);
      Net.host(this.roomCode);
    } else {
      Net.onConnectSuccess = () => {
        const user = this.currentUser();
        Net.send({type:'join', player:{id:this.myId, name:user.username, avatar:user.avatar}});
      };
      Net.onError = (msg) => {
        this.toast(msg);
        document.getElementById('lobbyStatus').innerHTML = `<span style="color:#ff8a7a">${this.escapeHtml(msg)}</span><br><button class="retry-btn" onclick="UI.leaveRoom()">Quay Lại</button>`;
      };
      Net.onLobby = (players) => { this.lobbyPlayers = players; this.renderLobby(); document.getElementById('lobbyStatus').innerHTML = 'Đã kết nối'; };
      Net.onStart = (state) => { Engine.state = state; this.enterGame(false); };
      Net.onState = (state) => { Engine.state = state; this.render(); this.updateModals(); this._processStateVFX(); };
      Net.onChat = (n, t) => this.addChatMsg(n, t);
      Net.onHostLeft = () => {
        if(Engine.state && Engine.state.phase === 'playing'){
          Engine.state.phase = 'ended';
          Engine.state.winner = Engine.state.players.find(p => p.id === this.myId) || null;
          this.render();
          this.showWinModal('Chủ phòng đã thoát');
        } else {
          this.toast('Chủ phòng đã rời');
          setTimeout(() => this.leaveRoom(), 1000);
        }
      };
      Net.join(this.roomCode);
    }
  },
  broadcastLobby(){
    if(!this.isHost) return;
    const safe = this.lobbyPlayers.map(p => ({id:p.id, name:p.name, isBot:p.isBot, isHost:p.isHost, avatar:p.avatar}));
    Net.send({type:'lobby', players:safe});
  },
  renderLobby(){
    const box = document.getElementById('lobbyPlayers');
    if(this.lobbyPlayers.length === 0){ box.innerHTML = '<div class="plist-empty">Đang chờ...</div>'; return; }
    box.innerHTML = this.lobbyPlayers.map(p => {
      const av = p.avatar || (p.isBot ? '🤖' : '👤');
      return `<div class="pitem">
        <div class="av">${p.isBot ? '🤖' : renderAvatarHTML(av, 38)}</div>
        <div class="nm">${this.escapeHtml(p.name)}${p.id===this.myId?' (bạn)':''}</div>
        <div class="st">${p.isHost?'HOST':(p.isBot?'BOT':'OK')}</div>
      </div>`;
    }).join('');
  },
  addBot(){
    if(this.lobbyPlayers.length >= 6) return this.toast('Tối đa 6');
    this.lobbyPlayers.push({id:'bot_'+U.uid(), name:U.pick(BOT_NAMES)+' '+(this.lobbyPlayers.length), isBot:true, isHost:false, avatar:'🤖'});
    this.broadcastLobby(); this.renderLobby();
  },
  removeBot(){
    const i = this.lobbyPlayers.findIndex(p => p.isBot);
    if(i > -1){ this.lobbyPlayers.splice(i, 1); this.broadcastLobby(); this.renderLobby(); }
    else this.toast('Không có bot');
  },
  openInviteFriends(){
    const user = this.currentUser();
    if(!user || user.isGuest) return this.toast('Cần đăng nhập');
    const friends = Social.getFriends(user.id);
    const accs = Storage.users();
    if(friends.length === 0){
      this.openModal('invite', `<h2>Mời Bạn Bè</h2><div class="empty"><div class="empty-txt">Chưa có bạn bè</div></div><button class="btn-primary bevel-sm" onclick="UI.closeModal();UI.openFriends()">Mở Bạn Bè</button>`);
      return;
    }
    this.openModal('invite', `
      <h2>Mời Bạn Bè</h2>
      <p>Phòng <b>${this.roomCode}</b></p>
      <div style="max-height:50vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;text-align:left">
        ${friends.map(f => {
          const av = accs[Auth.findUserById(f)]?.avatar || '👤';
          return `<div class="friend-row">
            <div class="friend-av">${renderAvatarHTML(av, 38)}</div>
            <div class="friend-name">${this.escapeHtml(Auth.findUserById(f)||'Tài khoản không còn tồn tại')} <small>${this.escapeHtml(f)}</small></div>
            <button class="btn-primary bevel-sm" onclick="UI.sendTeamInvite('${this.escapeHtml(f)}')">Mời</button>
          </div>`;
        }).join('')}
      </div>
      <button class="btn-outline bevel-sm" onclick="UI.closeModal()">Đóng</button>
    `);
  },
  sendTeamInvite(to){
    const user = this.currentUser();
    if(!user || !this.roomCode) return;
    const target=Auth.findUserById(to); if(!target) return this.toast('Không tìm thấy người chơi');
    Social.sendInvite(user.username, target, this.roomCode);
    this.toast(`Đã gửi lời mời tới ${target}`);
  },
  startMultiplayerGame(){
    if(this.lobbyPlayers.length < 2) return this.toast('Cần ≥ 2 người');
    const botMode = document.getElementById('lobbyBotMode')?.value || 'smart';
    const players = this.lobbyPlayers.map(p => ({id:p.id, name:p.name, isBot:p.isBot, avatar:p.avatar}));
    Engine.createGame(players, this.myId, botMode);
    Net.send({type:'start', state:U.clone(Engine.state)});
    this.enterGame(true);
  },
  copyCode(){
    if(!this.roomCode) return;
    navigator.clipboard?.writeText(this.roomCode).then(() => this.toast('Đã copy: ' + this.roomCode)).catch(() => {});
  },

  /* ===== GAME ===== */
  enterGame(asHost){
    this.isHost = asHost;
    this._statsRecorded = false;
    this._lastShownPlayId = null; this._lastEKEKId = null;
    this._animatedDrawId = null; this._animatedStealId = null;
    this._lastAlive = null; this._lastDeck = null; this._lastTurn = null;
    this._lastTurnsLeft = null; this._oppsSig = ''; this._discSig = '';
    this._lastCanDraw = null; this._lastLogSig = ''; this._handRenderSig = '';
    this.showScreen('sc-game');
    document.getElementById('chatFab').classList.add('on');
    this._dealing = true;
    this.render(); this.updateModals(); this._processStateVFX();
    setTimeout(() => { this._dealing = false; }, 1500);
    if(asHost) this.processBots();
  },
  leaveRoom(){
    const user = this.currentUser();
    if(Engine.state && Engine.state.phase === 'playing' && user && !user.isGuest){
      const me = Engine.state.players.find(p => p.id === this.myId);
      if(me && me.alive) Auth.updateStats(false);
    }
    if(Net.peer){
      if(this.isHost) Net.send({type:'host_left'});
      Net.close();
    }
    clearTimeout(Engine.pendingTimer); clearTimeout(Engine.choiceTimer);
    clearTimeout(this._hostWatchdogTimer); clearTimeout(this._nopeHighlightTimer);
    clearTimeout(this._showcaseTimeout);
    Engine.pendingTimer = null; Engine.choiceTimer = null;
    Engine.state = null;
    this.isHost = false; this.roomCode = null; this.lobbyPlayers = [];
    this.selectedCatIndices = []; this.botScheduled = false;
    this._lastPendingTs = null; this._lastShownPlayId = null; this._lastEKEKId = null;
    this._animatedDrawId = null; this._animatedStealId = null;
    this._alterCards = null;
    document.getElementById('chatFab').classList.remove('on');
    this.closeModal();
    const sc = document.getElementById('showcase');
    if(sc) sc.classList.remove('show');
    this.enterMenu(this.currentUser());
  },
  act(action, payload={}){
    if(!Engine.state) return;
    if(this.isHost) this.hostAction(this.myId, action, payload);
    else Net.send({type:'action', playerId:this.myId, action, payload});
  },
  hostAction(playerId, action, payload){
    let ok = false;
    try{
      switch(action){
        case 'play': ok = Engine.playCards(playerId, payload.cards, payload.targetId, payload.extra||{}); break;
        case 'draw': ok = Engine.drawCard(playerId); break;
        case 'nope': ok = Engine.playNope(playerId); break;
        case 'defuse': ok = Engine.placeDefuse(playerId, payload.pos); break;
        case 'favor': ok = Engine.resolveFavor(playerId, payload.idx); break;
        case 'clearPeek': ok = Engine.clearPeek(playerId); break;
        case 'alterFuture': ok = Engine.applyAlterFuture(playerId, payload.order); break;
      }
    } catch(e){ console.error('[Engine]', e); }
    if(!ok && this.isHost) Net.send({type:'state', state:U.clone(Engine.state)});
  },
  me(){ return Engine.state?.players.find(p => p.id === this.myId); },
  onEngineChange(meta){
    const me = this.me();
    const sig = me ? me.hand.join('|') : '';
    if(sig !== this._handSig){ this.selectedCatIndices = []; this._handSig = sig; }
    if(this.isHost) Net.send({type:'state', state:U.clone(Engine.state)});
    this.render(); this.updateModals(); this._processStateVFX();
    if(this.isHost){ this.processBots(); this._armHostWatchdog(); }
  },
  _armHostWatchdog(){
    if(!this.isHost) return;
    clearTimeout(this._hostWatchdogTimer);
    const s = Engine.state;
    if(!s || s.phase !== 'playing') return;
    let timeout = 0;
    if(s.pending) timeout = (s.pending.windowMs || NOPE_WINDOW) + 3000;
    else if(s.awaitingChoice){
      if(s.awaitingChoice.playerId?.startsWith('bot_') || s.awaitingChoice.targetId?.startsWith('bot_')) return;
      timeout = CHOICE_TIMEOUT + 3000;
    } else if(s.peekFor && !s.peekFor.playerId.startsWith('bot_')) timeout = 60000;
    else if(s.alterFor && !s.alterFor.playerId.startsWith('bot_')) timeout = 60000;
    if(timeout > 0){
      this._hostWatchdogTimer = setTimeout(() => {
        if(!this.isHost) return;
        const st = Engine.state;
        if(!st || st.phase !== 'playing') return;
        if(st.pending) Engine.resolvePending();
        else if(st.awaitingChoice?.type === 'favor'){
          const t = Engine.byId(st.awaitingChoice.targetId);
          if(t && t.hand.length > 0) Engine.resolveFavor(t.id, Math.floor(Math.random() * t.hand.length));
          else { st.awaitingChoice = null; Engine.notify(); }
        } else if(st.awaitingChoice?.type === 'defuse'){
          Engine.placeDefuse(st.awaitingChoice.playerId, 'random');
        } else if(st.peekFor){ st.peekFor = null; Engine.notify(); }
        else if(st.alterFor){ st.alterFor = null; Engine.notify(); }
      }, timeout);
    }
  },
  _processStateVFX(){
    const s = Engine.state;
    if(!s) return;

    // ---- Showcase card played ----
    if(s.lastPlay && s.lastPlay.id !== this._lastShownPlayId){
      this._lastShownPlayId = s.lastPlay.id;
      const player = Engine.byId(s.lastPlay.playerId);
      const info = CARD_TYPES[cardType(s.lastPlay.card)];
      if(player && info){
        this.showPlayedCard(s.lastPlay.card, player.name, info.short, player.id);
        this.showNotif(`${player.name} đã dùng ${info.name}`);
      }
    }

    // ---- Draw card animation ----
    if(s.lastDraw && s.lastDraw.id !== this._animatedDrawId){
      this._animatedDrawId = s.lastDraw.id;
      const isMe = s.lastDraw.playerId === this.myId;
      this.animateDraw(s.lastDraw.playerId, s.lastDraw.card, isMe, s.lastDraw.fromBottom);
      if(s.lastDraw.isEK && s.lastDraw.id !== this._lastEKEKId){
        this._lastEKEKId = s.lastDraw.id;
        const drawer = Engine.byId(s.lastDraw.playerId);
        if(drawer && !drawer.alive){
          this.showNotif(`MÈO NỔ! ${drawer.name} bị loại`);
          const deck = document.getElementById('deckPile');
          if(deck){ const r = deck.getBoundingClientRect(); setTimeout(() => VFX.explode(r.left + r.width/2, r.top + r.height/2), 100); }
        } else if(drawer && drawer.alive){
          this.showNotif(`MÈO NỔ! ${drawer.name} đã gỡ bom`);
        }
      }
    }

    // ---- STEAL SHOWCASE (cướp / mất bài) ----
    if(s.lastSteal && s.lastSteal.id !== this._animatedStealId){
      this._animatedStealId = s.lastSteal.id;
      const thief = Engine.byId(s.lastSteal.thiefId);
      const victim = Engine.byId(s.lastSteal.victimId);
      const info = CARD_TYPES[cardType(s.lastSteal.card)];
      if(thief && victim){
        const isThief = thief.id === this.myId;
        const isVictim = victim.id === this.myId;
        if(isThief || isVictim){
          const label = isThief ? 'CƯỚP ĐƯỢC' : 'BỊ MẤT';
          const other = isThief ? victim.name : thief.name;
          this.showcaseCard(s.lastSteal.card, label, isThief ? `từ ${other}` : `bởi ${other}`);
        }
        this.showNotif(`${thief.name} lấy ${info.name} từ ${victim.name}`);
      }
    }

    // ---- Shuffle ----
    const lastLog = s.logs[s.logs.length-1] || '';
    if(lastLog.includes('xáo bài') && !this.isShuffling){
      this.isShuffling = true;
      const deck = document.getElementById('deckPile');
      if(deck){
        deck.classList.add('shuffling');
        setTimeout(() => { deck.classList.remove('shuffling'); this.isShuffling = false; }, 800);
      }
    }
  },

  // 1-line notification (2 bevel corners)
  showNotif(text){
    const el = document.getElementById('notif');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._notifTimeout);
    this._notifTimeout=setTimeout(()=>el.classList.remove('show'),2100);
  },

  // Show a card overlay (used for played & steal)
  showcaseCard(card, label, action){
    const sc = document.getElementById('showcase');
    const cardEl = document.getElementById('scCard');
    const labelEl = document.getElementById('scLabel');
    const actionEl = document.getElementById('scAction');
    if(!sc) return;
    const info = cardInfo(card);
    cardEl.innerHTML = `<img src="${cardImage(card)}" onerror="this.parentElement.innerHTML='<div style=&quot;padding:20px;font-size:24px;font-weight:900;color:#fff;text-align:center;line-height:1.4&quot;>${info.short}</div>'" alt="">`;
    labelEl.textContent = label;
    actionEl.textContent = action;
    clearTimeout(this._showcaseTimeout);
    sc.classList.remove('fast'); void sc.offsetWidth;
    sc.classList.add('show');
    this._showcaseTimeout = setTimeout(() => sc.classList.remove('show'), 1900);
  },
  showPlayedCard(card, playerName, actionText, playerId){
    const type=cardType(card);
    if(playerId!==this.myId || ['SHUFFLE','SKIP','ATTACK'].includes(type)){ this.animatePlayedToTable(card, playerId); return; }
    this.showcaseCard(card, playerName, actionText);
  },
  animatePlayedToTable(card, playerId){
    const source=playerId===this.myId?document.getElementById('handArea'):document.querySelector(`.opp[data-player-id="${CSS.escape(String(playerId||''))}"]`);
    const table=document.getElementById('tableArea')||document.getElementById('gameTable')||document.getElementById('deckPile');
    if(!source||!table)return; const a=source.getBoundingClientRect(),b=table.getBoundingClientRect();
    const el=document.createElement('div'); el.className='anim-card anim-to-table';
    const info=cardInfo(card); el.innerHTML=`<img src="${cardImage(card)}" onerror="this.closest('.anim-card').classList.add('no-img')" alt=""><div class="anim-fallback">${info.short}</div>`;
    el.style.left=(a.left+a.width/2-47)+'px'; el.style.top=(a.top+a.height/2-68)+'px'; document.body.appendChild(el);
    const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2);
    el.animate([{transform:'translate(0,0) scale(.82)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.58) rotate(8deg)`,opacity:.25}],{duration:480,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'}).onfinish=()=>el.remove();
  },
  animateDraw(playerId, card, isMe, fromBottom=false){
    const deckEl = document.getElementById('deckPile');
    if(!deckEl) return;
    const s = Engine.state;
    const startRect = deckEl.getBoundingClientRect();
    let endEl;
    if(isMe){ endEl = document.getElementById('handArea'); }
    else {
      const opps = document.querySelectorAll('.opp');
      const oppIdx = s.players.filter(p => p.id !== this.myId).findIndex(p => p.id === playerId);
      endEl = opps[oppIdx];
    }
    if(!endEl) return;
    const endRect = endEl.getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'anim-card';
    if(isMe){
      const img = cardImage(card), info = cardInfo(card);
      flyer.innerHTML = `<img src="${img}" onerror="this.closest('.anim-card').classList.add('no-img')" alt=""><div class="anim-fallback">${info.short}</div>`;
    } else {
      flyer.innerHTML = '<div class="anim-back">?</div>';
    }
    const startX = startRect.left, startY = startRect.top;
    flyer.style.left = startX + 'px';
    flyer.style.top = startY + 'px';
    document.body.appendChild(flyer);
    const endX = endRect.left + endRect.width/2 - startX - 47;
    const endY = endRect.top + endRect.height/2 - startY - 68;
    flyer.animate([
      {transform:'translate(0,0) rotate(0) scale(.75)', opacity:0.7},
      {transform:`translate(${endX*0.18}px,${endY*0.18 - 95}px) rotate(-8deg) scale(1.75)`, opacity:1, offset:0.32},
      {transform:`translate(${endX*0.42}px,${endY*0.42 - 35}px) rotate(4deg) scale(1.15)`, opacity:1, offset:0.62},
      {transform:`translate(${endX}px,${endY}px) rotate(0) scale(0.72)`, opacity:0.2}
    ], {duration:850, easing:'cubic-bezier(0.4,0,0.2,1)', fill:'forwards'}).onfinish = () => flyer.remove();
  },

  /* ===== RENDER ===== */
  render(){
    const s = Engine.state;
    if(!s) return;
    const alive = s.players.filter(p => p.alive).length;
    if(this._lastAlive !== alive){ document.getElementById('uiAlive').textContent = alive; this._lastAlive = alive; }
    if(this._lastDeck !== s.deck.length){
      document.getElementById('uiDeck').textContent = s.deck.length;
      document.getElementById('deckBadge').textContent = s.deck.length;
      this._lastDeck = s.deck.length;
    }
    const cur = Engine.cur();
    const turnName = cur?.name || '?';
    if(this._lastTurn !== turnName){ document.getElementById('uiTurn').textContent = 'Lượt ' + turnName; this._lastTurn = turnName; }
    const turnsLeftStr = s.turnsLeft > 1 ? '×' + s.turnsLeft : '';
    if(this._lastTurnsLeft !== turnsLeftStr){
      const tEl = document.getElementById('uiTurnsLeft');
      if(s.turnsLeft > 1){ tEl.style.display='inline-block'; tEl.textContent = '×' + s.turnsLeft; }
      else tEl.style.display = 'none';
      this._lastTurnsLeft = turnsLeftStr;
    }
    // Opponents
    const opps = s.players.filter(p => p.id !== this.myId);
    const oppsSig = opps.map(p => p.id + ':' + p.alive + ':' + p.hand.length + ':' + (p.avatar||'')).join('|') + '§' + (cur?.id || '');
    if(oppsSig !== this._oppsSig){
      this._oppsSig = oppsSig;
      document.getElementById('opponentsArea').innerHTML = opps.map(p => {
        const isTurn = p.id === cur?.id;
        const av = p.avatar || (p.isBot ? '🤖' : '👤');
        return `<div data-player-id="${this.escapeHtml(p.id)}" class="opp ${isTurn?'turn':''} ${p.alive?'':'dead'}">
          <div class="opp-av">${p.isBot ? '🤖' : renderAvatarHTML(av, 38)}</div>
          <div class="opp-name">${this.escapeHtml(p.name)}</div>
          <div class="opp-cnt">${p.hand.length} lá</div>
        </div>`;
      }).join('');
    }
    // Discard
    const discSig = s.discard.length > 0 ? s.discard[s.discard.length-1] : 'empty';
    if(this._discSig !== discSig){
      this._discSig = discSig;
      const dp = document.getElementById('discardPile');
      if(s.discard.length > 0){
        const last = s.discard[s.discard.length-1];
        dp.innerHTML = `<img src="${cardImage(last)}" onerror="this.parentElement.textContent='?'" alt="">`;
      } else dp.textContent = '—';
    }
    // Can draw
    const canDraw = cur?.id === this.myId && !s.pending && !s.awaitingChoice && !s.alterFor && s.phase === 'playing';
    const canStr = canDraw ? 'y' : 'n';
    if(this._lastCanDraw !== canStr){
      this._lastCanDraw = canStr;
      const dp = document.getElementById('deckPile');
      dp.classList.toggle('can', canDraw);
      dp.classList.toggle('locked', !canDraw);
    }
    // Log
    const logSig = s.logs.slice(-3).join('|');
    if(this._lastLogSig !== logSig){
      this._lastLogSig = logSig;
      document.getElementById('gameLog').innerHTML = s.logs.slice(-3).join('<br>');
    }
    this.renderHand();
    this.renderHandActionBar();
  },

  renderHand(){
    const s = Engine.state;
    const me = this.me();
    if(!me) return;
    const hasPending = !!s.pending && s.pending.playerId !== this.myId;
    const canNopeNow = hasPending && this._nopeHighlightTimer;
    const cur = Engine.cur();
    const isMyTurn = cur?.id === this.myId;
    const canPlay = isMyTurn && !s.pending && !s.awaitingChoice && !s.alterFor && s.phase === 'playing';
    const sig = me.hand.join('|') + '§' + this.selectedCatIndices.join(',') + '§' + (canNopeNow?'1':'0') + '§' + (canPlay?'1':'0') + '§' + me.hand.length;
    if(sig === this._handRenderSig) return;
    this._handRenderSig = sig;
    document.getElementById('uiHandCount').textContent = me.hand.length;
    const handArea = document.getElementById('handArea');
    handArea.innerHTML = me.hand.map((card, idx) => {
      const info = cardInfo(card);
      const img = cardImage(card);
      const isNopeCard = cardType(card) === 'NOPE';
      const nopeActive = canNopeNow && isNopeCard;
      const dis = (!canPlay && !nopeActive) ? 'dis' : '';
      const isSelected = this.selectedCatIndices.includes(idx);
      return `<div class="card ${dis} ${isSelected?'selected':''} ${nopeActive?'nope-active':''}" data-idx="${idx}" onclick="UI.onCardClick(${idx})">
        <img src="${img}" onerror="this.closest('.card').classList.add('no-img')" alt="">
        <div class="card-fallback">${info.short}</div>
      </div>`;
    }).join('');
  },

  renderHandActionBar(){
    const bar = document.getElementById('handActionBar');
    const s = Engine.state;
    const me = this.me();
    if(!me || this.selectedCatIndices.length === 0){ bar.classList.remove('on'); bar.innerHTML = ''; return; }
    const cards = this.selectedCatIndices.map(i => me.hand[i]);
    const types = cards.map(cardType);
    const isCat = types.every(t => t === 'CAT');
    const sameVariant = isCat && cards.every(c => c === cards[0]);
    if(isCat && !sameVariant){
      bar.innerHTML = `<span style="color:#ff8a7a">Phải chọn các lá Mèo CÙNG LOẠI</span>`;
      bar.classList.add('on'); return;
    }
    if(isCat && sameVariant && (cards.length === 2 || cards.length === 3)){
      const targets = s.players.filter(p => p.alive && p.id !== this.myId && p.hand.length > 0);
      bar.innerHTML = `<span>Mèo ×${cards.length} · Chọn đối thủ:</span>${targets.map(t => `<button class="btn-primary" onclick="UI.playCat('${t.id}')">${this.escapeHtml(t.name)}</button>`).join('')}<button class="btn-outline" onclick="UI.clearSelection()">Hủy</button>`;
    } else if(cards.length === 1){
      const t = types[0], info = CARD_TYPES[t];
      const nonCatPlayable = ['ATTACK','SKIP','SHUFFLE','SEE_FUTURE','ALTER_FUTURE','RUT_TU_DAY'].includes(t);
      const needsTarget = t === 'FAVOR';
      if(nonCatPlayable){
        bar.innerHTML = `<span>${info.name}</span><button class="btn-primary" onclick="UI.playSingle()">Đánh</button><button class="btn-outline" onclick="UI.clearSelection()">Hủy</button>`;
      } else if(needsTarget){
        const targets = s.players.filter(p => p.alive && p.id !== this.myId && p.hand.length > 0);
        bar.innerHTML = `<span>${info.name} · Chọn đối thủ:</span>${targets.map(t => `<button class="btn-primary" onclick="UI.playSingle('${t.id}')">${this.escapeHtml(t.name)}</button>`).join('')}<button class="btn-outline" onclick="UI.clearSelection()">Hủy</button>`;
      } else {
        bar.innerHTML = `<span>${info.name} không thể đánh trực tiếp</span><button class="btn-outline" onclick="UI.clearSelection()">Hủy</button>`;
      }
    } else {
      bar.innerHTML = `<span>Chọn thêm lá bài</span><button class="btn-outline" onclick="UI.clearSelection()">Hủy</button>`;
    }
    bar.classList.add('on');
  },

  onCardClick(idx){
    const s = Engine.state;
    const me = this.me();
    if(!me || !me.hand[idx]) return;
    const card = me.hand[idx];
    if(s.pending && cardType(card) === 'NOPE' && s.pending.playerId !== this.myId && this._nopeHighlightTimer){
      this.doNope(); return;
    }
    if(!Engine.canAct(this.myId, 'play')) return;
    if(['EK','DEFUSE','NOPE'].includes(cardType(card))) return this.toast('Không thể đánh lá này trực tiếp');
    if(this.selectedCatIndices.includes(idx)){
      this.selectedCatIndices = this.selectedCatIndices.filter(i => i !== idx);
    } else {
      const curType = cardType(card);
      if(curType === 'CAT'){
        const existing = this.selectedCatIndices.filter(i => cardType(me.hand[i]) === 'CAT');
        if(existing.length > 0 && me.hand[existing[0]] !== card){ this.toast('Mèo phải cùng loại'); return; }
      } else if(this.selectedCatIndices.length > 0){ this.toast('Không thể chọn lẫn lộn'); return; }
      this.selectedCatIndices.push(idx);
    }
    this.renderHand(); this.renderHandActionBar();
  },
  clearSelection(){ this.selectedCatIndices = []; this._handRenderSig = ''; this.renderHand(); this.renderHandActionBar(); },
  playSingle(targetId){
    const me = this.me();
    if(this.selectedCatIndices.length !== 1) return;
    const card = me.hand[this.selectedCatIndices[0]];
    const t = cardType(card);
    this.selectedCatIndices = [];
    if(t === 'FAVOR') this.act('play', {cards:[card], targetId});
    else this.act('play', {cards:[card]});
  },
  playCat(targetId){
    const me = this.me();
    const cards = this.selectedCatIndices.map(i => me.hand[i]);
    if(cards.length === 2){ this.selectedCatIndices = []; this.act('play', {cards, targetId}); }
    else if(cards.length === 3) this.showNamedCatPicker(cards, targetId);
  },
  showNamedCatPicker(cards, targetId){
    this.openModal('named', `
      <h2>Gọi Tên Lá</h2>
      <p>Chọn loại lá muốn lấy</p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-height:50vh;overflow-y:auto">
        ${Object.entries(CARD_TYPES).filter(([k]) => k !== 'EK').map(([k, info]) => {
          const sample = makeCard(k);
          return `<button class="btn-outline bevel-sm" style="padding:10px;display:flex;align-items:center;gap:8px;justify-content:flex-start" onclick="UI.confirmNamedCat('${k}')">
            <img src="${cardImage(sample)}" style="width:32px;height:46px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'" alt="">
            <span style="font-size:12px;font-weight:900">${info.name}</span>
          </button>`;
        }).join('')}
      </div>
    `);
    this._pendingCatCards = cards;
    this._pendingCatTarget = targetId;
  },
  confirmNamedCat(namedType){
    this.closeModal();
    if(!this._pendingCatCards) return;
    this.selectedCatIndices = [];
    this.act('play', {cards: this._pendingCatCards, targetId: this._pendingCatTarget, extra: {namedType}});
    this._pendingCatCards = null; this._pendingCatTarget = null;
  },
  onDrawClick(){
    if(!Engine.state) return;
    if(!Engine.canAct(this.myId, 'draw')) return;
    this.act('draw');
  },

  updateModals(){
    const s = Engine.state;
    if(!s) return;
    // NOPE highlight
    if(s.pending && s.pending.playerId !== this.myId){
      const me = this.me();
      const hasNope = me && me.hand.some(c => cardType(c) === 'NOPE');
      const isTarget = s.pending.targetId === this.myId;
      const canNope = hasNope && (isTarget || s.pending.primaryType !== 'FAVOR');
      if(canNope && !this._nopeHighlightTimer){
        this._nopeHighlightTimer = setTimeout(() => {
          this._nopeHighlightTimer = null;
          this._handRenderSig = '';
          this.renderHand();
        }, NOPE_WINDOW);
        this._handRenderSig = '';
        this.renderHand();
      }
    } else {
      if(this._nopeHighlightTimer){
        clearTimeout(this._nopeHighlightTimer);
        this._nopeHighlightTimer = null;
        this._handRenderSig = '';
        this.renderHand();
      }
    }
    // Defuse
    if(s.awaitingChoice?.type === 'defuse' && s.awaitingChoice.playerId === this.myId){
      if(this.currentModal !== 'defuse'){
        this.openModal('defuse', `
          <h2>Gỡ Bom</h2>
          <p>Chọn vị trí giấu bom trong bộ bài:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn-primary bevel-sm" onclick="UI.doDefuse('top')">Trên cùng</button>
            <button class="btn-outline bevel-sm" onclick="UI.doDefuse('middle')">Giữa</button>
            <button class="btn-outline bevel-sm" onclick="UI.doDefuse('bottom')">Dưới cùng</button>
          </div>
        `);
      }
    } else if(this.currentModal === 'defuse') this.closeModal();
    // Peek
    if(s.peekFor?.playerId === this.myId && this.currentModal !== 'peek'){
      const cards = s.peekFor.cards;
      this.openModal('peek', `
        <h2>Nhìn Trước</h2>
        <p>3 lá trên cùng (trên xuống):</p>
        <div style="display:flex;justify-content:center;gap:10px;margin:12px 0;flex-wrap:wrap">
          ${cards.map(c => `<div style="width:76px;height:110px;border-radius:10px;overflow:hidden;border:2.5px solid #fff;background:#1a0f0d"><img src="${cardImage(c)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${cardInfo(c).short}';this.parentElement.style.cssText='width:76px;height:110px;color:#fff;font-weight:900;font-size:11px;display:flex;align-items:center;justify-content:center;background:#1a0f0d;border-radius:10px;border:2.5px solid #fff'" alt=""></div>`).join('')}
        </div>
        <button class="btn-primary bevel-sm" onclick="UI.doClearPeek()">Đã Xem</button>
      `);
    } else if(this.currentModal === 'peek' && !s.peekFor) this.closeModal();
    // Alter
    if(s.alterFor?.playerId === this.myId && this.currentModal !== 'alter'){
      if(!this._alterCards) this._alterCards = [...s.alterFor.cards];
      const renderAlter = () => this._alterCards.map((c, i) => `
        <div class="alter-slot">
          <div class="alter-slot-label">Vị trí ${i+1}</div>
          <div class="card" style="width:64px;height:92px">
            <img src="${cardImage(c)}" onerror="this.closest('.card').classList.add('no-img')" alt="">
            <div class="card-fallback">${cardInfo(c).short}</div>
          </div>
          <div class="alter-arrows">
            <button class="btn-outline" onclick="UI.moveAlter(${i},-1)" ${i===0?'disabled':''}>▲</button>
            <button class="btn-outline" onclick="UI.moveAlter(${i},1)" ${i===this._alterCards.length-1?'disabled':''}>▼</button>
          </div>
        </div>
      `).join('');
      this.openModal('alter', `
        <h2>Biến Đổi Tương Lai</h2>
        <p>Lá trên cùng ở trên. Sắp xếp lại:</p>
        <div id="alterList" style="display:flex;flex-direction:column;gap:8px;margin:12px 0">${renderAlter()}</div>
        <button class="btn-primary bevel-sm" onclick="UI.doAlterFuture()">Xác Nhận</button>
      `);
    } else if(this.currentModal === 'alter' && !s.alterFor){
      this.closeModal(); this._alterCards = null;
    }
    // Favor
    if(s.awaitingChoice?.type === 'favor' && s.awaitingChoice.targetId === this.myId && this.currentModal !== 'favor'){
      const me = this.me();
      this.openModal('favor', `
        <h2>Xin Bài</h2>
        <p>Chọn 1 lá để đưa cho đối thủ:</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-height:50vh;overflow-y:auto">
          ${me.hand.map((c, i) => `<div class="card" onclick="UI.doFavor(${i})" style="cursor:pointer"><img src="${cardImage(c)}" onerror="this.closest('.card').classList.add('no-img')" alt=""><div class="card-fallback">${cardInfo(c).short}</div></div>`).join('')}
        </div>
      `);
    } else if(this.currentModal === 'favor' && !s.awaitingChoice) this.closeModal();
    // Win
    if(s.phase === 'ended' && !this._statsRecorded){
      this._statsRecorded = true;
      const user = this.currentUser();
      if(user && !user.isGuest && s.winner) Auth.updateStats(s.winner.id === this.myId);
      setTimeout(() => this.showWinModal(), 500);
    }
  },

  doNope(){
    if(this._nopeHighlightTimer){ clearTimeout(this._nopeHighlightTimer); this._nopeHighlightTimer = null; }
    this.act('nope');
  },
  doDefuse(pos){ this.closeModal(); this.act('defuse', {pos: pos==='middle'?'random':pos}); },
  doClearPeek(){ this.act('clearPeek'); },
  moveAlter(idx, dir){
    if(!this._alterCards) return;
    const n = idx + dir;
    if(n < 0 || n >= this._alterCards.length) return;
    [this._alterCards[idx], this._alterCards[n]] = [this._alterCards[n], this._alterCards[idx]];
    const list = document.getElementById('alterList');
    if(list){
      list.innerHTML = this._alterCards.map((c, i) => `
        <div class="alter-slot">
          <div class="alter-slot-label">Vị trí ${i+1}</div>
          <div class="card" style="width:64px;height:92px">
            <img src="${cardImage(c)}" onerror="this.closest('.card').classList.add('no-img')" alt="">
            <div class="card-fallback">${cardInfo(c).short}</div>
          </div>
          <div class="alter-arrows">
            <button class="btn-outline" onclick="UI.moveAlter(${i},-1)" ${i===0?'disabled':''}>▲</button>
            <button class="btn-outline" onclick="UI.moveAlter(${i},1)" ${i===this._alterCards.length-1?'disabled':''}>▼</button>
          </div>
        </div>
      `).join('');
    }
  },
  doAlterFuture(){
    if(!this._alterCards) return;
    this.act('alterFuture', {order: this._alterCards});
    this._alterCards = null;
    this.closeModal();
  },
  doFavor(idx){ this.closeModal(); this.act('favor', {idx}); },
  showWinModal(msg){
    const s = Engine.state, w = s?.winner;
    const isMe = w?.id === this.myId;
    this.openModal('win', `
      <h2 style="font-size:32px">${isMe?'CHIẾN THẮNG':'THUA RỒI'}</h2>
      <p style="font-size:15px">${msg || (w ? `${w.name} là người sống sót cuối cùng` : 'Không có người thắng')}</p>
      <button class="btn-primary bevel-sm" onclick="UI.leaveRoom()">Về Menu</button>
    `);
  },

  /* ===== BOTS ===== */
  processBots(){
    if(!this.isHost) return;
    if(!Engine.state || Engine.state.phase !== 'playing') return;
    if(this.botScheduled) return;
    this.botScheduled = true;
    setTimeout(() => { this.botScheduled = false; this._runBotTurn(); }, 800 + Math.random() * 600);
  },
  _runBotTurn(){
    const s = Engine.state;
    if(!s || s.phase !== 'playing' || !this.isHost) return;
    if(s.awaitingChoice?.type === 'defuse' && s.awaitingChoice.playerId.startsWith('bot_')){
      Engine.placeDefuse(s.awaitingChoice.playerId, U.pick(['top','random','bottom'])); return;
    }
    if(s.awaitingChoice?.type === 'favor' && s.awaitingChoice.targetId.startsWith('bot_')){
      const t = Engine.byId(s.awaitingChoice.targetId);
      if(t && t.hand.length > 0) Engine.resolveFavor(t.id, Math.floor(Math.random() * t.hand.length));
      return;
    }
    if(s.peekFor?.playerId.startsWith('bot_')){
      setTimeout(() => { if(this.isHost && s.peekFor) Engine.clearPeek(s.peekFor.playerId); }, 800);
      return;
    }
    if(s.alterFor?.playerId.startsWith('bot_')){
      const cards = [...s.alterFor.cards];
      if(Math.random() < 0.5) U.shuffle(cards);
      Engine.applyAlterFuture(s.alterFor.playerId, cards);
      return;
    }
    if(s.pending || s.awaitingChoice || s.alterFor) return;
    const cur = Engine.cur();
    if(!cur || !cur.isBot) return;
    const mode = BOT_MODES[s.botMode] || BOT_MODES.smart;
    const p = cur, hand = p.hand;
    if(Math.random() < mode.playProb){
      const playable = [];
      const catCounts = {};
      hand.forEach(c => { if(cardType(c) === 'CAT') catCounts[c] = (catCounts[c] || 0) + 1; });
      Object.entries(catCounts).forEach(([card, count]) => {
        if(count >= 2 && Math.random() < mode.catProb) playable.push({cards: Array(count).fill(card), type:'CAT'});
      });
      hand.forEach(c => {
        const t = cardType(c);
        if(['ATTACK','SKIP','SHUFFLE','SEE_FUTURE','ALTER_FUTURE','RUT_TU_DAY','FAVOR'].includes(t)) playable.push({cards:[c], type:t});
      });
      if(playable.length > 0){
        const choice = U.pick(playable);
        let targetId = null;
        if(choice.type === 'CAT' || choice.type === 'FAVOR'){
          const targets = s.players.filter(x => x.alive && x.id !== p.id && x.hand.length > 0);
          if(targets.length === 0) return Engine.drawCard(p.id);
          if(mode.smartTarget){
            targets.sort((a,b) => choice.type === 'CAT' ? b.hand.length - a.hand.length : a.hand.length - b.hand.length);
            targetId = targets[0].id;
          } else targetId = U.pick(targets).id;
        }
        if(choice.type === 'CAT'){
          const extra = choice.cards.length === 3 ? {namedType: U.pick(['DEFUSE','NOPE','ATTACK','SKIP','FAVOR'])} : {};
          Engine.playCards(p.id, choice.cards, targetId, extra);
        } else Engine.playCards(p.id, choice.cards, targetId);
        return;
      }
    }
    Engine.drawCard(p.id);
  },

  /* ===== CHAT & TOAST ===== */
  toggleChat(){
    document.getElementById('chatPanel').classList.toggle('on');
    document.getElementById('chatOverlay').classList.toggle('on');
  },
  sendChat(){
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    const user = this.currentUser();
    if(!user) return;
    input.value = '';
    if(Net.peer) Net.send({type:'chat', name:user.username, text});
    else this.addChatMsg(user.username, text);
  },
  addChatMsg(name, text){
    const box = document.getElementById('chatMsgs');
    const div = document.createElement('div');
    div.innerHTML = `<span class="chat-u">${this.escapeHtml(name)}:</span> ${this.escapeHtml(text)}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },
  toast(msg){
    let el=document.getElementById('appToast');
    if(!el){el=document.createElement('div');el.id='appToast';document.body.appendChild(el);}
    el.className='toast'; el.textContent=String(msg); el.classList.remove('toast-hide'); void el.offsetWidth;
    clearTimeout(this._toastTimer); clearTimeout(this._toastRemoveTimer);
    this._toastTimer=setTimeout(()=>{el.classList.add('toast-hide');this._toastRemoveTimer=setTimeout(()=>el.remove(),300);},2300);
  }
};
