"use client";

import { Mic, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { VoiceAssistant, type VoiceHandle } from "@/components/voice-assistant";

/**
 * A big "Ask" button on every page once signed in. Tapping it opens the voice helper and starts listening.
 * (The home page shows the helper in full, so the button is hidden there.)
 */
export function VoiceDock() {
  const path = usePathname();
  // Remember which page it was opened on, so moving to another page closes it by itself.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const assistant = useRef<VoiceHandle>(null);

  if (path === "/" || path.startsWith("/sign-in") || path.startsWith("/check-email")) return null;

  return (
    <div className="no-print">
      {!open && (
        <button
          type="button"
          onClick={() => {
            // Open first, then listen, all inside the tap: phones only allow the microphone straight after a tap.
            flushSync(() => setOpenAt(path));
            assistant.current?.listen();
          }}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex min-h-16 items-center gap-2 rounded-full bg-accent px-6 text-xl font-bold text-accent-ink shadow-soft hover:opacity-90"
        >
          <Mic aria-hidden className="size-7" />
          Ask
        </button>
      )}
      <div className={open ? "" : "hidden"}>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpenAt(null)} aria-hidden />
        <section
          aria-label="Voice helper"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-2 border-accent bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-soft sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[30rem] sm:rounded-3xl"
        >
          <button
            type="button"
            onClick={() => setOpenAt(null)}
            className="mb-2 ml-auto flex min-h-12 items-center gap-2 rounded-full px-4 text-lg font-bold text-muted underline"
          >
            <X aria-hidden className="size-6" />
            Close
          </button>
          <VoiceAssistant ref={assistant} />
        </section>
      </div>
    </div>
  );
}
