"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDER = `paste anything here — tweets, instagram captions, tiktok comments, discord messages, facebook rants, reddit posts, whatever you've been posting lately...

the more you paste, the more accurate (and devastating) the roast`;

const EXAMPLE_POSTS = `just spent 40 minutes making my bed look aesthetic for a story that got 12 views
obsessed with this new coffee shop but I'm too scared to become a regular
i said "we should hang out soon" to like 4 people this week and meant it 0 times
why does everyone on twitter sound like they're writing their oscar acceptance speech
ok but the problem with being a "morning person" is it's morning
can't stop thinking about something embarrassing I did in 2014
just declined a zoom call to attend by phone instead and I'm not even sorry`;

export default function HomePage() {
  const [posts, setPosts] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleAnalyze() {
    if (posts.trim().length < 20) {
      setError("Give us a little more to work with! Paste at least a few posts.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("feedAnalysis", JSON.stringify(data));
      router.push("/results");
    } catch {
      setError("Network error. Check your connection and try again.");
      setLoading(false);
    }
  }

  function useExample() {
    setPosts(EXAMPLE_POSTS);
    setError("");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float" />
        <div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="text-6xl mb-4">🔮</div>
          <h1 className="text-5xl md:text-6xl font-black mb-4 leading-tight">
            <span className="animate-shimmer">Feed Reader</span>
          </h1>
          <p className="text-xl text-white/60 max-w-md mx-auto leading-relaxed">
            Paste your posts. Let the algorithm tell you who you really are.
            <span className="text-white/40"> (It&apos;s not going to be flattering.)</span>
          </p>
        </div>

        {/* Input Card */}
        <div
          className="glass rounded-2xl p-6 mb-4 animate-slide-up"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white/50 uppercase tracking-widest">
              Your Posts
            </label>
            <button
              onClick={useExample}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/30 hover:border-purple-400/50 px-3 py-1 rounded-full"
            >
              use example ✨
            </button>
          </div>

          <textarea
            value={posts}
            onChange={(e) => {
              setPosts(e.target.value);
              setError("");
            }}
            placeholder={PLACEHOLDER}
            rows={10}
            className="w-full bg-transparent text-white/80 placeholder:text-white/20 resize-none outline-none text-sm leading-relaxed font-mono"
          />

          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-white/25">
              {posts.length > 0
                ? `${posts.split(/\s+/).filter(Boolean).length} words — `
                : ""}
              works with tweets, captions, comments, anything
            </span>
            {posts.length > 0 && (
              <button
                onClick={() => setPosts("")}
                className="text-xs text-white/25 hover:text-white/50 transition-colors"
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-pink-400 text-sm text-center mb-4 animate-slide-up">
            ⚠️ {error}
          </p>
        )}

        {/* CTA Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full py-5 px-8 rounded-2xl font-bold text-lg relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] animate-pulse-glow"
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%)",
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <LoadingSpinner />
                Reading your feed...
              </>
            ) : (
              <>
                <span>🔍</span>
                Read My Feed
              </>
            )}
          </span>
        </button>

        {/* Disclaimer */}
        <p className="text-center text-xs text-white/20 mt-6">
          Your posts are analyzed once and never stored. This is for comedy purposes only.
          <br />
          If it&apos;s too accurate, that&apos;s on you.
        </p>

        {/* Social proof vibes */}
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-white/25">
          <span>✓ Zero sign-up</span>
          <span>✓ Any platform</span>
          <span>✓ Ruthlessly accurate</span>
        </div>
      </div>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
