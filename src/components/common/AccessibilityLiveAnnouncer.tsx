import React from 'react';

/**
 * AuraPOS - Accessible Live Region Announcer
 * 
 * Provides WAI-ARIA live regions for TalkBack, VoiceOver, NVDA, and Android screen readers.
 * Automatically receives announcements from AccessibilityService.announce(text, priority).
 */
export const AccessibilityLiveAnnouncer: React.FC = () => {
  return (
    <div className="sr-only" aria-hidden="false">
      {/* Polite live region for standard non-urgent state announcements */}
      <div
        id="a11y-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Assertive live region for errors, warnings, and immediate hardware alerts */}
      <div
        id="a11y-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </div>
  );
};
