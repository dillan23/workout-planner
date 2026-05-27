"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisResult } from "../api/analyze/route";

const GRADIENT_CONFIGS = [
  { from: "#a855f7", to: "#ec4899" },
  { from: "#ec4899", to: "#f97316" },
  { from: "#3b82f6", to: "#a855f7" },
  { from: "#10b981", to: "#3b82f6" },
  { from: "#f97316", to: "#eab308" },
  { from: "#ef4444", to: "#ec4899" },
  { from: "#6366f1", to: "#8b5cf6" },
];

// Total animation time: last card delay (1.0s) + reveal duration (0.6s) + buffer
const RECORD_DURATION_MS = 4200;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type RecordingState = "idle" | "requesting" | "recording" | "done" | "error";

export default function ResultsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  // Screen recording state
  const [replayKey, setReplayKey] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  useEffect(() => {
    const stored = sessionStorage.getItem("feedAnalysis");
    if (!stored) {
      router.push("/");
      return;
    }
    try {
      setResult(JSON.parse(stored));
    } catch {
      router.push("/");
    }
  }, [router]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [recordedUrl]);

  async function handleRecord() {
    setRecordedUrl(null);
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
      // User cancelled the dialog
      setRecordingState("idle");
      return;
    }

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
      setRecordedUrl(url);
      setRecordingState("done");
      stream.getTracks().forEach((t) => t.stop());
      if (countdownRef.current) clearInterval(countdownRef.current);
    };

    // If user stops sharing tab manually, clean up
    stream.getVideoTracks()[0].onended = () => {
      if (recorder.state === "recording") recorder.stop();
    };

    recorder.start(100);
    setRecordingState("recording");

    // Start countdown
    const totalSeconds = Math.ceil(RECORD_DURATION_MS / 1000);
    setCountdown(totalSeconds);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    // Scroll to top then replay animation
    window.scrollTo({ top: 0, behavior: "instant" });
    await sleep(300);
    setReplayKey((k) => k + 1);

    // Auto-stop after all cards have animated in
    await sleep(RECORD_DURATION_MS);
    if (recorder.state === "recording") recorder.stop();
  }

  function handleStopEarly() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function handleCopyShareText() {
    if (!result) return;
    const text = `${result.shareText}\n\nFind out what YOUR feed says about you → feedreader.app`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setShareMsg("Copied! Go paste it everywhere.");
    setTimeout(() => {
      setCopied(false);
      setShareMsg("");
    }, 3000);
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

  const cards = [
    {
      id: "archetype",
      gradient: GRADIENT_CONFIGS[0],
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full gap-4">
          <div className="text-5xl">🪞</div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
            Your Posting Archetype
          </div>
          <div className="text-4xl md:text-5xl font-black leading-tight text-white">
            {result.archetype}
          </div>
          <div className="text-white/70 text-base max-w-xs">{result.archetypeSubtitle}</div>
        </div>
      ),
    },
    {
      id: "roast1",
      gradient: GRADIENT_CONFIGS[1],
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
      gradient: GRADIENT_CONFIGS[2],
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
      gradient: GRADIENT_CONFIGS[4],
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
      gradient: GRADIENT_CONFIGS[5],
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
      gradient: GRADIENT_CONFIGS[6],
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
      gradient: GRADIENT_CONFIGS[3],
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
      gradient: { from: "#a855f7", to: "#3b82f6" },
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
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-float" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-float"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Recording indicator — fixed overlay so it stays visible while scrolled */}
      {recordingState === "recording" && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/80 backdrop-blur border border-red-500/40 rounded-full px-5 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-white">
            Recording {countdown > 0 ? `· ${countdown}s` : ""}
          </span>
          <button
            onClick={handleStopEarly}
            className="text-xs text-white/50 hover:text-white transition-colors border border-white/20 rounded-full px-2 py-0.5 ml-1"
          >
            stop
          </button>
        </div>
      )}

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

        {/* Cards Grid — key forces remount to replay animations */}
        <div key={replayKey} className="grid gap-4">
          {cards.map((card, i) => (
            <ResultCard
              key={`${replayKey}-${card.id}`}
              gradient={card.gradient}
              delay={i}
            >
              {card.content}
            </ResultCard>
          ))}
        </div>

        {/* Share Section */}
        <div className="mt-10 text-center animate-reveal card-delay-7">
          <p className="text-white/50 text-sm mb-4">
            Share your results — make your friends get roasted too
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            {/* Record button */}
            <button
              onClick={handleRecord}
              disabled={recordingState === "recording" || recordingState === "requesting"}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background:
                  recordingState === "done"
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : "linear-gradient(135deg, #ef4444, #ec4899)",
              }}
            >
              {recordingState === "requesting" && "⏳ Opening..."}
              {recordingState === "recording" && (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Recording...
                </>
              )}
              {recordingState === "done" && "✓ Recorded!"}
              {recordingState === "idle" && "🎬 Record my reveal"}
              {recordingState === "error" && "⚠️ Try again"}
            </button>

            {/* Download — appears after recording */}
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

          {shareMsg && (
            <p className="text-green-400 text-sm mt-3 animate-slide-up">{shareMsg}</p>
          )}

          {/* Recording tip */}
          {recordingState === "idle" && !recordedUrl && (
            <p className="text-white/25 text-xs mt-3">
              Records the animated reveal — great for Reels &amp; TikTok
            </p>
          )}
          {recordedUrl && (
            <p className="text-white/35 text-xs mt-3">
              Download the .webm then import to Reels, TikTok, or Stories
            </p>
          )}

          {/* Shareable caption card */}
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
        </div>

        <p className="text-center text-xs text-white/15 mt-8">
          Feed Reader · Not responsible for existential crises
        </p>
      </div>
    </main>
  );
}

function ResultCard({
  gradient,
  delay,
  children,
}: {
  gradient: { from: string; to: string };
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`animate-reveal card-delay-${delay + 1} rounded-2xl p-7 min-h-[160px] relative overflow-hidden`}
      style={{
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
