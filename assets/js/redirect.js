// Forward legacy React SPA hash routes to clean static SSG URLs
(function() {
  function handleRedirect() {
    var hash = window.location.hash;
    if (!hash) return;

    var voteMatch = hash.match(/^#balsojums-([a-zA-Z0-9_-]+)/i);
    if (voteMatch) {
      window.location.replace('/balsojumi/' + voteMatch[1] + '/');
      return;
    }

    var mpMatch = hash.match(/^#deputats-([a-zA-Z0-9_-]+)/i);
    if (mpMatch) {
      window.location.replace('/deputati/' + mpMatch[1] + '/');
      return;
    }

    var h = hash.toLowerCase();
    if (h === '#deputati' || h === '#partijas' || h === '#mps') {
      window.location.replace('/deputati/');
      return;
    }

    if (h.startsWith('#radars') || h.startsWith('#tematiskais-radars') || h.startsWith('#issues')) {
      window.location.replace('/');
      return;
    }

    if (h === '#balsojumi' || h === '#votes') {
      window.location.replace('/');
      return;
    }
  }

  handleRedirect();
  window.addEventListener('hashchange', handleRedirect);
})();
