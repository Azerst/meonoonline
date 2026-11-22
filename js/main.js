'use strict';
window.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('error', e => console.error('[Global]', e.message));
  UI.init();
});
