"use client";

import { useEffect, useState } from "react";
import CommandBar from "@/components/CommandBar";
import { ensureDesktopBackend } from "@/lib/sage-api";

export default function Home() {
  const [response, setResponse] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    ensureDesktopBackend().catch((error) => {
      console.error("Failed to start Sage backend", error);
      if (isActive) {
        setStartupError("Error: Could not start the bundled Sage backend.");
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="relative w-full h-screen flex flex-col items-center pt-20">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* The floating command bar */}
      <CommandBar onSubmit={setResponse} />

      {startupError && (
        <div className="mt-4 w-full max-w-[600px] px-4">
          <div className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15 p-6 text-body-md text-on-surface rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]">
            {startupError}
          </div>
        </div>
      )}

      {/* Response area (expands below bar) */}
      {response && (
        <div className="mt-4 w-full max-w-[600px] px-4">
          <div className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15 p-6 text-body-md text-on-surface rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]">
            {response}
          </div>
        </div>
      )}
    </main>
  );
}
