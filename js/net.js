/* ==============================================
   NET — PeerJS networking wrapper
   ============================================== */
(function(window){
  'use strict';

  window.Net = {
    peer:null, conn:null, conns:[], isHost:false, roomCode:null, retryCount:0,
    playerByConn:new Map(),
    onHostReady:null, onClientDisconnect:null, onJoin:null, onAction:null, onChat:null,
    onState:null, onLobby:null, onStart:null, onHostLeft:null, onError:null,
    onConnectSuccess:null, onNewCode:null,

    host(code){
      this.roomCode = code; this.isHost = true; this.retryCount = 0;
      this.playerByConn.clear();
      this._createHostPeer(code);
    },
    _createHostPeer(code){
      if (typeof Peer === 'undefined'){ this.onError?.('Thư viện mạng chưa tải.'); return; }
      try {
        this.peer = new Peer('ek_room_v9_' + code, {config:{iceServers:[
          {url:'stun:stun.l.google.com:19302'},{url:'stun:stun1.l.google.com:19302'}
        ]}});
      } catch(e){ this.onError?.('Lỗi: ' + e.message); return; }
      const timeout = setTimeout(() => {
        if (this.peer && !this.peer.destroyed && !this.peer.open){
          try { this.peer.destroy(); } catch(e){}
          this.onError?.('Kết nối quá tải.');
        }
      }, 10000);
      this.peer.on('open', () => { clearTimeout(timeout); this.retryCount = 0; this.onHostReady?.(); });
      this.peer.on('connection', (c) => {
        this.conns.push(c);
        c.on('data', (data) => this.route(data, c));
        c.on('close', () => {
          this.conns = this.conns.filter(x => x !== c);
          const pid = this.playerByConn.get(c);
          this.playerByConn.delete(c);
          this.onClientDisconnect?.(c, pid);
        });
      });
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        if (err.type === 'unavailable-id' && this.retryCount < 3){
          this.retryCount++;
          try { this.peer.destroy(); } catch(e){}
          const newCode = window.U.code();
          this.roomCode = newCode;
          this.onNewCode?.(newCode);
          setTimeout(() => this._createHostPeer(newCode), 600);
          return;
        }
        let msg = 'Lỗi: ' + err.type;
        if (err.type === 'unavailable-id') msg = 'Mã phòng trùng!';
        else if (err.type === 'network') msg = 'Lỗi mạng!';
        else if (err.type === 'server-error') msg = 'Server quá tải!';
        this.onError?.(msg);
      });
    },
    join(code){
      this.roomCode = code; this.isHost = false;
      if (typeof Peer === 'undefined'){ this.onError?.('Thư viện mạng chưa tải.'); return; }
      try {
        this.peer = new Peer({config:{iceServers:[
          {url:'stun:stun.l.google.com:19302'},{url:'stun:stun1.l.google.com:19302'}
        ]}});
      } catch(e){ this.onError?.('Lỗi: ' + e.message); return; }
      const timeout = setTimeout(() => {
        if (this.peer && !this.peer.destroyed && !this.peer.open){
          try { this.peer.destroy(); } catch(e){}
          this.onError?.('Kết nối quá tải!');
        }
      }, 10000);
      this.peer.on('open', () => {
        clearTimeout(timeout);
        this.conn = this.peer.connect('ek_room_v9_' + code, {reliable:true});
        this.conn.on('open', () => this.onConnectSuccess?.());
        this.conn.on('data', (data) => this.route(data));
        this.conn.on('close', () => this.onHostLeft?.());
        this.conn.on('error', () => this.onError?.('Lỗi đường truyền.'));
      });
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        if (err.type === 'peer-unavailable') this.onError?.('Không tìm thấy phòng ' + code);
        else if (err.type === 'network') this.onError?.('Lỗi mạng!');
        else this.onError?.('Lỗi: ' + err.type);
      });
    },
    close(){
      if (this.conn) try { this.conn.close(); } catch(e){}
      if (this.conns) this.conns.forEach(c => { try { c.close(); } catch(e){} });
      if (this.peer) try { this.peer.destroy(); } catch(e){}
      this.conn = null; this.conns = []; this.peer = null; this.retryCount = 0;
      this.playerByConn.clear();
    },
    send(msg, targetConn=null){
      try {
        if (this.isHost){
          if (targetConn){ if (targetConn.open) targetConn.send(msg); }
          else this.conns.forEach(c => { if (c.open) c.send(msg); });
        } else if (this.conn && this.conn.open) this.conn.send(msg);
      } catch(e){ console.error('[Net.send]', e); }
    },
    route(msg, conn){
      if (!msg || !msg.type) return;
      if (this.isHost){
        if (msg.type === 'join'){ if (msg.player) this.playerByConn.set(conn, msg.player.id); this.onJoin?.(msg.player, conn); }
        else if (msg.type === 'action') this.onAction?.(msg.playerId, msg.action, msg.payload);
        else if (msg.type === 'chat'){
          this.onChat?.(msg.name, msg.text);
          this.send({type:'chat', name:msg.name, text:msg.text});
        }
      } else {
        if (msg.type === 'lobby') this.onLobby?.(msg.players);
        else if (msg.type === 'state') this.onState?.(msg.state);
        else if (msg.type === 'start') this.onStart?.(msg.state);
        else if (msg.type === 'chat') this.onChat?.(msg.name, msg.text);
        else if (msg.type === 'host_left') this.onHostLeft?.();
        else if (msg.type === 'error'){ this.onError?.(msg.message); setTimeout(() => { try { this.conn.close(); } catch(e){} }, 300); }
      }
    }
  };
})(window);
