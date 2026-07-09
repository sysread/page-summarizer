/* Theme preference management for extension pages.
 *
 * The inline <head> script in each HTML page sets data-bs-theme from
 * prefers-color-scheme synchronously to prevent a flash of the wrong
 * theme. initTheme() then reconciles with the user's stored preference
 * from chrome.storage.sync and keeps the attribute in sync with system
 * changes when the preference is "system".
 */

let currentPreference = 'system';

function applyTheme() {
  const dark =
    currentPreference === 'dark' ||
    (currentPreference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
}

export async function initTheme() {
  const { theme } = await chrome.storage.sync.get('theme');
  currentPreference = theme || 'system';
  applyTheme();

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentPreference === 'system') {
      applyTheme();
    }
  });
}

export async function setTheme(preference) {
  currentPreference = preference;
  await chrome.storage.sync.set({ theme: preference });
  applyTheme();
}

export function getThemePreference() {
  return currentPreference;
}
