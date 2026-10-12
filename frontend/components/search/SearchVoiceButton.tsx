"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { trackSearchEvent } from "@/lib/search-analytics";

type SpeechAlternative = { transcript: string };
type SpeechResult = { readonly 0: SpeechAlternative };
type SpeechResults = { readonly length: number; readonly 0: SpeechResult };
type SpeechResultEvent = Event & { readonly results: SpeechResults };

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function SearchVoiceButton({
  onTranscript,
}: {
  onTranscript: (transcript: string) => void;
}) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const browserWindow = window as SpeechWindow;
    setSupported(
      Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition)
    );
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const browserWindow = window as SpeechWindow;
    const SpeechRecognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (!transcript) return;
      onTranscript(transcript);
      trackSearchEvent("voice_completed", {
        transcript_length: transcript.length,
      });
    };
    recognition.onerror = () => {
      setError("Voice search could not start. Check microphone permissions.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      setError(null);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      trackSearchEvent("voice_started");
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("Voice search could not start. Try typing your search instead.");
    }
  }

  return (
    <span className="voice-search">
      <button
        className={`voice-search__button${listening ? " is-listening" : ""}`}
        type="button"
        onClick={toggleListening}
        disabled={!supported}
        aria-label={
          supported
            ? listening
              ? "Stop voice search"
              : "Start voice search"
            : "Voice search is unavailable in this browser"
        }
        aria-pressed={listening}
        title={supported ? "Search by voice" : "Voice search unavailable"}
      >
        {listening ? <MicOff size={17} /> : <Mic size={17} />}
      </button>
      {error && (
        <span className="voice-search__error" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
