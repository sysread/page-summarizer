/* Shared CSS for shadow-DOM overlays injected into web pages by the
 * selection-summarizer and form-filler content scripts.
 *
 * These scripts are injected as classic scripts (not ES modules) via
 * chrome.scripting.executeScript, so the CSS is exposed as a global
 * string that each content script reads and injects into its shadow
 * root as a <style> element. Shadow DOM isolates these styles from the
 * host page. Dark mode is handled via prefers-color-scheme since the
 * overlay is extension UI, not part of the page's own theme.
 */

window.__psOverlayCSS = `
.ps-overlay {
  position: fixed;
  z-index: 2147483647;
  top: 16px;
  right: 16px;
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  color: #1c2330;
  border: 1px solid #e2e5ea;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 16px 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .ps-overlay {
    background: #1e2028;
    color: #dfe2e8;
    border-color: #333742;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

.ps-overlay-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.ps-overlay-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  padding-right: 32px;
}

.ps-close-btn {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 150ms ease, background 150ms ease;
}

.ps-close-btn:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.06);
}

.ps-close-btn:active {
  background: rgba(0, 0, 0, 0.10);
}

@media (prefers-color-scheme: dark) {
  .ps-close-btn {
    color: #9ca3af;
  }
  .ps-close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .ps-close-btn:active {
    background: rgba(255, 255, 255, 0.12);
  }
}

.ps-error {
  color: #e03131;
  font-style: italic;
}

@media (prefers-color-scheme: dark) {
  .ps-error {
    color: #ff6b6b;
  }
}

.ps-label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  font-size: 13px;
}

.ps-textarea {
  width: 100%;
  min-height: 120px;
  padding: 8px 12px;
  border: 1px solid #e2e5ea;
  border-radius: 8px;
  background: #ffffff;
  color: #1c2330;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.ps-textarea:focus {
  outline: none;
  border-color: #4263eb;
  box-shadow: 0 0 0 3px rgba(66, 99, 235, 0.1);
}

@media (prefers-color-scheme: dark) {
  .ps-textarea {
    background: #16171d;
    color: #dfe2e8;
    border-color: #333742;
  }
  .ps-textarea:focus {
    border-color: #5c7cfa;
    box-shadow: 0 0 0 3px rgba(92, 124, 250, 0.15);
  }
}

.ps-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  font-size: 13px;
}

.ps-checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4263eb;
  cursor: pointer;
}

.ps-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: #4263eb;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease;
}

.ps-btn:hover {
  background: #3b5bdb;
}

.ps-btn:active {
  background: #3551c9;
}

@media (prefers-color-scheme: dark) {
  .ps-btn {
    background: #5c7cfa;
  }
  .ps-btn:hover {
    background: #748ffc;
  }
  .ps-btn:active {
    background: #4263eb;
  }
}

.ps-overlay-content h1,
.ps-overlay-content h2,
.ps-overlay-content h3 {
  font-weight: 600;
  margin: 0.8em 0 0.4em;
}

.ps-overlay-content h1 { font-size: 1.25em; }
.ps-overlay-content h2 { font-size: 1.15em; }
.ps-overlay-content h3 { font-size: 1.05em; }

.ps-overlay-content p {
  margin: 0 0 0.6em;
  line-height: 1.6;
}

.ps-overlay-content ul,
.ps-overlay-content ol {
  padding-left: 1.5em;
  margin: 0 0 0.6em;
}

.ps-overlay-content li {
  margin-bottom: 0.3em;
  line-height: 1.5;
}

.ps-overlay-content code {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  padding: 0.1em 0.35em;
  font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", "Courier New", monospace;
  font-size: 0.85em;
}

.ps-overlay-content pre {
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 0.6em 0.8em;
  overflow-x: auto;
}

.ps-overlay-content pre code {
  background: none;
  padding: 0;
}

.ps-overlay-content a {
  color: #4263eb;
  text-decoration: none;
}

.ps-overlay-content a:hover {
  text-decoration: underline;
}

.ps-overlay-content blockquote {
  border-left: 3px solid rgba(66, 99, 235, 0.3);
  padding-left: 1em;
  margin: 0 0 0.6em;
  color: #6b7280;
}

@media (prefers-color-scheme: dark) {
  .ps-overlay-content code,
  .ps-overlay-content pre {
    background: rgba(255, 255, 255, 0.08);
  }
  .ps-overlay-content a {
    color: #5c7cfa;
  }
  .ps-overlay-content blockquote {
    border-left-color: rgba(92, 124, 250, 0.35);
    color: #9ca3af;
  }
}
`;
