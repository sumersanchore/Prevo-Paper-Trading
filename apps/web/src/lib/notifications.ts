/**
 * Web Browser Push Notifications & Audio Chime System
 * Provides instant desktop/mobile OS notifications and synthesized trade execution sounds.
 */

// Synthesized Audio Chime using Web Audio API (Zero external mp3 files needed)
export function playNotificationSound(type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' = 'SUCCESS'): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'SUCCESS') {
      // High pleasant two-tone chime (880Hz -> 1320Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'ERROR') {
      // Lower warning double buzz (440Hz -> 220Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'WARNING') {
      // Moderate caution pulse (600Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Soft info chime (523Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // AudioContext blocked by browser policy prior to user interaction
  }
}

/**
 * Request OS/Browser Native Push Notification Permission
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Trigger Native Web Push Notification with Click Action & Sound
 */
export function triggerBrowserNotification(params: {
  title: string;
  message: string;
  severity?: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO';
  onClick?: () => void;
}): void {
  const { title, message, severity = 'SUCCESS', onClick } = params;

  // 1. Play synthesized trade sound
  playNotificationSound(severity);

  // 2. Dispatch OS / Browser Native Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(`PREVO • ${title}`, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `prevo-${Date.now()}`,
        requireInteraction: severity === 'ERROR',
      });

      notif.onclick = () => {
        window.focus();
        if (onClick) onClick();
        notif.close();
      };
    } catch (err) {
      console.warn('Native notification failed:', err);
    }
  }
}
