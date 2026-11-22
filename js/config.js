'use strict';

const IMAGE_BASE = 'https://azerst-image-vn.vercel.app/images/';
const PHOTO_AVATAR = 'https://azerst-image-vn.vercel.app/images/3CORZB1YF.png';
const MAHIIRU_AVATAR = 'https://azerst-image-vn.vercel.app/images/Mahiiru.png';

const CARD_TYPES = {
  EK:           {name:'Mèo Nổ',              short:'MÈO NỔ',   images:['BOM_1','BOM_2','BOM_3'], desc:'Rút trúng = thua'},
  DEFUSE:       {name:'Gỡ Bom',              short:'GỠ BOM',   images:['GO_BOM_1','GO_BOM_2','GO_BOM_3','GO_BOM_4'], desc:'Cứu mạng khi nổ'},
  NOPE:         {name:'Nope',                short:'NOPE',     images:['NOPE_1','NOPE_2','NOPE_3'], desc:'Chặn hành động'},
  ATTACK:       {name:'Tấn Công',            short:'TẤN CÔNG', images:['TAN_CONG_1','TAN_CONG_2','TAN_CONG_3'], desc:'Ép người sau +2 lượt'},
  SKIP:         {name:'Bỏ Lượt',             short:'BỎ LƯỢT',  images:['BO_LUOT_1','BO_LUOT_2','BO_LUOT_3'], desc:'Bỏ lượt không rút'},
  SEE_FUTURE:   {name:'Nhìn Trước',          short:'NHÌN',     images:['NHIN_TRUOC_TUONG_LAI_1','NHIN_TRUOC_TUONG_LAI_2','NHIN_TRUOC_TUONG_LAI_3'], desc:'Xem 3 lá trên cùng'},
  ALTER_FUTURE: {name:'Biến Đổi Tương Lai',  short:'BIẾN ĐỔI', images:['BIEN_DOI_TUONG_LAI_1','BIEN_DOI_TUONG_LAI_2','BIEN_DOI_TUONG_LAI_3'], desc:'Sắp xếp lại 3 lá trên'},
  SHUFFLE:      {name:'Xào Bài',             short:'XÀO BÀI',  images:['XAO_BAI_1','XAO_BAI_2','XAO_BAI_3'], desc:'Xáo trộn bộ bài'},
  FAVOR:        {name:'Xin Xỏ',              short:'XIN BÀI',  images:['XIN_XO_1','XIN_XO_2','XIN_XO_3'], desc:'Xin 1 lá từ đối thủ'},
  RUT_TU_DAY:   {name:'Rút Từ Đáy',          short:'RÚT ĐÁY',  images:['RUT_TU_DAY_1','RUT_TU_DAY_2','RUT_TU_DAY_3'], desc:'Rút từ dưới đáy bộ bài'},
  CAT:          {name:'Mèo Thường',          short:'MÈO',      images:['MEO_THUONG_1','MEO_THUONG_2','MEO_THUONG_3','MEO_THUONG_4','MEO_THUONG_5'], desc:'Combo 2+ cùng loại để cướp bài'}
};

const NOPE_WINDOW = 4000;
const NOPE_WINDOW_FAVOR = 3000;
const CHOICE_TIMEOUT = 20000;

const BOT_MODES = {
  normal:   {label:'Bình thường', playProb:0.55, nopeProb:0.05, catProb:0.4, smartTarget:false},
  smart:    {label:'Thông minh',  playProb:0.88, nopeProb:0.18, catProb:0.85, smartTarget:true},
  ultimate: {label:'Tối thượng',  playProb:1.0,  nopeProb:0.35, catProb:1.0, smartTarget:true}
};
const BOT_NAMES = ['Mèo Béo','Mèo Ngáo','Mèo Điên','Mèo Lười','Mèo Khủng','Mèo Bự'];

const AVATARS = ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🐰','🐹','🦄','🐲','👾','🎭','😎','🤖','👻','🐺',PHOTO_AVATAR,MAHIIRU_AVATAR];

const U = {
  uid: () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4),
  shuffle: a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; },
  code: () => String(Math.floor(Math.random()*1000000)).padStart(6,'0'),
  clone: o => JSON.parse(JSON.stringify(o)),
  pick: arr => arr[Math.floor(Math.random()*arr.length)]
};

function makeCard(type){
  const t = CARD_TYPES[type];
  if(!t) return type + '#0';
  return type + '#' + Math.floor(Math.random() * t.images.length);
}
function cardType(c){ return String(c).split('#')[0]; }
function cardVariant(c){ const p = String(c).split('#'); return p[1]?parseInt(p[1]):0; }
function cardImage(c){
  const t = cardType(c), v = cardVariant(c), info = CARD_TYPES[t];
  if(!info) return '';
  return IMAGE_BASE + info.images[Math.min(v, info.images.length - 1)] + '.png';
}
function cardInfo(c){ return CARD_TYPES[cardType(c)] || {name:'?',short:'?',images:[]}; }

function renderAvatarHTML(avatar, size){
  size = size || 40;
  if (avatar && typeof avatar === 'string' && avatar.startsWith('http')) {
    return `<img src="${avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  }
  return `<span style="font-size:${size*0.55}px;line-height:1">${avatar || '🐱'}</span>`;
}

const Sound = {
  ctx:null,
  init(){ if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } },
  play(type){
    try{
      this.init(); if(!this.ctx) return;
      if(this.ctx.state==='suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      const cfg = {draw:{f:380,f2:620,d:.12,w:'sine',v:.06},play:{f:340,f2:120,d:.18,w:'triangle',v:.12},boom:{f:110,f2:25,d:.5,w:'sawtooth',v:.28},defuse:{f:700,f2:1200,d:.25,w:'sine',v:.15},nope:{f:220,f2:150,d:.15,w:'square',v:.12},win:{f:500,f2:800,d:.4,w:'sine',v:.2}}[type];
      if(!cfg) return;
      o.type = cfg.w;
      o.frequency.setValueAtTime(cfg.f,t);
      o.frequency.exponentialRampToValueAtTime(cfg.f2,t+cfg.d);
      g.gain.setValueAtTime(cfg.v,t);
      g.gain.exponentialRampToValueAtTime(.001,t+cfg.d);
      o.start(t); o.stop(t+cfg.d);
    }catch(e){}
  }
};

const VFX = {
  explode(x,y){
    Sound.play('boom');
    for(let i=0;i<35;i++){
      const p = document.createElement('div');
      const s = Math.random()*18+8;
      p.style.cssText = `width:${s}px;height:${s}px;left:${x}px;top:${y}px;background:hsl(${Math.random()*40},100%,55%);z-index:9000;position:fixed;border-radius:50%;pointer-events:none`;
      document.body.appendChild(p);
      const a = Math.random()*Math.PI*2, v = Math.random()*160+50;
      p.animate([
        {transform:'translate(0,0) scale(1)',opacity:1},
        {transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v}px) scale(0)`,opacity:0}
      ], {duration: 600+Math.random()*400, easing: 'cubic-bezier(0,.9,.57,1)'}).onfinish = () => p.remove();
    }
  }
};
