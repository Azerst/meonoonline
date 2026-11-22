/* ==============================================
   UTILS — Helpers, Sound, VFX, Card helpers
   ============================================== */
(function(window){
  'use strict';
  const {CARD_TYPES, IMAGE_BASE} = window.CONFIG;

  const U = {
    uid: () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4),
    shuffle: a => { for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; },
    code: () => String(Math.floor(Math.random()*1000000)).padStart(6,'0'),
    clone: o => JSON.parse(JSON.stringify(o)),
    pick: arr => arr[Math.floor(Math.random()*arr.length)],
    escape: str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  };

  // Card helpers
  const Card = {
    make(type){
      const t = CARD_TYPES[type];
      if (!t) return type + '#0';
      return type + '#' + Math.floor(Math.random() * t.images.length);
    },
    type(c){ return String(c).split('#')[0]; },
    variant(c){ const p = String(c).split('#'); return p[1] ? parseInt(p[1]) : 0; },
    image(c){
      const t = this.type(c), v = this.variant(c), info = CARD_TYPES[t];
      if (!info) return '';
      return IMAGE_BASE + info.images[Math.min(v, info.images.length - 1)] + '.png';
    },
    info(c){ return CARD_TYPES[this.type(c)] || {name:'?',short:'?',images:[]}; }
  };

  // Sound
  const Sound = {
    ctx: null,
    init(){ if (!this.ctx) try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} },
    play(type){
      try {
        this.init(); if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        const cfg = {
          draw:{f:380,f2:620,d:.12,w:'sine',v:.06}, play:{f:340,f2:120,d:.18,w:'triangle',v:.12},
          boom:{f:110,f2:25,d:.5,w:'sawtooth',v:.28}, defuse:{f:700,f2:1200,d:.25,w:'sine',v:.15},
          nope:{f:220,f2:150,d:.15,w:'square',v:.12}, win:{f:500,f2:800,d:.4,w:'sine',v:.2}
        }[type];
        if (!cfg) return;
        o.type = cfg.w;
        o.frequency.setValueAtTime(cfg.f, t);
        o.frequency.exponentialRampToValueAtTime(cfg.f2, t + cfg.d);
        g.gain.setValueAtTime(cfg.v, t);
        g.gain.exponentialRampToValueAtTime(.001, t + cfg.d);
        o.start(t); o.stop(t + cfg.d);
      } catch(e){}
    }
  };

  // VFX
  const VFX = {
    explode(x, y){
      Sound.play('boom');
      for (let i=0;i<35;i++){
        const p = document.createElement('div');
        const s = Math.random()*18+8;
        p.style.cssText = `width:${s}px;height:${s}px;left:${x}px;top:${y}px;background:hsl(${Math.random()*40},100%,55%);z-index:9000;position:fixed;border-radius:50%;pointer-events:none`;
        document.body.appendChild(p);
        const a = Math.random()*Math.PI*2, v = Math.random()*160+50;
        p.animate(
          [{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v}px) scale(0)`,opacity:0}],
          {duration:600+Math.random()*400, easing:'cubic-bezier(0,.9,.57,1)'}
        ).onfinish = () => p.remove();
      }
    }
  };

  function renderAvatarHTML(avatar, size){
    size = size || 40;
    if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
      return `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="">`;
    }
    return `<span style="font-size:${size*0.6}px;line-height:1">${avatar || '🐱'}</span>`;
  }

  window.U = U;
  window.Card = Card;
  window.Sound = Sound;
  window.VFX = VFX;
  window.renderAvatarHTML = renderAvatarHTML;
})(window);
