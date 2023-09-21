chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'contentScriptPort') {
    return;
  }

  let target;

  function updateSummary(msg) {
    target.innerHTML = msg;
  }

  function reportError(msg) {
    updateSummary(`<span style="color: red; font-style: italic;">Error: ${msg}</span>`);
  }

  function createOverlay() {
    if (target != null) {
      return;
    }

    const overlayHost = document.createElement('div');
    const shadowRoot  = overlayHost.attachShadow({mode: 'closed'});

    const overlay                  = document.createElement('div');
    overlay.id                     = 'overlay';
    overlay.style.position         = 'fixed';
    overlay.style.zIndex           = '10000';
    overlay.style.top              = '10';
    overlay.style.right            = '10';
    overlay.style.width            = '600px';
    overlay.style.height           = '400px';
    overlay.style.backgroundColor  = 'white';
    overlay.style.color            = 'black';
    overlay.style.border           = '2px solid black';
    overlay.style.padding          = '1em';
    overlay.style.margin           = '1em';

    const content                  = document.createElement('div');
    content.id                     = 'overlayContent';

    const title                    = document.createElement('h3');
    title.innerHTML                = 'Summary';

    // Create the close button
    const closeButton              = document.createElement('button');
    closeButton.id                 = 'closeOverlay';
    closeButton.innerHTML          = 'X';
    closeButton.style.position     = 'absolute';
    closeButton.style.top          = '10px';
    closeButton.style.right        = '10px';
    closeButton.style.background   = 'none';
    closeButton.style.fontSize     = '18px';
    closeButton.style.cursor       = 'pointer';
    closeButton.style.borderRadius = '20%';
    closeButton.style.border       = '2px solid black';
    closeButton.style.fontWeight   = 'bold';
    closeButton.style.color        = 'red';

    // Add the close button click handler
    closeButton.addEventListener('click', () => {
      overlayHost.remove();
      target = null;
    });

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

    if (msg.done) {
      if (msg.error != null) {
        reportError(msg.error);
      }

      return;
    }

    if (msg.summary != null && msg.summary.length > 0) {
      updateSummary(marked.marked(msg.summary));
    } else {
      reportError('Failed to fetch summary.');
    }
  });
});
