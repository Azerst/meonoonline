'use strict';

const Engine = {
  state: null, hostId: null,
  pendingTimer: null, choiceTimer: null, onChange: null,

  createGame(players, hostId, botMode='smart'){
    this.hostId = hostId;
    this.state = {
      phase: 'playing',
      players: players.map(p => ({
        id: p.id, name: p.name, isBot: !!p.isBot,
        avatar: p.avatar || (p.isBot ? '🤖' : '👤'),
        hand: [], alive: true,
        stats: {turns:0, cardsPlayed:0, defuses:0}
      })),
      deck: [], discard: [],
      turnIdx: 0, turnsLeft: 1,
      pending: null, peekFor: null, awaitingChoice: null, alterFor: null,
      winner: null, logs: [],
      lastDraw: null, lastSteal: null, lastPlay: null,
      botMode: botMode || 'smart',
      startedAt: Date.now()
    };
    this.setupDeck();
    this.state.turnIdx = Math.floor(Math.random() * players.length);
    this.state.players[this.state.turnIdx].stats.turns = 1;
    this.log(`${this.state.players[this.state.turnIdx].name} đi trước`);
    this.notify();
  },

  setupDeck(){
    const n = this.state.players.length;
    const deck = this.state.deck;
    for(let i=0;i<3;i++) deck.push(makeCard('ATTACK'));
    for(let i=0;i<3;i++) deck.push(makeCard('SKIP'));
    for(let i=0;i<3;i++) deck.push(makeCard('FAVOR'));
    for(let i=0;i<2;i++) deck.push(makeCard('SHUFFLE'));
    for(let i=0;i<3;i++) deck.push(makeCard('SEE_FUTURE'));
    for(let i=0;i<2;i++) deck.push(makeCard('ALTER_FUTURE'));
    for(let i=0;i<3;i++) deck.push(makeCard('RUT_TU_DAY'));
    for(let i=0;i<5;i++) deck.push(makeCard('NOPE'));
    for(let i=0;i<12;i++) deck.push(makeCard('CAT'));
    for(let i=0;i<2;i++) deck.push(makeCard('DEFUSE'));

    // Mỗi người chơi tăng thêm 7 lá thường để bộ bài không bị cạn quá sớm.
    // Không tăng số Mèo Nổ ngoài quy tắc n - 1 ở phía dưới.
    const extraPlayers = Math.max(0, n - 2);
    const bonusActions = ['ATTACK','SKIP','FAVOR','SEE_FUTURE','ALTER_FUTURE','SHUFFLE','RUT_TU_DAY'];
    for(let p=0;p<extraPlayers;p++){
      for(let i=0;i<4;i++) deck.push(makeCard('CAT'));
      deck.push(makeCard('NOPE'));
      deck.push(makeCard(bonusActions[(p * 2) % bonusActions.length]));
      deck.push(makeCard(bonusActions[(p * 2 + 3) % bonusActions.length]));
    }
    U.shuffle(deck);
    for(let i=0;i<5;i++) for(const p of this.state.players) p.hand.push(deck.pop());
    for(const p of this.state.players) p.hand.push(makeCard('DEFUSE'));
    for(let i=0;i<n-1;i++) deck.push(makeCard('EK'));
    U.shuffle(deck);
  },

  cur(){ return this.state.players[this.state.turnIdx]; },
  byId(id){ return this.state.players.find(p => p.id === id); },
  alive(){ return this.state.players.filter(p => p.alive); },
  log(msg){ this.state.logs.push(msg); if(this.state.logs.length > 30) this.state.logs.shift(); },
  notify(meta){ if(this.onChange) this.onChange(meta); },

  endTurn(){
    this._clearTransient();
    let idx = this.state.turnIdx;
    do { idx = (idx + 1) % this.state.players.length; } while(!this.state.players[idx].alive);
    this.state.turnIdx = idx;
    this.state.turnsLeft = 1;
    this.cur().stats.turns++;
    this.log(`Lượt của ${this.cur().name}`);
    this.notify({type:'turn'});
  },

  advanceTo(turns){
    this._clearTransient();
    let idx = this.state.turnIdx;
    do { idx = (idx + 1) % this.state.players.length; } while(!this.state.players[idx].alive);
    this.state.turnIdx = idx;
    this.state.turnsLeft = turns;
    this.cur().stats.turns++;
    this.log(`Lượt của ${this.cur().name} (${turns} lượt)`);
    this.notify({type:'turn'});
  },

  _clearTransient(){
    this.state.pending = null;
    this.state.peekFor = null;
    this.state.alterFor = null;
    this.state.awaitingChoice = null;
    clearTimeout(this.pendingTimer);
    clearTimeout(this.choiceTimer);
  },

  canAct(playerId, action){
    if(this.state.phase !== 'playing') return false;
    const p = this.byId(playerId);
    if(!p || !p.alive) return false;
    if(action === 'nope') return !!this.state.pending && p.hand.some(c => cardType(c)==='NOPE');
    if(action === 'clearPeek') return this.state.peekFor?.playerId === playerId;
    if(action === 'alterFuture') return this.state.alterFor?.playerId === playerId;
    if(action === 'defuse') return this.state.awaitingChoice?.type==='defuse' && this.state.awaitingChoice.playerId===playerId;
    if(action === 'favor') return this.state.awaitingChoice?.type==='favor' && this.state.awaitingChoice.targetId===playerId;
    if(this.state.awaitingChoice) return false;
    if(this.state.alterFor) return false;
    if(this.state.pending) return false;
    if(this.cur().id !== playerId) return false;
    return true;
  },

  playCards(playerId, cardTypes, targetId, payload={}){
    if(!this.canAct(playerId, 'play')) return false;
    const p = this.byId(playerId);
    const primary = cardTypes[0];
    const primaryType = cardType(primary);
    if(['EK','DEFUSE','NOPE'].includes(primaryType)) return false;

    // Validate cards in hand
    const tmp = [...p.hand];
    for(const c of cardTypes){
      const idx = tmp.indexOf(c);
      if(idx === -1) return false;
      tmp.splice(idx, 1);
    }
    if(primaryType === 'CAT'){
      if(cardTypes.length !== 2 && cardTypes.length !== 3) return false;
      if(!cardTypes.every(c => c === primary)) return false;
      const t = this.byId(targetId);
      if(!t || !t.alive || t.id === playerId || t.hand.length === 0) return false;
    }
    if(primaryType === 'FAVOR'){
      const t = this.byId(targetId);
      if(!t || !t.alive || t.id === playerId || t.hand.length === 0) return false;
    }

    for(const c of cardTypes){
      p.hand.splice(p.hand.indexOf(c), 1);
      this.state.discard.push(c);
    }
    p.stats.cardsPlayed += cardTypes.length;

    const winMs = primaryType === 'FAVOR' ? NOPE_WINDOW_FAVOR : NOPE_WINDOW;
    this.state.pending = { playerId, primary, primaryType, cards: cardTypes, targetId, payload, nopeCount: 0, timestamp: Date.now(), windowMs: winMs };
    this.log(`${p.name} đánh ${CARD_TYPES[primaryType].name}${cardTypes.length>1?' ×'+cardTypes.length:''}`);
    this.state.lastPlay = { playerId, card: primary, id: Math.random() };
    this.scheduleResolve();
    this.notify({type:'play', playerId, primaryType});
    return true;
  },

  scheduleResolve(){
    clearTimeout(this.pendingTimer);
    const pending = this.state.pending;
    const winMs = pending.windowMs || NOPE_WINDOW;
    this.pendingTimer = setTimeout(() => {
      if(this.state.pending === pending) this.resolvePending();
    }, winMs);
  },

  playNope(playerId){
    if(!this.state.pending) return false;
    const p = this.byId(playerId);
    if(!p || !p.alive) return false;
    const idx = p.hand.findIndex(c => cardType(c) === 'NOPE');
    if(idx === -1) return false;
    const nopeCard = p.hand.splice(idx, 1)[0];
    this.state.discard.push(nopeCard);
    p.stats.cardsPlayed++;
    this.state.pending.nopeCount++;
    this.log(`${p.name} hô NOPE ×${this.state.pending.nopeCount}`);
    Sound.play('nope');
    this.scheduleResolve();
    this.notify({type:'nope'});
    return true;
  },

  resolvePending(){
    clearTimeout(this.pendingTimer);
    const pending = this.state.pending;
    if(!pending) return;
    this.state.pending = null;
    if(pending.nopeCount % 2 === 1){
      this.log(`Hành động bị NOPE hủy`);
      this.notify({type:'resolve', cancelled:true});
      return;
    }
    const p = this.byId(pending.playerId);
    if(!p || !p.alive){ this.notify({type:'resolve', cancelled:true}); return; }

    switch(pending.primaryType){
      case 'ATTACK': {
        const nextTurns = this.state.turnsLeft + 1;
        this.log(`${p.name} tấn công: ${nextTurns} lượt`);
        this.advanceTo(nextTurns); return;
      }
      case 'SKIP': {
        this.state.turnsLeft--;
        this.log(`${p.name} bỏ lượt`);
        if(this.state.turnsLeft <= 0) this.endTurn();
        else this.notify({type:'resolve'});
        return;
      }
      case 'SHUFFLE': U.shuffle(this.state.deck); this.log(`${p.name} xáo bài`); break;
      case 'SEE_FUTURE': {
        const top = [];
        for(let i=0;i<3 && i<this.state.deck.length;i++) top.push(this.state.deck[this.state.deck.length-1-i]);
        this.state.peekFor = {playerId:pending.playerId, cards:top};
        this.log(`${p.name} xem tương lai`);
        break;
      }
      case 'ALTER_FUTURE': {
        const top = [];
        const take = Math.min(3, this.state.deck.length);
        for(let i=0;i<take;i++) top.push(this.state.deck.pop());
        this.state.alterFor = {playerId:pending.playerId, cards:top};
        this.log(`${p.name} sắp xếp 3 lá trên`);
        break;
      }
      case 'RUT_TU_DAY': {
        if(this.state.deck.length === 0){
          const resh = this.state.discard.filter(c => cardType(c)!=='EK');
          if(resh.length > 0){
            this.state.deck = U.shuffle(resh);
            this.state.discard = this.state.discard.filter(c => cardType(c)==='EK');
            this.log(`Xáo lại ${this.state.deck.length} lá`);
          } else { this.log('Bộ bài trống'); this.notify(); return; }
        }
        const card = this.state.deck.shift();
        Sound.play('draw');
        this.log(`${p.name} rút từ đáy`);
        if(cardType(card) === 'EK') this.handleEK(p, card);
        else {
          p.hand.unshift(card);
          this.state.lastDraw = {playerId:p.id, card, id:Math.random(), fromBottom:true};
          this.state.turnsLeft--;
          if(this.state.turnsLeft <= 0) this.endTurn();
          else this.notify({type:'resolve'});
        }
        return;
      }
      case 'FAVOR': {
        const t = this.byId(pending.targetId);
        if(t && t.alive && t.hand.length > 0){
          this.log(`${p.name} xin bài từ ${t.name}`);
          this.state.awaitingChoice = {type:'favor', fromId:pending.playerId, targetId:t.id};
          this._armChoiceTimeout();
        }
        break;
      }
      default: if(pending.primaryType === 'CAT') this.doCatCombo(p, pending.targetId, pending.cards.length, pending.payload);
    }
    this.notify({type:'resolve'});
  },

  _armChoiceTimeout(){
    clearTimeout(this.choiceTimer);
    this.choiceTimer = setTimeout(() => {
      const c = this.state.awaitingChoice;
      if(!c) return;
      if(c.type === 'favor'){
        const t = this.byId(c.targetId);
        if(t && t.hand.length > 0) this.resolveFavor(t.id, Math.floor(Math.random() * t.hand.length));
      } else if(c.type === 'defuse'){
        this.placeDefuse(c.playerId, 'random');
      }
    }, CHOICE_TIMEOUT);
  },

  applyAlterFuture(playerId, order){
    if(!this.state.alterFor) return false;
    if(this.state.alterFor.playerId !== playerId) return false;
    for(let i = order.length - 1; i >= 0; i--) this.state.deck.push(order[i]);
    this.state.alterFor = null;
    this.log(`${this.byId(playerId).name} đã sắp xếp`);
    this.notify();
    return true;
  },

  doCatCombo(p, targetId, count, payload){
    const t = this.byId(targetId);
    if(!t || !t.alive || t.hand.length === 0) return;
    let stolen = null;
    if(count === 2){
      const idx = Math.floor(Math.random() * t.hand.length);
      stolen = t.hand.splice(idx, 1)[0];
      p.hand.unshift(stolen);
      this.log(`${p.name} cướp 1 lá từ ${t.name}`);
      Sound.play('draw');
    } else if(count === 3){
      const wanted = payload.namedType;
      if(!wanted) return;
      const idx = t.hand.findIndex(c => cardType(c) === wanted);
      if(idx > -1){
        stolen = t.hand.splice(idx, 1)[0];
        p.hand.unshift(stolen);
        this.log(`${p.name} lấy ${CARD_TYPES[wanted].name} từ ${t.name}`);
        Sound.play('draw');
      } else {
        this.log(`${t.name} không có ${CARD_TYPES[wanted].name}`);
      }
    }
    if(stolen) this.state.lastSteal = {thiefId:p.id, victimId:t.id, card:stolen, id:Math.random()};
  },

  drawCard(playerId){
    if(!this.canAct(playerId, 'draw')) return false;
    const p = this.byId(playerId);
    if(this.state.deck.length === 0){
      const resh = this.state.discard.filter(c => cardType(c)!=='EK');
      if(resh.length > 0){
        this.state.deck = U.shuffle(resh);
        this.state.discard = this.state.discard.filter(c => cardType(c)==='EK');
        this.log(`Xáo lại ${this.state.deck.length} lá`);
      } else {
        this.log('Bộ bài trống');
        this.endTurn(); return true;
      }
    }
    const card = this.state.deck.pop();
    Sound.play('draw');
    this.log(`${p.name} rút 1 lá`);
    if(cardType(card) === 'EK') this.handleEK(p, card);
    else {
      p.hand.unshift(card);
      this.state.lastDraw = {playerId:p.id, card, id:Math.random()};
      this.state.turnsLeft--;
      if(this.state.turnsLeft <= 0) this.endTurn();
      else this.notify({type:'draw'});
    }
    return true;
  },

  handleEK(p, ekCard){
    const card = ekCard || makeCard('EK');
    this.state.discard.push(card);
    this.state.lastDraw = {playerId:p.id, card, id:Math.random(), isEK:true};
    this.log(`${p.name} rút trúng MÈO NỔ`);
    const defIdx = p.hand.findIndex(c => cardType(c)==='DEFUSE');
    if(defIdx === -1){
      p.alive = false;
      this.state.discard.push(...p.hand);
      p.hand = [];
      this.log(`${p.name} BỊ LOẠI`);
      if(this.checkWin()) return;
      this.state.turnsLeft = 0;
      this.endTurn();
    } else {
      const defCard = p.hand.splice(defIdx, 1)[0];
      p.stats.defuses++;
      this.state.discard.push(defCard);
      this.log(`${p.name} dùng GỠ BOM`);
      Sound.play('defuse');
      this.state.awaitingChoice = {type:'defuse', playerId:p.id, ekCard:card};
      this._armChoiceTimeout();
      this.notify({type:'defuse-prompt', playerId:p.id});
    }
  },

  placeDefuse(playerId, pos){
    if(!this.state.awaitingChoice || this.state.awaitingChoice.type !== 'defuse') return false;
    if(this.state.awaitingChoice.playerId !== playerId) return false;
    clearTimeout(this.choiceTimer);
    const ekCard = this.state.awaitingChoice.ekCard || makeCard('EK');
    let idx;
    if(pos === 'top') idx = this.state.deck.length;
    else if(pos === 'bottom') idx = 0;
    else if(typeof pos === 'number') idx = Math.max(0, Math.min(this.state.deck.length, pos));
    else idx = Math.floor(Math.random() * (this.state.deck.length + 1));
    this.state.deck.splice(idx, 0, ekCard);
    this.state.awaitingChoice = null;
    this.log('Bom được giấu lại');
    this.state.turnsLeft--;
    if(this.state.turnsLeft <= 0) this.endTurn();
    else this.notify({type:'defuse-done'});
    return true;
  },

  resolveFavor(targetId, cardIdx){
    if(!this.state.awaitingChoice || this.state.awaitingChoice.type !== 'favor') return false;
    const {fromId, targetId: exp} = this.state.awaitingChoice;
    if(targetId !== exp) return false;
    clearTimeout(this.choiceTimer);
    const target = this.byId(targetId);
    const from = this.byId(fromId);
    if(!target || !from) return false;
    if(target.hand.length === 0){ this.state.awaitingChoice = null; this.notify(); return false; }
    if(cardIdx < 0 || cardIdx >= target.hand.length) return false;
    const card = target.hand.splice(cardIdx, 1)[0];
    from.hand.unshift(card);
    this.log(`${from.name} nhận ${CARD_TYPES[cardType(card)].name} từ ${target.name}`);
    this.state.lastSteal = {thiefId:from.id, victimId:target.id, card, id:Math.random()};
    this.state.awaitingChoice = null;
    this.notify({type:'favor-done'});
    return true;
  },

  clearPeek(playerId){
    if(this.state.peekFor?.playerId !== playerId) return false;
    this.state.peekFor = null;
    this.notify({type:'peek-cleared'});
    return true;
  },

  handlePlayerDisconnect(playerId){
    const p = this.byId(playerId);
    if(!p || !p.alive) return;
    p.alive = false;
    this.state.discard.push(...p.hand);
    p.hand = [];
    this.log(`${p.name} đã thoát`);
    if(this.state.peekFor?.playerId === playerId) this.state.peekFor = null;
    if(this.state.alterFor?.playerId === playerId) this.state.alterFor = null;
    if(this.state.awaitingChoice?.playerId === playerId || this.state.awaitingChoice?.targetId === playerId){
      this.state.awaitingChoice = null;
      clearTimeout(this.choiceTimer);
    }
    if(this.state.pending?.playerId === playerId){
      this.state.pending = null;
      clearTimeout(this.pendingTimer);
    }
    if(this.checkWin()) return;
    if(this.state.players[this.state.turnIdx]?.id === playerId) this.endTurn();
    else this.notify();
  },

  checkWin(){
    const alive = this.alive();
    if(alive.length <= 1){
      this.state.phase = 'ended';
      this.state.winner = alive[0] || null;
      this._clearTransient();
      if(alive[0]) this.log(`${alive[0].name} CHIẾN THẮNG`);
      Sound.play('win');
      this.notify({type:'win', winner: this.state.winner});
      return true;
    }
    return false;
  }
};
