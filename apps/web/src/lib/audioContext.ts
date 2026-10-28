let sharedContext: AudioContext | null = null;

/**
 * One shared AudioContext for level meters. Browsers suspend contexts until a user gesture,
 * so the first pointer or key press resumes it.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;

  if (!sharedContext) {
    sharedContext = new AudioContext();
    const resume = () => {
      if (sharedContext?.state === 'suspended') void sharedContext.resume();
    };
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('keydown', resume);
  }
  return sharedContext;
}
