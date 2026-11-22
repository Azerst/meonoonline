/* ==============================================
   CONFIG — Hằng số toàn cục
   ⚠️ Cập nhật chỉ khi thêm card/avatar mới
   ============================================== */
(function(window){
  'use strict';

  const IMAGE_BASE = 'https://azerst-image-vn.vercel.app/images/';
  const PHOTO_AVATAR = IMAGE_BASE + '3CORZB1YF.png';
  const MAHIIRU_AVATAR = IMAGE_BASE + 'Mahiiru.png';

  const CARD_TYPES = {
    EK:{name:'Mèo Nổ',short:'BOM',images:['BOM_1','BOM_2','BOM_3'],desc:'Rút trúng = thua'},
    DEFUSE:{name:'Gỡ Bom',short:'GỠ BOM',images:['GO_BOM_1','GO_BOM_2','GO_BOM_3','GO_BOM_4'],desc:'Cứu mạng khi nổ'},
    NOPE:{name:'Nope',short:'NOPE',images:['NOPE_1','NOPE_2','NOPE_3'],desc:'Chặn hành động'},
    ATTACK:{name:'Tấn Công',short:'TẤN CÔNG',images:['TAN_CONG_1','TAN_CONG_2','TAN_CONG_3'],desc:'Ép người sau +2 lượt'},
    SKIP:{name:'Bỏ Lượt',short:'BỎ LƯỢT',images:['BO_LUOT_1','BO_LUOT_2','BO_LUOT_3'],desc:'Bỏ lượt không rút bài'},
    SEE_FUTURE:{name:'Nhìn Trước',short:'NHÌN TRƯỚC',images:['NHIN_TRUOC_TUONG_LAI_1','NHIN_TRUOC_TUONG_LAI_2','NHIN_TRUOC_TUONG_LAI_3'],desc:'Xem 3 lá trên cùng'},
    ALTER_FUTURE:{name:'Biến Đổi',short:'BIẾN ĐỔI',images:['BIEN_DOI_TUONG_LAI_1','BIEN_DOI_TUONG_LAI_2','BIEN_DOI_TUONG_LAI_3'],desc:'Sắp xếp lại 3 lá trên'},
    SHUFFLE:{name:'Xào Bài',short:'XÀO BÀI',images:['XAO_BAI_1','XAO_BAI_2','XAO_BAI_3'],desc:'Xáo trộn bộ bài'},
    FAVOR:{name:'Xin Xỏ',short:'XIN BÀI',images:['XIN_XO_1','XIN_XO_2','XIN_XO_3'],desc:'Xin 1 lá từ đối thủ'},
    RUT_TU_DAY:{name:'Rút Từ Đáy',short:'RÚT ĐÁY',images:['RUT_TU_DAY_1','RUT_TU_DAY_2','RUT_TU_DAY_3'],desc:'Rút từ dưới đáy bộ bài'},
    CAT:{name:'Mèo Thường',short:'MÈO',images:['MEO_THUONG_1','MEO_THUONG_2','MEO_THUONG_3','MEO_THUONG_4','MEO_THUONG_5'],desc:'Combo CÙNG LOẠI cướp bài'}
  };

  window.CONFIG = {
    IMAGE_BASE,
    PHOTO_AVATAR,
    MAHIIRU_AVATAR,
    CARD_TYPES,
    AVATARS: ['🐱','🐶','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','👑','🎭','😎','🤖','👻','🦄',PHOTO_AVATAR,MAHIIRU_AVATAR],
    BOT_NAMES: ['Mèo Béo','Mèo Ngáo','Mèo Điên','Mèo Lười','Mèo Ngu','Mèo Khôn','Mèo Bự'],
    BOT_MODES: {
      normal:{label:'Bình thường',playProb:0.55,catProb:0.4,smartTarget:false},
      smart:{label:'Thông minh',playProb:0.88,catProb:0.85,smartTarget:true},
      ultimate:{label:'Tối thượng',playProb:1.0,catProb:1.0,smartTarget:true}
    },
    TIMING: {
      NOPE_WINDOW: 4000,
      NOPE_WINDOW_FAVOR: 3000,
      CHOICE_TIMEOUT: 20000,
      DRAW_ANIM: 1200
    }
  };
})(window);
