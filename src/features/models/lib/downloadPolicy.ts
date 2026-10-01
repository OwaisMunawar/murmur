export type NetworkSnapshot = {
  isConnected: boolean;
  /** Cellular, or a hotspot the OS flags as metered. */
  isMetered: boolean;
};

export type DownloadDecision =
  | { allowed: true }
  | { allowed: false; reason: 'offline' | 'needs-wifi' | 'disk-space'; message: string };

/** Space kept free beyond the model itself, so a download never fills the phone. */
export const DISK_HEADROOM_BYTES = 500_000_000;

export function decideDownload(input: {
  network: NetworkSnapshot;
  wifiOnly: boolean;
  requiredBytes: number;
  freeBytes: number;
}): DownloadDecision {
  const { network, wifiOnly, requiredBytes, freeBytes } = input;
  if (!network.isConnected) {
    return {
      allowed: false,
      reason: 'offline',
      message: 'You are offline. Connect to download models.',
    };
  }
  if (wifiOnly && network.isMetered) {
    return {
      allowed: false,
      reason: 'needs-wifi',
      message: 'Wi-Fi only is on. Connect to Wi-Fi, or turn it off in Settings.',
    };
  }
  if (freeBytes < requiredBytes + DISK_HEADROOM_BYTES) {
    return {
      allowed: false,
      reason: 'disk-space',
      message: 'Not enough free space on this device.',
    };
  }
  return { allowed: true };
}
