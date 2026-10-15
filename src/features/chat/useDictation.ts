/**
 * Speech-to-text for the composer. Uses the Web Speech API when the webview offers
 * it (Danish); otherwise points the user to Windows' built-in dictation (Win+H),
 * which types straight into the focused text field.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/notifications/toast';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function createRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function windowsHint(focus: () => void) {
  focus();
  toast('Brug Windows-diktering', { description: 'Tryk Win + H for at tale – teksten skrives direkte i chatfeltet.', duration: 7000 });
}

export function useDictation(onText: (text: string) => void, focus: () => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = useCallback(() => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = createRecognition();
    if (!r) return windowsHint(focus);
    r.lang = 'da-DK';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res?.isFinal) onTextRef.current(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => {
      setListening(false);
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      windowsHint(focus);
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      rec.current = r;
      setListening(true);
      focus();
    } catch {
      windowsHint(focus);
    }
  }, [listening, focus]);

  return { listening, toggle };
}
