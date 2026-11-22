/* ==============================================
   UI — Base UI (screens, modals, toast, chat)
   ============================================== */
(function(window){
  'use strict';
  const {AVATARS} = window.CONFIG;
  const {U, renderAvatarHTML} = window;

  window.UI = {
    // State
    myId: null, roomCode: null, isHost: false,
    lobbyPlayers: [], currentModal: null,
    _pollTimer: null, _shownInvites: new Set(),
    _friendsTab: 'list',

    init(){
      this.myId = 'p_' + U.uid();
      this.switchAuthTab('login');
      const cur = window.Users.current();
      if (cur) this.enterMenu(cur);
      else this.showScreen('sc-auth');
      this._pollTimer = setInterval(() => this._pollSocial(), 2500);
      this._setupExitGuards();
    },

    _setupExitGuards(){
      try { history.pushState({ekPage:'app'}, '', location.href); } catch(e){}
      window.addEventListener('popstate', () => {
        const inGame = window.Engine.state && window.Engine.state.phase === 'playing';
        if (inGame){
          try { history.pushState({ekPage:'app'}, '', location.href); } catch(e){}
          if (confirm('⚠️ Trận đấu đang diễn ra!\n\nBạn có chắc muốn thoát? Sẽ bị xử thua.')){
            window.Engine.state = null;
            this.leaveRoom();
          }
        }
      });
      window.addEventListener('beforeunload', (e) => {
        if (window.Engine.state && window.Engine.state.phase === 'playing'){
          const msg = 'Trận đấu đang diễn ra. Thoát?';
          e.preventDefault(); e.returnValue = msg; return msg;
        }
      });
    },

    _pollSocial(){
      const acc = window.Users.current();
      if (!acc) return;
      const incoming = window.Social.incoming(acc.username);
      const badge = document.getElementById('friendsBadge');
      if (badge){
        if (incoming.length > 0){ badge.textContent = incoming.length; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
      }
      const invites = window.Social.incomingInvites(acc.username);
      invites.forEach(inv => {
        if (this._shownInvites.has(inv.ts)) return;
        this._shownInvites.add(inv.ts);
        this.showTeamInvite(inv);
      });
    },
    showTeamInvite(inv){
      const el = document.createElement('div');
      el.className = 'liquid bevel';
      el.style.cssText = 'position:fixed;top:20px;right:20px;max-width:320px;padding:16px;z-index:9999';
      el.innerHTML = `
        <div style="font-weight:900;margin-bottom:6px">Lời mời vào đội</div>
        <div style="font-size:12px;color:#fff;margin-bottom:10px">
          <b>${U.escape(inv.from)}</b> mời bạn vào phòng <b>${inv.roomCode}</b>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-primary" style="flex:1;padding:8px;font-size:12px" onclick='UI.acceptTeamInvite(${inv.ts}, "${inv.roomCode}")'>Đồng ý</button>
          <button class="btn-secondary" style="flex:1;padding:8px;font-size:12px" onclick='UI.rejectTeamInvite(${inv.ts})'>Từ chối</button>
        </div>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 15000);
    },
    acceptTeamInvite(ts, roomCode){
      window.Social.acceptInvite(ts);
      this.toast('Đã chấp nhận');
      setTimeout(() => this.doJoinRoom(roomCode), 300);
    },
    rejectTeamInvite(ts){ window.Social.rejectInvite(ts); this.toast('Đã từ chối'); },

    showScreen(id){
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
      document.getElementById(id)?.classList.add('on');
    },
    currentUser(){ return window.Users.current() || window.Users.guest(); },

    // Auth
    switchAuthTab(tab){
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      document.getElementById('authLoginForm').style.display = tab === 'login' ? 'flex' : 'none';
      document.getElementById('authRegisterForm').style.display = tab === 'register' ? 'flex' : 'none';
      document.getElementById('authMsg').textContent = '';
      document.getElementById('authMsg').className = 'auth-msg';
    },
    authMsg(text, isErr){
      const el = document.getElementById('authMsg');
      el.textContent = text;
      el.className = 'auth-msg ' + (isErr ? 'err' : 'ok');
    },
    doLogin(){
      const u = document.getElementById('loginUser').value;
      const p = document.getElementById('loginPass').value;
      const res = window.Users.login(u, p);
      if (!res.ok){ this.authMsg(res.msg, true); return; }
      this.authMsg('Đăng nhập thành công!', false);
      setTimeout(() => this.enterMenu(window.Users.current()), 300);
    },
    doRegister(){
      const u = document.getElementById('regUser').value;
      const p = document.getElementById('regPass').value;
      const p2 = document.getElementById('regPass2').value;
      if (p !== p2){ this.authMsg('Mật khẩu không khớp', true); return; }
      const res = window.Users.register(u, p);
      if (!res.ok){ this.authMsg(res.msg, true); return; }
      this.authMsg('Tạo tài khoản thành công!', false);
      setTimeout(() => this.enterMenu(window.Users.current()), 300);
    },
    playAsGuest(){ this.enterMenu(window.Users.guest()); },
    doLogout(){
      window.Users.logout();
      this.closeModal();
      this.myId = 'p_' + U.uid();
      this.showScreen('sc-auth');
    },

    enterMenu(user){
      if (!user){ this.showScreen('sc-auth'); return; }
      this.myId = 'p_' + U.uid();
      document.getElementById('topbarName').textContent = user.username;
      document.getElementById('topbarGames').textContent = user.games || 0;
      document.getElementById('topbarWins').textContent = user.wins || 0;
      document.getElementById('topbarAvatar').innerHTML = renderAvatarHTML(user.avatar || '🐱', 66);
      document.getElementById('topbarAdminBadge').style.display = user.isAdmin ? 'inline-block' : 'none';
      document.getElementById('topbarGuestBadge').style.display = user.isGuest ? 'inline-block' : 'none';
      document.getElementById('adminCard').style.display = user.isAdmin ? 'flex' : 'none';
      if (user.isGuest){
        document.getElementById('topbarFriends').textContent = '—';
        document.getElementById('friendsCard').classList.add('locked');
      } else {
        document.getElementById('topbarFriends').textContent = window.Social.getFriends(user.username).length;
        document.getElementById('friendsCard').classList.remove('locked');
      }
      this.showScreen('sc-menu');
      this._pollSocial();
    },

    // Modal
    openModal(id, html){
      this.currentModal = id;
      document.getElementById('modalContent').innerHTML = `<button class="modal-close" onclick="UI.closeModal()" aria-label="Đóng">×</button>${html}`;
      document.getElementById('overlayModal').classList.add('on');
    },
    closeModal(){
      document.getElementById('overlayModal').classList.remove('on');
      this.currentModal = null;
    },

    // Toast
    toast(msg){
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    },

    // Chat
    toggleChat(){
      document.getElementById('chatPanel').classList.toggle('on');
      document.getElementById('chatOverlay').classList.toggle('on');
    },
    sendChat(){
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;
      const user = this.currentUser();
      if (!user) return;
      input.value = '';
      if (window.Net.peer) window.Net.send({type:'chat', name:user.username, text});
      else this.addChatMsg(user.username, text);
    },
    addChatMsg(name, text){
      const box = document.getElementById('chatMsgs');
      const div = document.createElement('div');
      div.innerHTML = `<span class="u">${U.escape(name)}:</span> ${U.escape(text)}`;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }
  };
})(window);
