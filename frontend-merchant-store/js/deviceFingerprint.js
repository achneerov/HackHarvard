/**
 * Device Fingerprinting Utility
 * Generates a unique identifier for the user's device based on browser/system characteristics
 */

// Hash function for generating fingerprint
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Collect device characteristics
function collectDeviceInfo() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages ? navigator.languages.join(',') : '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    screenResolution: `${screen.width}x${screen.height}`,
    screenColorDepth: screen.colorDepth,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    deviceMemory: navigator.deviceMemory || 'unknown',
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || 'unknown',
  };

  return info;
}

// Generate device fingerprint
export async function generateDeviceFingerprint() {
  const info = collectDeviceInfo();

  // Combine key characteristics into a string
  const fingerprintString = [
    info.userAgent,
    info.platform,
    info.language,
    info.timezone,
    info.screenResolution,
    info.screenColorDepth,
    info.hardwareConcurrency,
  ].join('|');

  // Hash the string to create fingerprint
  const fingerprint = await hashString(fingerprintString);

  return {
    fingerprint,
    info: {
      userAgent: info.userAgent,
      platform: info.platform,
      screenResolution: info.screenResolution,
      timezone: info.timezone,
      language: info.language,
    },
  };
}

// Get or create persistent device ID (stored in localStorage)
export function getDeviceId() {
  const storageKey = 'veritas_device_id';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    // Generate random device ID
    deviceId = 'device_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}
