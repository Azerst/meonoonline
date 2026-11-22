/* ==============================================
   STORAGE — Low-level, hashed, versioned
   ⚠️ KHÔNG ĐỔI KEY — sẽ mất dữ liệu user
   ============================================== */
(function(window){
  'use strict';

  // Keys CỐ ĐỊNH — NEVER CHANGE (đổi = mất data)
  const KEYS = {
    USERS:    'EK_USERS_DB_V1',
    SESSION:  'EK_SESSION_V1',
    GUEST:    'EK_GUEST_V1',
    FRIENDS:  'EK_FRIENDS_V1',
    REQUESTS: 'EK_REQUESTS_V1',
    INVITES:  'EK_INVITES_V1',
    MIGRATED: 'EK_MIGRATED_V1'
  };

  // Hash: FNV-based + 3 rounds
  function hashSync(str){
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i=0;i<str.length;i++){
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return (h2>>>0).toString(36) + (h1>>>0).toString(36);
  }

  function hashPassword(password, salt){
    let h = hashSync(String(password) + '::' + String(salt));
    h = hashSync(h + '::' + String(salt));
    h = hashSync(h + '::' + String(salt));
    return h;
  }

  function generateSalt(){
    if (typeof crypto !== 'undefined' && crypto.randomUUID){
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
    return Math.random().toString(36).slice(2, 18) + Date.now().toString(36);
  }

  function read(key, def){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch(e){ return def; }
  }
  function write(key, data){
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch(e){ console.error('[Storage] write fail:', e); return false; }
  }
  function readStr(key){ try { return localStorage.getItem(key); } catch(e){ return null; } }
  function writeStr(key, val){ try { localStorage.setItem(key, val); } catch(e){} }
  function remove(key){ try { localStorage.removeItem(key); } catch(e){} }

  window.Storage = {
    KEYS,
    hashPassword,
    generateSalt,
    read,
    write,
    readStr,
    writeStr,
    remove
  };
})(window);
