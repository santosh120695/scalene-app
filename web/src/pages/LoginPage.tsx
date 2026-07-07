import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  Search,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useAuth } from "@/stores/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const loading = useAuth((s) => s.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      toast.error(errMessage(err, "Login failed"));
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-[38px] italic leading-tight text-ink-primary">
        Welcome back.
      </h1>
      <p className="mb-8 mt-1 text-[14px] text-ink-muted">
        Your brain missed you. Let's pick up where you left off.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          type="email"
          required
          autoFocus
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={loading} className="mt-2">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-ink-secondary">
        New here?{" "}
        <Link to="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

const FEATURES = [
  { icon: StickyNote, label: "Rich-text notes", desc: "Write, format, never lose a thought." },
  { icon: Link2, label: "Smart links", desc: "Paste a URL — we grab the preview." },
  { icon: FileText, label: "PDFs & docs", desc: "Read them inline, no downloads." },
  { icon: ImageIcon, label: "Images", desc: "Drop them in, arrange them your way." },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page lg:flex-row">
      {/* ── Brand / intro panel — stacks above the form on mobile ── */}
      <aside className="relative flex w-full flex-col justify-center gap-8 overflow-hidden bg-brand p-8 text-white sm:p-10 lg:w-1/2 lg:justify-between lg:gap-0 lg:p-12">
        {/* Soft decorative blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        {/* Logo + tagline */}
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Sparkles size={20} strokeWidth={1.75} />
            </div>
            <span className="font-display text-[20px] font-semibold tracking-tight">
              KnowledgeCanvas
            </span>
          </div>
          <h2 className="mt-6 max-w-md font-display text-[30px] italic leading-[1.15] sm:text-[36px] lg:mt-12 lg:text-[40px]">
            Your second brain, minus the chaos.
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/80 sm:text-[15px] lg:mt-4">
            PDFs, links, images, and notes — all in one calm, Pinterest-style
            board. Drag, drop, pin, search. No tabs harmed in the making.
          </p>
        </div>

        {/* Floating-cards illustration — hidden on the smallest screens */}
        <div className="hidden sm:block">
          <CanvasArt />
        </div>

        {/* Feature list */}
        <ul className="relative grid grid-cols-2 gap-x-6 gap-y-4 lg:gap-y-5">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <li key={label} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
                <Icon size={16} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[13.5px] font-medium leading-tight">{label}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-white/70">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer flourish */}
        <p className="relative flex items-center gap-2 text-[12.5px] text-white/70">
          <Search size={13} strokeWidth={1.75} />
          Full-text search across everything you've ever saved.
        </p>
      </aside>

      {/* ── Form panel ── */}
      <main className="flex w-full flex-1 items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

// Hand-drawn SVG: tilted "knowledge cards" floating on a dotted canvas,
// loosely connected like a mind-map. Pure decoration — aria-hidden.
function CanvasArt() {
  return (
    <div className="relative my-2 flex justify-center">
      <svg
        viewBox="0 0 380 200"
        className="h-auto w-full max-w-[420px] drop-shadow-xl"
        fill="none"
        aria-hidden="true"
      >
        {/* dotted canvas grid */}
        <defs>
          <pattern id="kc-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="rgba(255,255,255,0.18)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="380" height="200" fill="url(#kc-dots)" rx="14" />

        {/* connector lines (mind-map threads) */}
        <g stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="3 4">
          <path d="M120 78 C 160 90, 175 70, 205 64" />
          <path d="M150 120 C 185 118, 210 118, 232 110" />
          <path d="M250 80 C 268 95, 280 100, 300 96" />
        </g>

        {/* note card (amber accent) */}
        <g transform="rotate(-7 80 70)">
          <rect x="38" y="40" width="86" height="64" rx="9" fill="#ffffff" />
          <rect x="38" y="40" width="5" height="64" rx="2.5" fill="#D97706" />
          <rect x="54" y="54" width="56" height="6" rx="3" fill="#1a1a18" opacity="0.8" />
          <rect x="54" y="68" width="48" height="4" rx="2" fill="#9CA8A3" />
          <rect x="54" y="78" width="52" height="4" rx="2" fill="#9CA8A3" />
          <rect x="54" y="88" width="34" height="4" rx="2" fill="#9CA8A3" />
        </g>

        {/* image card (violet accent) */}
        <g transform="rotate(6 250 60)">
          <rect x="208" y="30" width="84" height="66" rx="9" fill="#ffffff" />
          <rect x="208" y="30" width="5" height="66" rx="2.5" fill="#7C3AED" />
          <rect x="220" y="42" width="68" height="34" rx="5" fill="#7C3AED" opacity="0.18" />
          <circle cx="234" cy="56" r="5" fill="#7C3AED" opacity="0.55" />
          <path d="M222 74 L238 60 L252 74 L268 54 L286 74 Z" fill="#7C3AED" opacity="0.4" />
          <rect x="220" y="84" width="44" height="4" rx="2" fill="#9CA8A3" />
        </g>

        {/* link card (blue accent) */}
        <g transform="rotate(-3 150 140)">
          <rect x="112" y="112" width="90" height="58" rx="9" fill="#ffffff" />
          <rect x="112" y="112" width="5" height="58" rx="2.5" fill="#3B82F6" />
          <circle cx="132" cy="132" r="9" fill="none" stroke="#3B82F6" strokeWidth="2.4" />
          <path d="M129 132 h6 M132 129 v6" stroke="#3B82F6" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="150" y="124" width="44" height="5" rx="2.5" fill="#1a1a18" opacity="0.8" />
          <rect x="128" y="150" width="62" height="4" rx="2" fill="#9CA8A3" />
        </g>

        {/* pdf card (terracotta accent) */}
        <g transform="rotate(8 300 130)">
          <rect x="270" y="104" width="78" height="58" rx="9" fill="#ffffff" />
          <rect x="270" y="104" width="5" height="58" rx="2.5" fill="#C25B3F" />
          <rect x="284" y="118" width="22" height="28" rx="3" fill="#C25B3F" opacity="0.16" />
          <path d="M289 126 h12 M289 132 h12 M289 138 h8" stroke="#C25B3F" strokeWidth="2" strokeLinecap="round" />
          <rect x="314" y="120" width="26" height="5" rx="2.5" fill="#1a1a18" opacity="0.7" />
          <rect x="314" y="132" width="20" height="4" rx="2" fill="#9CA8A3" />
        </g>

        {/* sparkle accents */}
        <g fill="#ffffff">
          <path d="M196 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" opacity="0.85" />
          <circle cx="60" cy="120" r="2" opacity="0.6" />
          <circle cx="332" cy="60" r="2.5" opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}
