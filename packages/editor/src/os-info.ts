/**
 * OS Info - Operating system detection utility
 *
 * Provides OS type detection with caching for use throughout the editor.
 * Uses Tauri's OS plugin when available, falls back to user agent detection.
 *
 * @example
 * ```typescript
 * // Initialize once at startup
 * await initOSInfo();
 *
 * // Use synchronously anywhere
 * const os = getOSType();
 * if (os === 'macos') {
 *   // Render traffic light buttons
 * }
 * ```
 */

export type OSType = 'macos' | 'windows' | 'linux';

// Cached OS type (set on first call to initOSInfo)
let cachedOSType: OSType | null = null;

/**
 * Initialize OS detection.
 * Call this once during application startup.
 *
 * @returns The detected OS type
 */
export async function initOSInfo(): Promise<OSType> {
  if (cachedOSType !== null) {
    return cachedOSType;
  }

  try {
    // Try to use Tauri's OS plugin
    const { platform } = await import('@tauri-apps/plugin-os');
    const platformName = await platform();

    switch (platformName) {
      case 'macos':
        cachedOSType = 'macos';
        break;
      case 'windows':
        cachedOSType = 'windows';
        break;
      case 'linux':
      case 'freebsd':
      case 'dragonfly':
      case 'netbsd':
      case 'openbsd':
      case 'solaris':
        cachedOSType = 'linux';
        break;
      default:
        // Default to linux for unknown platforms
        cachedOSType = 'linux';
    }
  } catch {
    // Tauri not available, fall back to user agent detection
    cachedOSType = detectOSFromUserAgent();
  }

  console.log(`[OSInfo] Detected OS: ${cachedOSType}`);
  return cachedOSType;
}

/**
 * Get the cached OS type.
 * Must call initOSInfo() first, otherwise returns 'linux' as fallback.
 *
 * @returns The detected OS type
 */
export function getOSType(): OSType {
  if (cachedOSType === null) {
    console.warn(
      '[OSInfo] getOSType called before initOSInfo. Falling back to user agent detection.',
    );
    cachedOSType = detectOSFromUserAgent();
  }
  return cachedOSType;
}

/**
 * Check if the current OS is macOS
 */
export function isMacOS(): boolean {
  return getOSType() === 'macos';
}

/**
 * Check if the current OS is Windows
 */
export function isWindows(): boolean {
  return getOSType() === 'windows';
}

/**
 * Check if the current OS is Linux (or other Unix-like)
 */
export function isLinux(): boolean {
  return getOSType() === 'linux';
}

/**
 * Detect OS from browser user agent string
 * Used as fallback when Tauri is not available
 */
function detectOSFromUserAgent(): OSType {
  if (typeof navigator === 'undefined') {
    return 'linux';
  }

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('mac')) {
    return 'macos';
  }
  if (ua.includes('win')) {
    return 'windows';
  }
  return 'linux';
}
