import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feed Reader — Your Feed Knows Too Much",
  description:
    "Paste your social media posts. Get roasted. Share the results. It's like Spotify Wrapped but the algorithm has beef with you.",
  openGraph: {
    title: "Feed Reader — Your Feed Knows Too Much",
    description:
      "Find out what your social media posts say about you. (It's not good.)",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-[#0a0a0f] text-white">{children}</body>
    </html>
  );
}
