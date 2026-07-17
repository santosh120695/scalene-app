// Detects link URLs that should be shown as a live embed (an iframe) rather than
// a scraped reader view. Currently YouTube and Instagram. Detection is done from
// the URL alone, so it also works for links saved before embedding existed.

export type EmbedProvider = "youtube" | "instagram";

export interface EmbedInfo {
  provider: EmbedProvider;
  /** iframe src for the full embed (detail view). */
  embedUrl: string;
  /** Lightweight preview image for the grid card, when derivable (YouTube). */
  thumbnailUrl?: string;
  /** CSS aspect-ratio for the embed container. */
  aspect: string;
}

// Pulls the 11-char video id out of the various YouTube URL shapes:
// youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID, /live/ID.
function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    if (m) return m[1];
  }
  return null;
}

// Pulls the shortcode out of an Instagram post/reel/tv URL.
function instagramCode(u: URL): { code: string; kind: string } | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "instagram.com" && host !== "instagr.am") return null;
  const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([^/?#]+)/);
  if (!m) return null;
  // Instagram's /embed endpoint lives under /p and /reel; normalise "reels" → reel.
  const kind = m[1] === "reels" ? "reel" : m[1];
  return { code: m[2], kind };
}

export function detectEmbed(rawUrl: string): EmbedInfo | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }

  const yt = youtubeId(u);
  if (yt) {
    const isShort = /\/shorts\//.test(u.pathname);
    return {
      provider: "youtube",
      // Privacy-enhanced host (no cookies until playback).
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
      aspect: isShort ? "9 / 16" : "16 / 9",
    };
  }

  const ig = instagramCode(u);
  if (ig) {
    return {
      provider: "instagram",
      embedUrl: `https://www.instagram.com/${ig.kind}/${ig.code}/embed`,
      aspect: "4 / 5",
    };
  }

  return null;
}
