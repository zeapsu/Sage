"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { SageUserProfile } from "@/lib/user-profile";
import { normalizeUserProfile } from "@/lib/user-profile";

interface SettingsPanelProps {
  profile: SageUserProfile;
  onSave: (profile: SageUserProfile) => void;
  onBack: () => void;
}

export default function SettingsPanel({ profile, onSave, onBack }: SettingsPanelProps) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role ?? "");
  const [interests, setInterests] = useState(profile.interests ?? "");
  const [preferredProvider, setPreferredProvider] = useState(profile.preferredProvider ?? "");
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    onSave(
      normalizeUserProfile({
        name,
        role,
        interests,
        preferredProvider,
        updatedAt: new Date().toISOString(),
      }),
    );
    setSaved(true);
  };

  return (
    <section className="w-full max-w-[760px] rounded-[30px] border border-white/10 bg-gradient-to-b from-[#1f1d18]/95 to-[#11100e]/95 p-6 text-left shadow-[0_30px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[#9f9788]">Local profile</p>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.04em] text-[#ede6d5]">Settings</h1>
          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#9f9788]">
            Edit the personal details Sage keeps on this device for greetings and future agent/provider personalization.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="w-fit rounded-full border border-white/10 px-3 py-1.5 text-sm text-[#9f9788] transition-colors hover:border-[#f2a85d]/30 hover:text-[#ede6d5]"
        >
          Back to Tome Home
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm text-[#ede6d5]">Your name</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-[#ede6d5]">Role or context</span>
          <input
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setSaved(false);
            }}
            className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-[#ede6d5]">Interests or working notes</span>
          <textarea
            value={interests}
            onChange={(event) => {
              setInterests(event.target.value);
              setSaved(false);
            }}
            className="min-h-28 resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-[#ede6d5]">Preferred agent/provider</span>
          <input
            value={preferredProvider}
            onChange={(event) => {
              setPreferredProvider(event.target.value);
              setSaved(false);
            }}
            className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-[#ede6d5] outline-none placeholder:text-[#70695e] focus:border-[#f2a85d]/35"
          />
        </label>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#6f675b]">
            Stored as <code className="text-[#9f9788]">sage:user-profile:v1</code> in localStorage.
          </p>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-[#abc7ad]">Saved locally.</span>}
            <button
              type="submit"
              className="rounded-full border border-[#f2a85d]/25 bg-[#f2a85d]/10 px-5 py-2.5 text-sm font-medium text-[#ede6d5] transition-colors hover:bg-[#f2a85d]/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!name.trim()}
            >
              Save settings
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
