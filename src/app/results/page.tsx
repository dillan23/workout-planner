"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult } from "@/types";

const GRADIENT_CONFIGS = [
  { from: "#a855f7", to: "#ec4899" },
  { from: "#ec4899", to: "#f97316" },
  { from: "#3b82f6", to: "#a855f7" },
  { from: "#10b981", to: "#3b82f6" },
  { from: "#f97316", to: "#eab308" },
  { from: "#ef4444", to: "#ec4899" },
  { from: "#6366f1", to: "#8b5cf6" },
  { from: "#a855f7", to: "#3b82f6" },
];

const CARD_STAGGER_S = 0.45;
const CARD_REVEAL_S = 0.6;
const CARD_COUNT = 8;
// Last card delay + reveal animation + buffer
const RECORD_DURATION_MS = Math.ceil(
  ((CARD_COUNT - 1) * CARD_STAGGER_S + CARD_REVEAL_S + 0.8) * 1000
);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type RecordingState = "idle" | "requesting" | "recording" | "done";

export default function ResultsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const router = useRouter();

  // sessionStorage is client-only; read after hydration to avoid SSR mismatch.
  useEffect(() => {
    const stored = sessionStorage.getItem("feedAnalysis");
    if (!stored) {
      router.push("/");
      return;
    }
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(JSON.parse(stored));
    } catch {
      router.push("/");
    }
  }, [router]);

  // Cleanup on unmount: revoke blob URL, stop stream
  useEffect(() => {
    return () => {
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function handleRecord() {
    // Revoke previous recording's blob URL before starting a new one
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
      setRecordedUrl(null);
    }

    setRecordingState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-expect-error — Chrome-only hint to pre-select current tab
        preferCurrentTab: true,
      });
    } catch {
      setRecordingState("idle");
      return;
    }
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      recordedUrlRef.current = url;
      setRecordedUrl(url);
      setRecordingState("done");
      cleanupStream();
    };

    // If user ends share via browser UI, stop gracefully
    stream.getVideoTracks()[0].onended = () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      } else {
        cleanupStream();
        setRecordingState("idle");
      }
    };

    recorder.start();
    setRecordingState("recording");

    // Brief delay so the UI fully hides before the animation replays
    window.scrollTo({ top: 0, behavior: "instant" });
    await sleep(200);
    setReplayKey((k) => k + 1);

    await sleep(RECORD_DURATION_MS);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function handleCopyShareText() {
    if (!result) return;
    const text = `${result.shareText}\n\nFind out what YOUR feed says about you → feedreader.app`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleRedo() {
    sessionStorage.removeItem("feedAnalysis");
    router.push("/");
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40 text-lg">Loading your results...</div>
      </div>
    );
  }

  const isRecording = recordingState === "recording";

  const cards = [
    {
      id: "archetype",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">🪞</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Your Posting Archetype
          </div>
          <div className="text-4xl md:text-5xl font-black leading-tight text-white">
            {result.archetype}
          </div>
          <div className="text-white/70 text-base max-w-xs">
            {result.archetypeSubtitle}
          </div>
        </div>
      ),
    },
    {
      id: "roast1",
      content: (
        <div className="flex flex-col justify-center h-full gap-4">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Finding #1
          </div>
          <div className="text-2xl md:text-3xl font-bold leading-snug text-white">
            &ldquo;{result.roasts[0]}&rdquo;
          </div>
        </div>
      ),
    },
    {
      id: "stat",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">📊</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            The Data
          </div>
          <div className="text-xl md:text-2xl font-bold text-white leading-snug">
            {result.fakeStat}
          </div>
          <div className="text-xs text-white/30 italic">*probably accurate</div>
        </div>
      ),
    },
    {
      id: "roast2",
      content: (
        <div className="flex flex-col justify-center h-full gap-4">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Finding #2
          </div>
          <div className="text-2xl md:text-3xl font-bold leading-snug text-white">
            &ldquo;{result.roasts[1]}&rdquo;
          </div>
        </div>
      ),
    },
    {
      id: "deepfear",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">😰</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Your Deepest Fear
          </div>
          <div className="text-xl md:text-2xl font-bold text-white leading-snug">
            {result.deepestFear}
          </div>
        </div>
      ),
    },
    {
      id: "energy",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">⚡</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Your Energy Is
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white leading-snug">
            {result.energyOf}
          </div>
        </div>
      ),
    },
    {
      id: "roast3",
      content: (
        <div className="flex flex-col justify-center h-full gap-4">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Final Verdict
          </div>
          <div className="text-2xl md:text-3xl font-bold leading-snug text-white">
            &ldquo;{result.roasts[2]}&rdquo;
          </div>
          <div className="text-xs text-white/40 mt-2">— the algorithm, probably</div>
        </div>
      ),
    },
    {
      id: "mostlikely",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">🎯</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            This Week You Will
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white leading-snug">
            {result.mostLikelyTo}
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="min-h-screen px-4 py-12 relative overflow-hidden">
      {/* Background blobs (kept in recording — they're part of the aesthetic) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-float" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-float"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-slide-up">
          <div className="text-4xl mb-3">🔮</div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Your Feed Has Spoken
          </h1>
          <p className="text-white/50 text-sm">
            Here&apos;s what the algorithm thinks it knows about you
          </p>
        </div>

        {/* Cards — key forces remount so animations replay */}
        <div key={replayKey} className="grid gap-4">
          {cards.map((card, i) => (
            <ResultCard key={card.id} gradient={GRADIENT_CONFIGS[i]} delayS={i * CARD_STAGGER_S}>
              {card.content}
            </ResultCard>
          ))}
        </div>

        {/* Watermark — visible in recording, anchors brand */}
        <div className="text-center mt-8 mb-4">
          <p className="text-white/30 text-xs tracking-[0.3em] uppercase">
            feedreader.app
          </p>
        </div>

        {/* Share Section — HIDDEN during recording so it's not in the video */}
        {!isRecording && (
          <div className="mt-6 text-center animate-slide-up">
            <p className="text-white/50 text-sm mb-4">
              Share your results — make your friends get roasted too
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              <button
                onClick={handleRecord}
                disabled={recordingState === "requesting"}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background:
                    recordingState === "done"
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : "linear-gradient(135deg, #ef4444, #ec4899)",
                }}
              >
                {recordingState === "requesting" && "⏳ Opening picker..."}
                {recordingState === "done" && "✓ Recorded — record again?"}
                {recordingState === "idle" && "🎬 Record reveal video"}
              </button>

              {recordedUrl && (
                <a
                  href={recordedUrl}
                  download="my-feed-roast.webm"
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white/15 hover:bg-white/20 transition-all duration-200 hover:scale-105 active:scale-95 border border-white/20"
                >
                  ⬇️ Download video
                </a>
              )}

              <button
                onClick={handleCopyShareText}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: copied
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "linear-gradient(135deg, #a855f7, #ec4899)",
                }}
              >
                {copied ? "✓ Copied!" : "📋 Copy caption"}
              </button>

              <button
                onClick={handleRedo}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 transition-all duration-200 hover:scale-105 active:scale-95 border border-white/10"
              >
                🔄 New feed
              </button>
            </div>

            {recordingState === "idle" && !recordedUrl && (
              <p className="text-white/25 text-xs mt-3">
                Records a ~{Math.round(RECORD_DURATION_MS / 1000)}s clip of the reveal — perfect for Reels &amp; TikTok
              </p>
            )}
            {recordingState === "done" && (
              <p className="text-green-400/70 text-xs mt-3">
                Done! Download the .webm and import to your favorite app.
              </p>
            )}

            <div className="mt-8 glass rounded-2xl p-5 text-left">
              <div className="text-xs text-white/40 uppercase tracking-widest mb-2 font-semibold">
                Your shareable caption
              </div>
              <p className="text-white/80 italic text-sm leading-relaxed">
                &ldquo;{result.shareText}&rdquo;
              </p>
              <p className="text-white/30 text-xs mt-2">
                feedreader.app — Your feed knows too much
              </p>
            </div>

            <p className="text-center text-xs text-white/15 mt-8">
              Feed Reader · Not responsible for existential crises
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function ResultCard({
  gradient,
  delayS,
  children,
}: {
  gradient: { from: string; to: string };
  delayS: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="animate-reveal rounded-2xl p-7 min-h-[160px] relative overflow-hidden"
      style={{
        animationDelay: `${delayS}s`,
        background: `linear-gradient(135deg, ${gradient.from}22 0%, ${gradient.to}22 100%)`,
        borderColor: `${gradient.from}40`,
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
      <div
        className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-30"
        style={{
          background: `radial-gradient(circle, ${gradient.to}, transparent)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
