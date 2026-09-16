"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognition,
  isBrowserSpeechRecognitionSupported,
} from "@/lib/browser-speech-recognition";

export type EnglishMicState = "idle" | "starting" | "listening";

/**
 * Browser Web Speech → English transcript (Chrome / Edge). Controlled transcript
 * so parent can persist or share state.
 */
export function useEnglishSpeechDictation(options: {
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  /** When true, start is blocked (e.g. model loading). */
  blocked?: boolean;
}) {
  const { setTranscript, blocked = false } = options;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const [interim, setInterim] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [micState, setMicState] = useState<EnglishMicState>("idle");
  const [clientReady, setClientReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stopUiFailsafeRef = useRef<number | null>(null);

  const speechSupported = clientReady && isBrowserSpeechRecognitionSupported();

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (stopUiFailsafeRef.current != null) {
        window.clearTimeout(stopUiFailsafeRef.current);
        stopUiFailsafeRef.current = null;
      }
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const clearStopUiFailsafe = useCallback(() => {
    if (stopUiFailsafeRef.current != null) {
      window.clearTimeout(stopUiFailsafeRef.current);
      stopUiFailsafeRef.current = null;
    }
  }, []);

  const forceMicUiIdle = useCallback(() => {
    clearStopUiFailsafe();
    recognitionRef.current = null;
    setMicState("idle");
    setInterim("");
  }, [clearStopUiFailsafe]);

  const stopListening = useCallback(() => {
    clearStopUiFailsafe();
    const rec = recognitionRef.current;
    if (!rec) {
      forceMicUiIdle();
      return;
    }
    const finishStop = () => {
      clearStopUiFailsafe();
      recognitionRef.current = null;
      setMicState("idle");
      setInterim("");
    };
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        finishStop();
        return;
      }
    }
    stopUiFailsafeRef.current = window.setTimeout(finishStop, 900);
  }, [clearStopUiFailsafe, forceMicUiIdle]);

  const startListening = useCallback(() => {
    if (micState !== "idle" || blockedRef.current) return;
    setSpeechError(null);
    const rec = createSpeechRecognition();
    if (!rec) {
      setSpeechError(
        "当前浏览器不支持 Web Speech 语音识别，请换 Chrome / Edge，或改用文本框输入。",
      );
      return;
    }
    recognitionRef.current?.abort();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (recognitionRef.current !== rec) return;
      clearStopUiFailsafe();
      setMicState("listening");
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (recognitionRef.current !== rec) return;
      let pieceInterim = "";
      let pieceFinal = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const chunk = r[0]?.transcript ?? "";
        if (r.isFinal) pieceFinal += chunk;
        else pieceInterim += chunk;
      }
      if (pieceFinal.trim()) {
        setTranscript((prev) => {
          const t = pieceFinal.trim();
          return prev.trim() ? `${prev.trimEnd()} ${t}` : t;
        });
      }
      setInterim(pieceInterim.trim());
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (recognitionRef.current !== rec) return;
      clearStopUiFailsafe();
      if (ev.error === "aborted") {
        recognitionRef.current = null;
        setMicState("idle");
        setInterim("");
        return;
      }
      if (ev.error === "no-speech") {
        recognitionRef.current = null;
        setMicState("idle");
        setInterim("");
        return;
      }
      const msg =
        ev.error === "not-allowed"
          ? "麦克风权限被拒绝，请在浏览器地址栏或系统设置中允许本站访问麦克风。"
          : `语音识别：${ev.error}`;
      setSpeechError(msg);
      recognitionRef.current = null;
      setMicState("idle");
      setInterim("");
    };

    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      clearStopUiFailsafe();
      recognitionRef.current = null;
      setMicState("idle");
      setInterim("");
    };

    try {
      setMicState("starting");
      rec.start();
    } catch {
      setSpeechError("无法启动语音识别，请稍后重试。");
      recognitionRef.current = null;
      setMicState("idle");
    }
  }, [micState, setTranscript, clearStopUiFailsafe]);

  return {
    interim,
    setInterim,
    speechError,
    setSpeechError,
    micState,
    speechSupported,
    clientReady,
    startListening,
    stopListening,
  };
}
