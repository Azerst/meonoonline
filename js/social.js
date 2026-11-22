/* ==============================================
   SOCIAL — Friends, requests, invites
   ============================================== */
(function(window){
  'use strict';
  const S = window.Storage;

  window.Social = {
    allRequests(){ return S.read(S.KEYS.REQUESTS, []); },
    saveRequests(r){ S.write(S.KEYS.REQUESTS, r); },
    allFriends(){ return S.read(S.KEYS.FRIENDS, {}); },
    saveFriends(f){ S.write(S.KEYS.FRIENDS, f); },
    allInvites(){ return S.read(S.KEYS.INVITES, []); },
    saveInvites(i){ S.write(S.KEYS.INVITES, i); },

    sendRequest(from, to){
      if (!to) return {ok:false, msg:'Nhập tên user'};
      const realName = window.Users.findUser(to);
      if (!realName) return {ok:false, msg:'Không tìm thấy user "' + to + '"'};
      if (from === realName) return {ok:false, msg:'Không thể tự kết bạn'};
      if (this.getFriends(from).includes(realName)) return {ok:false, msg:'Đã là bạn bè'};
      const reqs = this.allRequests();
      if (reqs.some(r => r.from===from && r.to===realName && r.status==='pending'))
        return {ok:false, msg:'Đã gửi rồi'};
      if (reqs.some(r => r.from===realName && r.to===from && r.status==='pending'))
        return {ok:false, msg:'Người đó đã gửi cho bạn!'};
      reqs.push({from, to:realName, status:'pending', ts:Date.now()});
      this.saveRequests(reqs);
      return {ok:true, msg:'Đã gửi lời mời tới ' + realName};
    },
    incoming(username){ return this.allRequests().filter(r => r.to === username && r.status === 'pending'); },
    outgoing(username){ return this.allRequests().filter(r => r.from === username && r.status === 'pending'); },
    accept(ts){
      const reqs = this.allRequests();
      const req = reqs.find(r => r.ts === ts);
      if (!req) return;
      req.status = 'accepted';
      this.saveRequests(reqs);
      this._addFriend(req.from, req.to);
    },
    reject(ts){
      const reqs = this.allRequests();
      const req = reqs.find(r => r.ts === ts);
      if (!req) return;
      req.status = 'rejected';
      this.saveRequests(reqs);
    },
    getFriends(username){ return this.allFriends()[username] || []; },
    _addFriend(a, b){
      const all = this.allFriends();
      if (!all[a]) all[a] = [];
      if (!all[b]) all[b] = [];
      if (!all[a].includes(b)) all[a].push(b);
      if (!all[b].includes(a)) all[b].push(a);
      this.saveFriends(all);
    },
    removeFriend(a, b){
      const all = this.allFriends();
      if (all[a]) all[a] = all[a].filter(x => x !== b);
      if (all[b]) all[b] = all[b].filter(x => x !== a);
      this.saveFriends(all);
    },
    sendInvite(from, to, roomCode){
      const invites = this.allInvites();
      invites.push({from, to, roomCode, status:'pending', ts:Date.now()});
      this.saveInvites(invites);
    },
    incomingInvites(username){ return this.allInvites().filter(i => i.to === username && i.status === 'pending'); },
    acceptInvite(ts){
      const invites = this.allInvites();
      const inv = invites.find(i => i.ts === ts);
      if (!inv) return null;
      inv.status = 'accepted';
      this.saveInvites(invites);
      return inv;
    },
    rejectInvite(ts){
      const invites = this.allInvites();
      const inv = invites.find(i => i.ts === ts);
      if (!inv) return;
      inv.status = 'rejected';
      this.saveInvites(invites);
    }
  };
})(window);
