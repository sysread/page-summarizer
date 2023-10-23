chrome.runtime.onConnect.addListener((port) => {
  if (port.name != "fillForm") {
    return;
  }

  let overlayHost;
  let overlay;
  let target;

  function updateTarget(msg) {
    target.value = msg;
  }

  function reportError(msg) {
    alert(msg);
    removeOverlay();
  }

  function removeOverlay() {
    if (overlayHost != null) {
      overlayHost.remove();
    }

    overlayHost = null;
    overlay = null;
  }

  function displayOverlay() {
    removeOverlay();

    // Create the host element and the shadow DOM
    overlayHost = document.createElement('div');
    const shadowRoot = overlayHost.attachShadow({mode: 'closed'});

    // Create the overlay element
    overlay                          = document.createElement('div');
    overlay.id                       = 'overlay';
    overlay.style.position           = 'fixed';
    overlay.style.zIndex             = '10000';
    overlay.style.top                = '10px';
    overlay.style.right              = '10px';
    overlay.style.width              = '600px';
    overlay.style.height             = '400px';
    overlay.style.backgroundColor    = 'white';
    overlay.style.color              = 'black';
    overlay.style.border             = '2px solid black';
    overlay.style.padding            = '1em';
    overlay.style.margin             = '1em';

    // Create the instruction label
    const instructionLabel           = document.createElement('label');
    instructionLabel.for             = 'instructions';
    instructionLabel.innerHTML       = 'What would you like me to write?';

    // Create the textarea for user instructions
    const instructionTextarea        = document.createElement('textarea');
    instructionTextarea.id           = 'instructions';
    instructionTextarea.style.width  = '100%';
    instructionTextarea.style.height = '300px';
    instructionTextarea.style.margin = '10px 0';

    // Create the submit button
    const submitButton               = document.createElement('button');
    submitButton.id                  = 'submit';
    submitButton.innerHTML           = 'Submit';
    submitButton.style.marginTop     = '10px';

    // Add the submit button handler to send a message back to background.js
    submitButton.addEventListener('click', () => {
      const instructions = instructionTextarea.value;

      if (instructions != null && instructions.length > 0) {
        port.postMessage({
          action: 'getCompletion',
          text:   instructions
        });
      }

      removeOverlay(); // Close the overlay after submitting
    });

    // Create the close button
    const closeButton              = document.createElement('button');
    closeButton.id                 = 'closeFormFillOverlay';
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
    closeButton.addEventListener('click', removeOverlay);

    // Append elements to the overlay
    overlay.appendChild(closeButton);
    overlay.appendChild(instructionLabel);
    overlay.appendChild(instructionTextarea);
    overlay.appendChild(submitButton);

    // Append the overlay to the shadow root and the host to the body
    shadowRoot.appendChild(overlay);
    document.body.insertBefore(overlayHost, document.body.firstChild);

    // Focus the textarea
    instructionTextarea.focus();
  }

  port.onMessage.addListener((msg) => {
    if (msg == null) {
      return;
    }
    else if (msg.action == "displayOverlay") {
      target = document.activeElement;
      displayOverlay();
    }
    else if (msg.action == "recvCompletion") {
      if (msg.done) {
        target = null;

        if (msg.error != null) {
          reportError(msg.error);
        }

        return;
      }
      else if (msg.summary != null && msg.summary.length > 0) {
        updateTarget(msg.summary);
      }
    }
  });
});
