if (chrome && chrome.runtime) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'contentScriptPort') {
      return;
    }

    let target;

    function updateSummary(msg) {
      requestAnimationFrame(() => {
        target.innerHTML = msg;
      });
    }

    function reportError(msg) {
      updateSummary('<p class="ps-error">Error: ' + msg + '</p>');
    }

    function createOverlay() {
      if (target != null) {
        return;
      }

      const overlayHost = document.createElement('div');
      const shadowRoot = overlayHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = window.__psOverlayCSS || '';
      shadowRoot.appendChild(style);

      const overlay = document.createElement('div');
      overlay.className = 'ps-overlay';

      const closeButton = document.createElement('button');
      closeButton.className = 'ps-close-btn';
      closeButton.innerHTML = '&times;';
      closeButton.addEventListener('click', () => {
        overlayHost.remove();
        target = null;
      });

      const title = document.createElement('div');
      title.className = 'ps-overlay-title';
      title.textContent = 'Summary';

      const content = document.createElement('div');
      content.className = 'ps-overlay-content';

      overlay.appendChild(closeButton);
      overlay.appendChild(title);
      overlay.appendChild(content);

      shadowRoot.appendChild(overlay);
      document.body.insertBefore(overlayHost, document.body.firstChild);

      target = content;
    }

    port.onMessage.addListener((msg) => {
      createOverlay();

      if (msg == null) {
        return;
      }

      switch (msg.action) {
        case 'GPT_MESSAGE':
          updateSummary(marked.marked(msg.summary));
          break;

        case 'GPT_DONE':
          break;

        case 'GPT_ERROR':
          reportError(msg.error);
          break;

        default:
          reportError('Failed to fetch summary.');
          break;
      }
    });
  });
}
