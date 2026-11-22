// Per-card debate speech expand/collapse with accessible aria-expanded sync
(function() {
  function initDebates() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.debate-toggle-btn');
      if (!btn) return;
      var card = btn.closest('.debate-card') || btn.closest('.debate-section');
      if (!card) return;

      var isExpanded = card.classList.contains('is-expanded');
      var preview = card.querySelector('.debate-preview');
      var full = card.querySelector('.debate-full');
      var label = btn.querySelector('.debate-btn-text');
      var arrow = btn.querySelector('.debate-arrow');

      if (isExpanded) {
        card.classList.remove('is-expanded');
        if (preview) preview.classList.remove('hidden');
        if (full) full.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        if (label) label.textContent = 'Lasīt pilno runu';
        if (arrow) arrow.textContent = '↓';
      } else {
        card.classList.add('is-expanded');
        if (preview) preview.classList.add('hidden');
        if (full) full.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        if (label) label.textContent = 'Sakļaut runu';
        if (arrow) arrow.textContent = '↑';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebates);
  } else {
    initDebates();
  }
})();
