if (chrome && chrome.runtime) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name != 'fillForm') {
      return;
    }

    let overlayHost;
    let overlay;
    let instruction;
    let target;

    function fillText(element, textToFill) {
      requestAnimationFrame(() => {
        if (element.tagName == 'TEXTAREA' || element.tagName == 'INPUT') {
          element.value = textToFill;
        } else if (element.getAttribute('contenteditable') == 'true') {
          element.textContent = textToFill; // or element.innerHTML = textToFill;
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
        instruction.focus();
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

      // Create the host element and the shadow DOM
      overlayHost = document.createElement('div');
      const shadowRoot = overlayHost.attachShadow({ mode: 'closed' });

      // Create the overlay element
      overlay = document.createElement('div');
      overlay.id = 'overlay';
      overlay.style.position = 'fixed';
      overlay.style.zIndex = '10000';
      overlay.style.top = '10px';
      overlay.style.right = '10px';
      overlay.style.width = '600px';
      overlay.style.height = '400px';
      overlay.style.backgroundColor = 'white';
      overlay.style.color = 'black';
      overlay.style.border = '2px solid black';
      overlay.style.padding = '1em';
      overlay.style.margin = '1em';

      // Create the instruction label
      const instructionLabel = document.createElement('label');
      instructionLabel.for = 'instructions';
      instructionLabel.innerHTML = 'What would you like me to write?';

      // Create the textarea for user instructions
      instruction = document.createElement('textarea');
      instruction.id = 'instructions';
      instruction.style.width = '100%';
      instruction.style.height = '300px';
      instruction.style.margin = '10px 0';

      const includePageContentCheckbox = document.createElement('input');
      includePageContentCheckbox.type = 'checkbox';
      includePageContentCheckbox.id = 'includePageContent';

      const includePageContentLabel = document.createElement('label');
      includePageContentLabel.for = 'includePageContent';
      includePageContentLabel.innerHTML = 'Include page contents?';

      const includePageContent = document.createElement('div');
      includePageContent.appendChild(includePageContentCheckbox);
      includePageContent.appendChild(includePageContentLabel);

      // Create the submit button
      const submitButton = document.createElement('button');
      submitButton.id = 'submit';
      submitButton.innerHTML = 'Submit';
      submitButton.style.marginTop = '10px';

      // Add the submit button handler to send a message back to background.js
      submitButton.addEventListener('click', () => {
        const instructions = instruction.value;
        const includePageContent = includePageContentCheckbox.checked;
        const contents = includePageContent ? document.body.innerText : '';

        if (instructions != null && instructions.length > 0) {
          port.postMessage({
            action: 'GET_COMPLETION',
            text: instructions,
            extra: contents,
          });
        }

        removeOverlay(); // Close the overlay after submitting
      });

      // Create the close button
      const closeButton = document.createElement('button');
      closeButton.id = 'closeFormFillOverlay';
      closeButton.innerHTML = 'X';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.background = 'none';
      closeButton.style.fontSize = '18px';
      closeButton.style.cursor = 'pointer';
      closeButton.style.borderRadius = '20%';
      closeButton.style.border = '2px solid black';
      closeButton.style.fontWeight = 'bold';
      closeButton.style.color = 'red';

      // Add the close button click handler
      closeButton.addEventListener('click', removeOverlay);

      // Append elements to the overlay
      overlay.appendChild(closeButton);
      overlay.appendChild(instructionLabel);
      overlay.appendChild(instruction);
      overlay.appendChild(includePageContent);
      overlay.appendChild(submitButton);

      // Append the overlay to the shadow root and the host to the body
      shadowRoot.appendChild(overlay);
      document.body.insertBefore(overlayHost, document.body.firstChild);

      // Focus the textarea
      instruction.focus();

      // Prevent focus from leaving the textarea (some sites will steal focus as
      // part of their implementation of a contenteditable non-form element).
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
