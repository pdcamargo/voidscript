/**
 * Clipboard utility that works in both Tauri and browser environments
 */

let clipboardWrite: ((text: string) => Promise<void>) | null = null;

// Try to load Tauri clipboard manager
async function initTauriClipboard() {
  try {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    clipboardWrite = writeText;
    console.log('[Clipboard] Using Tauri clipboard manager');
  } catch (err) {
    console.log('[Clipboard] Tauri clipboard not available, using browser API');
  }
}

// Initialize on module load
initTauriClipboard();

/**
 * Write text to clipboard (works in both Tauri and browser)
 */
export async function writeTextToClipboard(text: string): Promise<void> {
  if (clipboardWrite) {
    // Use Tauri clipboard manager
    await clipboardWrite(text);
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    // Fall back to browser clipboard API
    await navigator.clipboard.writeText(text);
  } else {
    throw new Error('Clipboard API not available');
  }
}
