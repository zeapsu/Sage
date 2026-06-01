"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { SageUserProfile } from "@/lib/user-profile";
import { normalizeUserProfile } from "@/lib/user-profile";

interface ProfileSetupProps {
  onComplete: (profile: SageUserProfile) => void;
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [interests, setInterests] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("");
  const [touched, setTouched] = useState(false);

  const nameIsMissing = touched && !name.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim()) return;

    onComplete(
      normalizeUserProfile({
        name,
        role,
        interests,
        preferredProvider,
        updatedAt: new Date().toISOString(),
      }),
    );
  };

  return (
    <section className="grid min-h-[calc(100vh-8rem)] place-items-center pb-16 pt-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[720px] rounded-[32px] border border-white/10 bg-gradient-to-b from-[#1f1d18]/95 to-[#11100e]/95 p-6 text-left shadow-[0_30px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-8"
      >
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f2a85d]/20 bg-[#f2a85d]/10 px-3 py-1 text-sm text-[#d8b978]">
            ✦ Local setup
          </div>
          <h1 className="font-serif text-[clamp(2.4rem,6vw,4.6rem)] font-normal leading-[0.96] tracking-[-0.05em] text-[#ede6d5]">
            Make Sage yours.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-[#9f9788]">
            This profile stays in this device&apos;s local browser storage and only personalizes the Tome Home greeting and settings surface for now.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-[#ede6d5]">Your name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Zeap"
              className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
              autoFocus
            />
            {nameIsMissing && <span className="text-sm text-[#ffb4ab]">Sage needs a name for the greeting.</span>}
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[#ede6d5]">Role or context</span>
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Researcher, student, builder…"
              className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[#ede6d5]">Interests or working notes</span>
            <textarea
              value={interests}
              onChange={(event) => setInterests(event.target.value)}
              placeholder="What should Sage keep in mind when helping you?"
              className="min-h-24 resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[#ede6d5]">Preferred agent/provider</span>
            <input
              value={preferredProvider}
              onChange={(event) => setPreferredProvider(event.target.value)}
              placeholder="Ollama, OpenAI-compatible, Anthropic…"
              className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[#6f675b]">Editable later from Settings. No backend account is created.</p>
          <button
            type="submit"
            className="rounded-full border border-[#f2a85d]/25 bg-[#f2a85d]/10 px-5 py-2.5 text-sm font-medium text-[#ede6d5] transition-colors hover:bg-[#f2a85d]/20"
          >
            Continue to Tome Home →
          </button>
        </div>
      </form>
    </section>
  );
}
