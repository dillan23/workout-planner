@AGENTS.md

# Feed Reader

## What this is
"Feed Reader" — a viral social app that roasts users based on their pasted social media posts. Think Spotify Wrapped but the algorithm has beef with you.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **Anthropic SDK** (`@anthropic-ai/sdk`) — claude-sonnet-4-6 for analysis
- **html2canvas** — available for screenshot/sharing features

## Project structure
```
src/app/
  page.tsx              — Landing page (paste input)
  results/page.tsx      — Results page (Wrapped-style cards)
  api/analyze/route.ts  — Server-side Claude API call
  globals.css           — Custom animations + glass/shimmer utilities
  layout.tsx            — Root layout
```

## Key flows
1. User pastes posts on `/` → clicks "Read My Feed"
2. POST to `/api/analyze` → Claude returns `AnalysisResult` JSON
3. Stored in `sessionStorage`, user redirected to `/results`
4. Results displayed as animated gradient cards
5. Copy-to-clipboard share text for viral loop

## Dev
```bash
cp .env.example .env.local
# add ANTHROPIC_API_KEY to .env.local
npm run dev
```

## Env vars
- `ANTHROPIC_API_KEY` — required, from console.anthropic.com
