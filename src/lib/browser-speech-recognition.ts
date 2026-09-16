/**
 * Web Speech API — Chrome / Edge 支持较好；Firefox / Safari 可能不可用。
 * https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
 */

type RecognitionCtor = new () => SpeechRecognition;

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window &
    typeof globalThis & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
