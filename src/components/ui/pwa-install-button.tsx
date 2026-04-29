'use client';

import { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from './button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
                            window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    // Check if user has already dismissed the install button
    const dismissed = localStorage.getItem('pwa-install-button-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Show button after a short delay
      setTimeout(() => setIsVisible(true), 500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also show for users who might have the app installed but want to reinstall
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone === true;

      if (!isStandalone) {
        setTimeout(() => setIsVisible(true), 500);
      }
    };

    // Check after page load
    window.addEventListener('load', checkStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('load', checkStandalone);
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for browsers without beforeinstallprompt support
      alert('To install AlphaSight AI:\n\n📱 iOS Safari: Tap Share → "Add to Home Screen"\n🤖 Android Chrome: Tap Menu → "Add to Home Screen"');
      return;
    }

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
      setDeferredPrompt(null);
      setIsVisible(false);
    } else {
      console.log('[PWA] User dismissed the install prompt');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-button-dismissed', 'true');
  };

  // Don't show if dismissed, or not available (temporarily show on all devices for debugging)
  console.log('[PWA Debug] isDismissed:', isDismissed, 'isVisible:', isVisible, 'isMobile:', isMobile);
  if (isDismissed || !isVisible) return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <Button
          onClick={handleInstall}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 h-8"
          title="Upgrade this site into an app - Add AlphaSight to your home screen"
        >
          <Download className="w-3 h-3 mr-1" />
          Install App
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss install prompt"
          title="Don't show this again"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Hint tooltip */}
      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          Add AlphaSight to your home screen
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
        </div>
      </div>
    </div>
  );
}