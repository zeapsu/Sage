"use client";

import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";
import AudioView from "@/components/AudioView";
import ChatWidget from "@/components/ChatWidget";
import FlashcardsView from "@/components/FlashcardsView";
import HistoryPanel from "@/components/HistoryPanel";
import KnowledgeBaseWidget from "@/components/KnowledgeBaseWidget";
import ProfileSetup from "@/components/ProfileSetup";
import QuizView from "@/components/QuizView";
import ReportView from "@/components/ReportView";
import SettingsPanel from "@/components/SettingsPanel";
import TomeSelector from "@/components/TomeSelector";
import { detectView } from "@/lib/command-routing";
import type { RoutedView } from "@/lib/command-routing";
import { readStoredUserProfile, USER_PROFILE_STORAGE_KEY } from "@/lib/user-profile";
import type { SageUserProfile } from "@/lib/user-profile";

type ViewState = "idle" | "dashboard" | "chat" | "settings" | RoutedView;

const generatedViews = new Set<ViewState>(["quiz", "flashcards", "audio", "report"]);

const capabilities: Array<{ label: string; icon: string; prompt?: string; view: ViewState }> = [
  { label: "Sources", icon: "▤", view: "knowledge" },
  { label: "Report", icon: "✎", prompt: "Generate a report for this Tome", view: "report" },
  { label: "Quiz", icon: "?", prompt: "Create a quiz for this Tome", view: "quiz" },
  { label: "Flashcards", icon: "◇", prompt: "Create flashcards for this Tome", view: "flashcards" },
  { label: "Audio", icon: "♪", prompt: "Generate an audio review for this Tome", view: "audio" },
  { label: "Chat", icon: "⌁", view: "chat" },
];

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [generationPrompt, setGenerationPrompt] = useState<string>("");
  const [chatQuery, setChatQuery] = useState<string>("");
  const [profile, setProfile] = useState<SageUserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const storedProfile = readStoredUserProfile(window.localStorage);
    if (storedProfile) {
      setProfile(storedProfile);
    }
    setProfileLoaded(true);
  }, []);

  const saveProfile = (nextProfile: SageUserProfile) => {
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    setProfile(nextProfile);
  };

  const completeSetup = (nextProfile: SageUserProfile) => {
    saveProfile(nextProfile);
    setViewState("idle");
  };

  const handleSubmit = (text: string) => {
    const route = detectView(text);
    if (route) {
      if (generatedViews.has(route)) {
        setGenerationPrompt(text);
      }
      setViewState(route);
    } else {
      setChatQuery(text);
      setViewState("chat");
    }
  };

  /** Called from inside ChatWidget. Returns true if it routed away from chat. */
  const handleChatCommand = (text: string): boolean => {
    const route = detectView(text);
    if (!route) return false;
    if (generatedViews.has(route)) {
      setGenerationPrompt(text);
    }
    setViewState(route);
    return true;
  };

  const handleBack = () => {
    setViewState("idle");
  };

  const cardVariants: Variants = {
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.97 },
  };

  const cardTransition: Transition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] };

  if (!profileLoaded) {
    return <main className="min-h-screen w-full bg-[#080807]" />;
  }

  if (!profile) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-[#080807] text-[#ede6d5]">
        <div className="pointer-events-none absolute inset-x-0 top-[-12rem] h-[36rem] bg-[radial-gradient(circle_at_center,rgba(242,168,93,0.12),transparent_62%)]" />
        <div className="pointer-events-none absolute right-[-12rem] top-16 h-[32rem] w-[32rem] rounded-full bg-[rgba(171,199,173,0.07)] blur-[110px]" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-5 py-8 sm:px-8 lg:px-10">
          <ProfileSetup onComplete={completeSetup} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#080807] text-[#ede6d5]">
      <div className="pointer-events-none absolute inset-x-0 top-[-12rem] h-[36rem] bg-[radial-gradient(circle_at_center,rgba(242,168,93,0.12),transparent_62%)]" />
      <div className="pointer-events-none absolute right-[-12rem] top-16 h-[32rem] w-[32rem] rounded-full bg-[rgba(171,199,173,0.07)] blur-[110px]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-5 py-8 sm:px-8 lg:px-10">
        <TopBar viewState={viewState} profile={profile} onNavigate={setViewState} />

        <AnimatePresence mode="wait">
          {viewState === "idle" && (
            <motion.div key="home" {...cardVariants} transition={cardTransition} className="w-full flex-1">
              <TomeHome profile={profile} onSubmit={handleSubmit} onNavigate={setViewState} />
            </motion.div>
          )}

          {viewState === "dashboard" && (
            <motion.div key="dashboard" {...cardVariants} transition={cardTransition} className="w-full flex-1">
              <TomeDashboard onNavigate={setViewState} />
            </motion.div>
          )}

          {viewState === "quiz" && (
            <FocusShell keyName="quiz" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <QuizView prompt={generationPrompt} />
            </FocusShell>
          )}

          {viewState === "flashcards" && (
            <FocusShell keyName="flashcards" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <FlashcardsView prompt={generationPrompt} />
            </FocusShell>
          )}

          {viewState === "audio" && (
            <FocusShell keyName="audio" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <AudioView prompt={generationPrompt} />
            </FocusShell>
          )}

          {viewState === "report" && (
            <FocusShell keyName="report" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <ReportView prompt={generationPrompt} />
            </FocusShell>
          )}

          {viewState === "history" && (
            <FocusShell keyName="history" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <HistoryPanel />
            </FocusShell>
          )}

          {viewState === "tomes" && (
            <FocusShell keyName="tomes" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <TomeSelector />
            </FocusShell>
          )}

          {viewState === "knowledge" && (
            <FocusShell keyName="knowledge" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <KnowledgeBaseWidget />
            </FocusShell>
          )}

          {viewState === "chat" && (
            <FocusShell keyName="chat" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <ChatWidget initialQuery={chatQuery} onCommand={handleChatCommand} />
            </FocusShell>
          )}

          {viewState === "settings" && (
            <FocusShell keyName="settings" variants={cardVariants} transition={cardTransition} onBack={handleBack}>
              <SettingsPanel profile={profile} onSave={saveProfile} onBack={handleBack} />
            </FocusShell>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function TopBar({
  viewState,
  profile,
  onNavigate,
}: {
  viewState: ViewState;
  profile: SageUserProfile;
  onNavigate: (view: ViewState) => void;
}) {
  return (
    <header className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-center sm:justify-between">
      <button
        onClick={() => onNavigate("idle")}
        className="flex w-fit items-center gap-3 text-left text-[0.72rem] uppercase tracking-[0.16em] text-[#9f9788] transition-colors hover:text-[#ede6d5]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[#f2a85d]/20 bg-[#f2a85d]/10 text-[#f2a85d]">
          ✦
        </span>
        <span>Sage · {profile.name}</span>
      </button>

      <nav className="flex w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#11110f]/70 p-1 backdrop-blur sm:w-fit">
        <NavPill active={viewState === "idle"} onClick={() => onNavigate("idle")}>Home</NavPill>
        <NavPill active={viewState === "dashboard"} onClick={() => onNavigate("dashboard")}>Dashboard</NavPill>
        <NavPill active={viewState === "history"} onClick={() => onNavigate("history")}>History</NavPill>
        <NavPill active={viewState === "tomes"} onClick={() => onNavigate("tomes")}>Tomes</NavPill>
        <NavPill active={viewState === "settings"} onClick={() => onNavigate("settings")}>Settings</NavPill>
      </nav>
    </header>
  );
}

function TomeHome({
  profile,
  onSubmit,
  onNavigate,
}: {
  profile: SageUserProfile;
  onSubmit: (text: string) => void;
  onNavigate: (view: ViewState) => void;
}) {
  const [prompt, setPrompt] = useState("");

  const submitPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setPrompt("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt();
    }
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center pb-16 pt-4">
      <div className="w-full max-w-[820px] text-center">
        <div className="mb-5 inline-flex items-center gap-2 text-sm text-[#9f9788]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d8b978] shadow-[0_0_22px_rgba(216,185,120,0.44)]" />
          <span>Tome Home</span>
        </div>

        <h1 className="font-serif text-[clamp(2.8rem,7vw,5.4rem)] font-normal leading-[0.96] tracking-[-0.05em]">
          Welcome back, {profile.name}.
        </h1>
        <p className="mx-auto mt-5 max-w-[650px] text-base leading-7 text-[#9f9788]">
          What should this Tome help with next? Ask questions, generate study materials, manage sources, or jump into focused work.
        </p>

        <button
          onClick={() => onNavigate("tomes")}
          className="mt-7 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-white/[0.055] px-4 py-2.5 text-sm text-[#ede6d5] transition-colors hover:border-[#f2a85d]/30 hover:bg-[#f2a85d]/10"
        >
          <span className="text-[#9f9788]">Preview Tome</span>
          <strong className="font-medium">Sample Tome Home</strong>
          <span className="text-[#9f9788]">placeholder status</span>
        </button>

        <form
          onSubmit={handleSubmit}
          className="mt-5 overflow-hidden rounded-[30px] border border-white/15 bg-gradient-to-b from-[#1f1d18]/95 to-[#131210]/95 text-left shadow-[0_30px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.045)]"
        >
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sage about this Tome, or type / for Tome skills"
            className="min-h-[156px] w-full resize-none border-0 bg-transparent px-6 py-6 pb-4 text-lg leading-7 text-[#ede6d5] outline-none placeholder:text-[#70695e] sm:px-8"
            spellCheck={false}
          />
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm text-[#6f675b] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <button
              type="button"
              onClick={() => onNavigate("knowledge")}
              className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-[#9f9788] transition-colors hover:border-[#abc7ad]/30 hover:text-[#ede6d5]"
            >
              ＋ Add source
            </button>
            <div className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-[#9f9788]">
              Local / Cloud Adaptive <span aria-hidden="true">│</span> 🎙
            </div>
          </div>
        </form>

        <div className="mx-auto mt-5 flex max-w-[740px] flex-wrap justify-center gap-2.5" aria-label="Tome capabilities">
          {capabilities.map((capability) => (
            <CapabilityButton key={capability.label} {...capability} onSubmit={onSubmit} onNavigate={onNavigate} />
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-[660px] text-sm leading-6 text-[#6f675b]">
          Generation skills use your current knowledge base and configured provider. Add sources first for grounded output;
          audio falls back to browser narration when server-side speech is unavailable.
        </p>

        <button
          onClick={() => onNavigate("dashboard")}
          className="mt-6 rounded-full px-3 py-2 text-sm text-[#6f675b] transition-colors hover:text-[#ede6d5]"
        >
          View expanded Tome dashboard →
        </button>
      </div>
    </section>
  );
}

function TomeDashboard({ onNavigate }: { onNavigate: (view: ViewState) => void }) {
  return (
    <section className="grid gap-5 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <article className="rounded-[26px] border border-white/10 bg-[#11110f]/75 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-[#9f9788]">Tome overview</p>
            <h2 className="mt-1 text-2xl font-medium tracking-[-0.03em] text-[#ede6d5]">Expanded Tome Dashboard</h2>
          </div>
          <button
            onClick={() => onNavigate("idle")}
            className="w-fit rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#9f9788] transition-colors hover:border-[#f2a85d]/30 hover:text-[#ede6d5]"
          >
            Back to Tome Home
          </button>
        </div>
        <p className="mt-3 max-w-2xl leading-7 text-[#9f9788]">
          Review sources, generated artifacts, freshness, and recent work for this Tome.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d8b978]">
          Preview statuses shown until Tome selection and generated artifact state are wired.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <DashboardCard title="Sources" detail="Manage uploaded notes and references" status="Live" tone="good" onClick={() => onNavigate("knowledge")} />
          <DashboardCard title="Report" detail="Generate or revisit a study guide" status="Live" tone="good" onClick={() => onNavigate("report")} />
          <DashboardCard title="Quiz" detail="Practice against your knowledge base" status="Live" tone="good" onClick={() => onNavigate("quiz")} />
          <DashboardCard title="Audio" detail="Listen to a narrated review" status="Live" tone="good" onClick={() => onNavigate("audio")} />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a1915]/90 to-[#0e0e0c]/90">
          <div className="flex justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-[#9f9788]">
            <span>Focused component view</span>
            <span>Report → Deep Work</span>
          </div>
          <div className="p-5">
            <div className="my-3 h-2.5 rounded-full bg-white/10" />
            <div className="my-3 h-2.5 w-[88%] rounded-full bg-white/10" />
            <div className="my-3 h-2.5 w-[73%] rounded-full bg-white/10" />
            <p className="mt-4 leading-7 text-[#9f9788]">
              Capability chips route into live focused views for reports, quizzes, flashcards, audio, sources, and chat.
            </p>
          </div>
        </div>
      </article>

      <aside className="rounded-[26px] border border-white/10 bg-[#11110f]/75 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-[#ede6d5]">Tome activity</h2>
        <div className="mt-5 grid gap-3">
          <DecisionRow label="Sources" text="Manage uploaded notes, papers, and references." />
          <DecisionRow label="Artifacts" text="Generate reports, quizzes, flashcards, and audio." />
          <DecisionRow label="Chat" text="Continue conversations grounded in your knowledge base." />
          <DecisionRow label="History" text="Review recent work and generated outputs." />
        </div>
      </aside>
    </section>
  );
}

function FocusShell({
  keyName,
  variants,
  transition,
  onBack,
  children,
}: {
  keyName: string;
  variants: Variants;
  transition: Transition;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div key={keyName} variants={variants} initial="initial" animate="animate" exit="exit" transition={transition} className="w-full flex-1">
      <div className="relative z-10 flex w-full flex-col items-center gap-4 pb-16 pt-4">
        {children}
        <BackButton onClick={onBack} />
      </div>
    </motion.div>
  );
}

function NavPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors ${
        active ? "bg-white/10 text-[#ede6d5]" : "text-[#9f9788] hover:text-[#ede6d5]"
      }`}
    >
      {children}
    </button>
  );
}

function CapabilityButton({
  label,
  icon,
  prompt,
  view,
  onSubmit,
  onNavigate,
}: {
  label: string;
  icon: string;
  prompt?: string;
  view: ViewState;
  onSubmit: (text: string) => void;
  onNavigate: (view: ViewState) => void;
}) {
  const handleClick = () => {
    if (prompt) {
      onSubmit(prompt);
    } else {
      onNavigate(view);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 text-sm text-[#9f9788] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#f2a85d]/30 hover:bg-[#f2a85d]/10 hover:text-[#ede6d5]"
    >
      <span className="text-[#d8b978]">{icon}</span>
      {label}
    </button>
  );
}

function DashboardCard({ title, detail, status, tone, onClick }: { title: string; detail: string; status: string; tone: "good" | "warn" | "muted"; onClick: () => void }) {
  const toneClasses = {
    good: "border-[#abc7ad]/20 bg-[#abc7ad]/10 text-[#abc7ad]",
    warn: "border-[#d8b978]/20 bg-[#d8b978]/10 text-[#d8b978]",
    muted: "border-white/10 bg-white/5 text-[#9f9788]",
  }[tone];

  return (
    <button
      onClick={onClick}
      className="flex min-h-28 flex-col justify-between rounded-[18px] border border-white/[0.075] bg-white/[0.045] p-4 text-left transition-colors hover:border-[#f2a85d]/25 hover:bg-[#f2a85d]/10"
    >
      <div>
        <b className="text-sm text-[#ede6d5]">{title}</b>
        <p className="mt-2 text-sm leading-6 text-[#6f675b]">{detail}</p>
      </div>
      <span className={`mt-3 w-fit rounded-full border px-2 py-1 text-[0.68rem] ${toneClasses}`}>{status}</span>
    </button>
  );
}

function DecisionRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-2 rounded-[18px] border border-white/[0.07] bg-white/[0.04] p-4 sm:grid-cols-[112px_1fr] sm:gap-4">
      <strong className="text-[#ede6d5]">{label}</strong>
      <span className="leading-6 text-[#9f9788]">{text}</span>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/10 px-4 py-1.5 text-sm text-[#9f9788] transition-all duration-150 hover:border-[#f2a85d]/30 hover:text-[#ede6d5]"
    >
      ← Back to Tome Home
    </button>
  );
}
