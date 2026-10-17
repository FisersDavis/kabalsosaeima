// Synchronized debate expand/collapse across opposing debate cards
(function() {
  function initDebates() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.debate-toggle-btn');
      if (!btn) return;
      var section = btn.closest('.debate-section');
      if (!section) return;

      var isExpanded = section.classList.contains('is-expanded');
      if (isExpanded) {
        section.classList.remove('is-expanded');
        section.querySelectorAll('.debate-preview').forEach(function(el) {
          el.classList.remove('hidden');
        });
        section.querySelectorAll('.debate-full').forEach(function(el) {
          el.classList.add('hidden');
        });
        section.querySelectorAll('.debate-toggle-btn').forEach(function(b) {
          var label = b.querySelector('.debate-btn-text');
          if (label) label.textContent = 'Lasīt pilno runu';
          var arrow = b.querySelector('.debate-arrow');
          if (arrow) arrow.textContent = '↓';
        });
      } else {
        section.classList.add('is-expanded');
        section.querySelectorAll('.debate-preview').forEach(function(el) {
          el.classList.add('hidden');
        });
        section.querySelectorAll('.debate-full').forEach(function(el) {
          el.classList.remove('hidden');
        });
        section.querySelectorAll('.debate-toggle-btn').forEach(function(b) {
          var label = b.querySelector('.debate-btn-text');
          if (label) label.textContent = 'Samazināt runas';
          var arrow = b.querySelector('.debate-arrow');
          if (arrow) arrow.textContent = '↑';
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebates);
  } else {
    initDebates();
  }
})();
