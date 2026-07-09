if (chrome && chrome.runtime) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name != 'fillForm') {
      return;
    }

    let overlayHost;
    let overlay;
    let instruction;
    let target;
    let allowFocusChange = true;

    function fillText(element, textToFill) {
      requestAnimationFrame(() => {
        if (element.tagName == 'TEXTAREA' || element.tagName == 'INPUT') {
          element.value = textToFill;
        } else if (element.getAttribute('contenteditable') == 'true') {
          element.textContent = textToFill;
        } else {
          console.warn('Element type not supported', element);
        }
      });
    }

    function updateTarget(msg) {
      const div = document.createElement('div');
      div.innerHTML = marked.marked(msg);
      fillText(target, div.innerText);
    }

    function reportError(msg) {
      alert(msg);
      removeOverlay();
    }

    function restoreFocus(event) {
      if (event.target != instruction) {
        event.stopPropagation();
        event.preventDefault();

        allowFocusChange = true;
        instruction.focus();
        allowFocusChange = false;

        return false;
      }
      return true;
    }

    function removeOverlay() {
      if (overlayHost != null) {
        overlayHost.remove();
      }

      overlayHost = null;
      overlay = null;
      instruction = null;

      document.removeEventListener('focus', restoreFocus, true);
    }

    function displayOverlay() {
      removeOverlay();

      overlayHost = document.createElement('div');
      const shadowRoot = overlayHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = window.__psOverlayCSS || '';
      shadowRoot.appendChild(style);

      overlay = document.createElement('div');
      overlay.className = 'ps-overlay';

      const closeButton = document.createElement('button');
      closeButton.className = 'ps-close-btn';
      closeButton.innerHTML = '&times;';
      closeButton.addEventListener('click', removeOverlay);

      const instructionLabel = document.createElement('label');
      instructionLabel.className = 'ps-label';
      instructionLabel.for = 'instructions';
      instructionLabel.textContent = 'What would you like me to write?';

      instruction = document.createElement('textarea');
      instruction.id = 'instructions';
      instruction.className = 'ps-textarea';

      const includePageContentCheckbox = document.createElement('input');
      includePageContentCheckbox.type = 'checkbox';
      includePageContentCheckbox.id = 'includePageContent';

      const includePageContentLabel = document.createElement('label');
      includePageContentLabel.for = 'includePageContent';
      includePageContentLabel.textContent = 'Include page contents?';

      const includePageContent = document.createElement('div');
      includePageContent.className = 'ps-checkbox-row';
      includePageContent.appendChild(includePageContentCheckbox);
      includePageContent.appendChild(includePageContentLabel);

      const submitButton = document.createElement('button');
      submitButton.id = 'submit';
      submitButton.className = 'ps-btn';
      submitButton.textContent = 'Submit';
      submitButton.addEventListener('click', () => {
        const instructions = instruction.value;
        const includePageContent = includePageContentCheckbox.checked;
        const contents = includePageContent ? document.body.innerText : '';

        if (instructions != null && instructions.length > 0) {
          port.postMessage({
            action: 'GET_COMPLETION',
            text: instructions,
            instructions: contents,
          });
        }

        removeOverlay();
      });

      overlay.appendChild(closeButton);
      overlay.appendChild(instructionLabel);
      overlay.appendChild(instruction);
      overlay.appendChild(includePageContent);
      overlay.appendChild(submitButton);

      shadowRoot.appendChild(overlay);
      document.body.insertBefore(overlayHost, document.body.firstChild);

      allowFocusChange = true;
      instruction.focus();
      allowFocusChange = false;

      document.addEventListener('focus', restoreFocus, true);
    }

    port.onMessage.addListener((msg) => {
      if (msg == null) {
        return;
      }

      switch (msg.action) {
        case 'DISPLAY_OVERLAY':
          target = document.activeElement;
          displayOverlay();
          break;

        case 'GPT_MESSAGE':
          updateTarget(msg.summary);
          break;

        case 'GPT_DONE':
          target = null;
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
