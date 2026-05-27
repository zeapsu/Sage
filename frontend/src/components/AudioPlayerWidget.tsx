"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// --- Types ---

interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
}

interface AudioTrack {
  id: string;
  title: string;
  voice: string;
  duration: number; // total seconds
  transcript: TranscriptSegment[];
}

interface AudioPlayerWidgetProps {
  track: AudioTrack;
  /** Direct URL to a synthesized audio file (e.g. OpenAI TTS MP3). When
   *  provided, a real <audio> element drives playback. When null/undefined
   *  the widget falls back to browser SpeechSynthesis. */
  audioUrl?: string | null;
  /** Full narration script — used for SpeechSynthesis fallback when no
   *  audioUrl is available. If absent the concatenated transcript is used. */
  script?: string;
}

// --- Sample data for prototyping ---

export const SAMPLE_TRACK: AudioTrack = {
  id: "audio-1",
  title: "Audio Review: Transformer Architecture",
  voice: "Lessac",
  duration: 312, // 5:12
  transcript: [
    {
      id: "s1",
      text: "The transformer architecture, introduced in the landmark 2017 paper 'Attention Is All You Need,' fundamentally changed how we approach sequence modeling.",
      startTime: 0,
      endTime: 8,
    },
    {
      id: "s2",
      text: "Unlike recurrent neural networks that process tokens one at a time, transformers process entire sequences in parallel using a mechanism called self-attention.",
      startTime: 8,
      endTime: 17,
    },
    {
      id: "s3",
      text: "Self-attention allows each token to directly attend to every other token in the sequence, capturing long-range dependencies without the vanishing gradient problem.",
      startTime: 17,
      endTime: 27,
    },
    {
      id: "s4",
      text: "The key insight is the query-key-value mechanism. Each token generates a query, and all tokens provide keys and values. Attention scores determine how much each value contributes.",
      startTime: 27,
      endTime: 39,
    },
    {
      id: "s5",
      text: "Multi-head attention runs several attention operations in parallel, each learning different types of relationships — syntactic, semantic, and positional.",
      startTime: 39,
      endTime: 48,
    },
    {
      id: "s6",
      text: "Each transformer block combines multi-head attention with a feed-forward network, layer normalization, and residual connections for stable deep training.",
      startTime: 48,
      endTime: 58,
    },
    {
      id: "s7",
      text: "Positional encodings inject sequence order information since the model has no inherent notion of position. The original paper used sinusoidal functions for this purpose.",
      startTime: 58,
      endTime: 69,
    },
    {
      id: "s8",
      text: "This architecture became the foundation for BERT, GPT, and virtually every modern large language model. The transformer truly lives up to its name.",
      startTime: 69,
      endTime: 79,
    },
  ],
};

// --- Helpers ---

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Component ---

export default function AudioPlayerWidget({ track, audioUrl, script }: AudioPlayerWidgetProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechStartRef = useRef<number>(0);
  const speechBaseTimeRef = useRef<number>(0);

  // --- Mode A: real <audio> element (server-side TTS available) ---
  useEffect(() => {
    if (!audioUrl) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(el.duration || track.duration);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, track.duration]);

  // --- Mode B: SpeechSynthesis fallback. Drive a timer for transcript
  //     highlighting since the browser API doesn't expose word-level timing. ---
  useEffect(() => {
    if (audioUrl) return; // Mode A drives currentTime directly
    if (isPlaying) {
      speechStartRef.current = performance.now();
      intervalRef.current = setInterval(() => {
        const elapsed = (performance.now() - speechStartRef.current) / 1000;
        const t = speechBaseTimeRef.current + elapsed;
        if (t >= track.duration) {
          setCurrentTime(track.duration);
          setIsPlaying(false);
        } else {
          setCurrentTime(t);
        }
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, audioUrl, track.duration]);

  // Cancel any in-flight speech if the widget unmounts or the track changes.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [track.id]);

  // Auto-scroll transcript to active segment
  useEffect(() => {
    if (!showTranscript || !transcriptRef.current) return;
    const activeEl = transcriptRef.current.querySelector(
      "[data-active='true']"
    );
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentTime, showTranscript]);

  const speechAvailable =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const speakFromTime = useCallback(
    (fromTime: number) => {
      if (!speechAvailable) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      // Build the utterance from the segment at fromTime onwards so the
      // audio you hear lines up with the highlighted transcript.
      const remaining = track.transcript
        .filter((s) => s.endTime > fromTime)
        .map((s) => s.text)
        .join(" ");
      const text = remaining || script || track.transcript.map((s) => s.text).join(" ");
      if (!text.trim()) return;

      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.onend = () => {
        if (speechRef.current === utter) {
          setIsPlaying(false);
          setCurrentTime(track.duration);
        }
      };
      speechRef.current = utter;
      speechBaseTimeRef.current = fromTime;
      speechStartRef.current = performance.now();
      synth.speak(utter);
    },
    [speechAvailable, track.transcript, track.duration, script],
  );

  const handlePlayPause = useCallback(() => {
    if (audioUrl && audioRef.current) {
      const el = audioRef.current;
      if (currentTime >= track.duration) {
        el.currentTime = 0;
        setCurrentTime(0);
      }
      if (el.paused) {
        void el.play();
        setIsPlaying(true);
      } else {
        el.pause();
        setIsPlaying(false);
      }
      return;
    }

    // SpeechSynthesis path
    if (!speechAvailable) return;
    const synth = window.speechSynthesis;
    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
      return;
    }
    if (currentTime >= track.duration) setCurrentTime(0);
    speakFromTime(currentTime >= track.duration ? 0 : currentTime);
    setIsPlaying(true);
  }, [audioUrl, currentTime, track.duration, isPlaying, speechAvailable, speakFromTime]);

  const seekTo = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(track.duration, t));
      setCurrentTime(clamped);
      if (audioUrl && audioRef.current) {
        audioRef.current.currentTime = clamped;
        return;
      }
      // SpeechSynthesis can't truly seek — restart from the new spot if playing.
      if (isPlaying && speechAvailable) {
        speakFromTime(clamped);
      }
    },
    [audioUrl, track.duration, isPlaying, speechAvailable, speakFromTime],
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seekTo(pct * track.duration);
    },
    [track.duration, seekTo],
  );

  const handlePrev = useCallback(() => {
    seekTo(currentTime - 15);
  }, [seekTo, currentTime]);

  const handleNext = useCallback(() => {
    seekTo(currentTime + 15);
  }, [seekTo, currentTime]);

  const progress = track.duration > 0 ? (currentTime / track.duration) * 100 : 0;

  const activeSegment = track.transcript.find(
    (s) => currentTime >= s.startTime && currentTime < s.endTime
  );

  return (
    <div className="w-full max-w-[640px] px-4">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          className="hidden"
        />
      )}
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl p-6
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary text-2xl flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            headphones
          </span>
          <h2 className="text-headline-sm font-semibold text-on-surface truncate">
            {track.title}
          </h2>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <div
            className="relative h-1 w-full rounded-full bg-surface-container-highest cursor-pointer group"
            onClick={handleSeek}
          >
            {/* Filled track */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-container) 100%)",
              }}
            />
            {/* Scrubber handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary
                         opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md"
              style={{ left: `${progress}%` }}
            />
          </div>
          {/* Time display */}
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Prev / Rewind */}
          <button
            onClick={handlePrev}
            className="w-10 h-10 rounded-full border border-outline-variant/15
                       flex items-center justify-center
                       text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface
                       transition-all duration-150"
          >
            <span className="material-symbols-outlined text-xl">replay_10</span>
          </button>

          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full
                       bg-primary-container/20 border border-primary/30
                       flex items-center justify-center
                       text-primary hover:bg-primary-container/30
                       transition-all duration-150"
          >
            <span
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          {/* Next / Forward */}
          <button
            onClick={handleNext}
            className="w-10 h-10 rounded-full border border-outline-variant/15
                       flex items-center justify-center
                       text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface
                       transition-all duration-150"
          >
            <span className="material-symbols-outlined text-xl">forward_10</span>
          </button>
        </div>

        {/* Transcript toggle + content */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="flex items-center gap-2 text-label-sm text-on-surface-variant tracking-[0.05em] uppercase
                       hover:text-on-surface transition-colors duration-150 self-start"
          >
            <span
              className="material-symbols-outlined text-base transition-transform duration-200"
              style={{
                transform: showTranscript ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            >
              expand_more
            </span>
            Transcript
          </button>

          {showTranscript && (
            <div
              ref={transcriptRef}
              className="max-h-[200px] overflow-y-auto rounded-xl bg-surface-container-low/50 border border-outline-variant/10 p-4
                         flex flex-col gap-2 scrollbar-thin"
            >
              {track.transcript.map((segment) => {
                const isActive = activeSegment?.id === segment.id;
                const isPast = currentTime >= segment.endTime;
                return (
                  <p
                    key={segment.id}
                    data-active={isActive}
                    className={`text-body-md leading-relaxed transition-colors duration-200 ${
                      isActive
                        ? "text-primary font-medium"
                        : isPast
                          ? "text-on-surface-variant/60"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {segment.text}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — voice badge + download */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-surface-container-high rounded-full px-3 py-1.5 border border-outline-variant/10">
            <span className="material-symbols-outlined text-primary text-base">
              mic
            </span>
            <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">
              {track.voice}
            </span>
          </div>
          {audioUrl ? (
            <a
              href={audioUrl}
              download={`${track.id || "sage-audio"}.mp3`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150 uppercase tracking-[0.05em]"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Download
            </a>
          ) : (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/10 text-on-surface-variant/50
                         uppercase tracking-[0.05em] cursor-not-allowed"
              title="Server-side TTS not configured — playback uses your browser's voice."
            >
              <span className="material-symbols-outlined text-sm">graphic_eq</span>
              Browser TTS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
