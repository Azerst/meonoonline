/* ==============================================
   SESSION — Alias cho tiện dụng
   ============================================== */
(function(window){
  window.Session = {
    get: () => window.Users.current(),
    set: (u) => window.Users.setSession(u),
    clear: () => window.Users.clearSession(),
    isLoggedIn: () => !!window.Users.current(),
    isAdmin: () => { const u = window.Users.current(); return u && u.isAdmin; }
  };
})(window);
