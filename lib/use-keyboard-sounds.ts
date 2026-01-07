import { useEffect, useRef, useCallback, useState } from 'react';
import { Howl } from 'howler';

interface KeyboardSoundsOptions {
  initialEnabled?: boolean;
  volume?: number;
}

interface SoundMap {
  [key: string]: Howl;
}

export function useKeyboardSounds({ initialEnabled = true, volume = 0.9 }: KeyboardSoundsOptions = {}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const pressSoundsRef = useRef<SoundMap>({});
  const releaseSoundsRef = useRef<SoundMap>({});
  const genericPressSoundsRef = useRef<Howl[]>([]);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    // Press sounds
    pressSoundsRef.current = {
      ' ': new Howl({ src: ['/sounds/press/SPACE.mp3'], volume, preload: true, html5: true }),
      'Backspace': new Howl({ src: ['/sounds/press/BACKSPACE.mp3'], volume, preload: true, html5: true }),
      'Enter': new Howl({ src: ['/sounds/press/ENTER.mp3'], volume, preload: true, html5: true }),
    };

    // Generic press sounds (for regular character keys)
    genericPressSoundsRef.current = [
      new Howl({ src: ['/sounds/press/GENERIC_R0.mp3'], volume, preload: true, html5: true }),
      new Howl({ src: ['/sounds/press/GENERIC_R1.mp3'], volume, preload: true, html5: true }),
      new Howl({ src: ['/sounds/press/GENERIC_R2.mp3'], volume, preload: true, html5: true }),
      new Howl({ src: ['/sounds/press/GENERIC_R3.mp3'], volume, preload: true, html5: true }),
      new Howl({ src: ['/sounds/press/GENERIC_R4.mp3'], volume, preload: true, html5: true }),
    ];

    // Release sounds
    releaseSoundsRef.current = {
      ' ': new Howl({ src: ['/sounds/release/SPACE.mp3'], volume, preload: true, html5: true }),
      'Backspace': new Howl({ src: ['/sounds/release/BACKSPACE.mp3'], volume, preload: true, html5: true }),
      'Enter': new Howl({ src: ['/sounds/release/ENTER.mp3'], volume, preload: true, html5: true }),
      'generic': new Howl({ src: ['/sounds/release/GENERIC.mp3'], volume, preload: true, html5: true }),
    };

    isInitializedRef.current = true;

    return () => {
      Object.values(pressSoundsRef.current).forEach((sound) => sound.unload());
      Object.values(releaseSoundsRef.current).forEach((sound) => sound.unload());
      genericPressSoundsRef.current.forEach((sound) => sound.unload());
      isInitializedRef.current = false;
    };
  }, [volume]);

  const playPressSound = useCallback((key: string) => {
    if (!enabled) return;

    // Check for specific key sounds
    const specificSound = pressSoundsRef.current[key];
    if (specificSound) {
      specificSound.play();
    } else if (genericPressSoundsRef.current.length > 0) {
      // Use random generic sound for regular keys
      const randomIndex = Math.floor(Math.random() * genericPressSoundsRef.current.length);
      genericPressSoundsRef.current[randomIndex].play();
    }
  }, [enabled]);

  const playReleaseSound = useCallback((key: string) => {
    if (!enabled) return;

    // Check for specific key sounds
    const specificSound = releaseSoundsRef.current[key];
    if (specificSound) {
      specificSound.play();
    } else {
      // Use generic release sound for regular keys
      releaseSoundsRef.current['generic']?.play();
    }
  }, [enabled]);

  const toggleSound = useCallback(() => {
    setEnabled((prev) => {
      const newEnabled = !prev;
      // Play a sound when enabling
      if (newEnabled && genericPressSoundsRef.current.length > 0) {
        const randomIndex = Math.floor(Math.random() * genericPressSoundsRef.current.length);
        genericPressSoundsRef.current[randomIndex].play();
      }
      return newEnabled;
    });
  }, []);

  return { playPressSound, playReleaseSound, enabled, toggleSound };
}

