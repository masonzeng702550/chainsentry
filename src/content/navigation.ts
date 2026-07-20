/**
 * SPA navigation watcher.
 *
 * YouTube — the main livestream-scam surface — is a single-page app: clicking to
 * another video swaps the DOM without a document load, so a content script that
 * only runs at document_idle would analyse the first page and then go blind.
 *
 * Content scripts run in an isolated world, so patching history.pushState here
 * would NOT intercept the page's own calls. Polling location.href is the reliable
 * cross-site approach; a string compare on an interval is negligible, and popstate
 * gives us an immediate signal for back/forward.
 */
export function watchNavigation(onNavigate: (url: string) => void, intervalMs = 1000): () => void {
  let lastUrl = location.href;

  const check = () => {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    onNavigate(url);
  };

  const timer = setInterval(check, intervalMs);
  window.addEventListener('popstate', check);
  // YouTube emits this once its SPA route swap has settled.
  document.addEventListener('yt-navigate-finish', check as EventListener);

  return () => {
    clearInterval(timer);
    window.removeEventListener('popstate', check);
    document.removeEventListener('yt-navigate-finish', check as EventListener);
  };
}
