import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { posts } = await request.json();

    if (!posts || typeof posts !== "string" || posts.trim().length < 10) {
      return NextResponse.json(
        { error: "Please paste at least a few posts to analyze." },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a brutally funny but never mean AI that analyzes social media posts and roasts the poster's personality. Be specific, clever, and absurd. Never be offensive about identity, only about behavior and posting habits.

Here are someone's social media posts:
---
${posts.slice(0, 3000)}
---

Respond ONLY with a valid JSON object (no markdown, no code blocks) matching this exact structure:
{
  "archetype": "A dramatic 2-4 word title for their posting persona (e.g. 'Chronically Online Oracle', 'Chaotic Neutral Foodie', 'Main Character Aspirant')",
  "archetypeSubtitle": "A single funny sentence describing this archetype",
  "roasts": [
    "Roast #1 — specific, funny observation about their posting habits (1 sentence)",
    "Roast #2 — different angle, equally specific",
    "Roast #3 — the gut-punch one, save the best for last"
  ],
  "fakeStat": "A made-up but plausible percentage stat about their behavior, e.g. '94% of your replies go unread for exactly 3 minutes before you check again'",
  "deepestFear": "Complete this: 'Your feed suggests your deepest fear is...' — make it funny and oddly specific",
  "mostLikelyTo": "Complete this: 'Most likely to...' — funny prediction about something they'll definitely do this week",
  "energyOf": "Their energy is best described as '___' — use a specific, funny, unexpected cultural reference",
  "shareText": "A funny 1-sentence caption they could use when sharing their results on social media"
}`,
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const result: AnalysisResult = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned unexpected format. Please try again." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
