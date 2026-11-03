"use client";

import { CheckCircle2, Mic, Square } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { runVoiceAction, understandRequest, type VoiceReply } from "@/app/voice-actions";
import { Button } from "@/components/button";
import type { VoiceOutcome } from "@/lib/voice/registry";

// The browser's speech-to-text (Chrome, Edge, Safari). Not in TypeScript's built-in types yet.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // Chrome, Firefox and Edge on iPhone are Safari underneath and ask for the microphone again on every try,
  // which breaks the second tap. Those use the keyboard's own microphone key instead, which never asks.
  if (/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MIC_OFF =
  "The microphone is turned off for this site. To turn it on: on iPhone or iPad, open the Settings app, tap Safari, tap Microphone and choose Allow. On Android, tap the lock next to the web address, tap Permissions and turn on Microphone. Then tap the microphone again.";

const SORRY = "Sorry, something went wrong. Please try again.";

export type VoiceHandle = { listen(): void };

/** "Ask out loud": say or type what you'd like. Harmless things happen at once; bigger ones ask Yes or No first. */
export function VoiceAssistant({ ref }: { ref?: Ref<VoiceHandle> }) {
  const path = usePathname();
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [question, setQuestion] = useState<Extract<VoiceReply, { kind: "ask" }> | null>(null);
  const [done, setDone] = useState<VoiceOutcome | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const finishRef = useRef<(() => void) | null>(null);
  const lastEnd = useRef(0);
  const typingBox = useRef<HTMLTextAreaElement>(null);

  // Let go of the microphone if she leaves the page while it is listening.
  useEffect(() => () => finishRef.current?.(), []);
  useImperativeHandle(ref, () => ({ listen }));

  function clear() {
    setMessage(null);
    setQuestion(null);
    setDone(null);
  }

  function show(reply: VoiceReply) {
    if (reply.kind === "say") setMessage(reply.message);
    else if (reply.kind === "ask") setQuestion(reply);
    else {
      setDone(reply.outcome);
      if (reply.outcome.print) setTimeout(() => window.print(), 150);
      if (reply.outcome.href && reply.outcome.open) router.push(reply.outcome.href);
    }
  }

  async function send(words: string) {
    clear();
    if (!words.trim()) {
      setMessage("I didn't catch anything. Please try again.");
      return;
    }
    setBusy(true);
    try {
      show(await understandRequest(words, path));
    } catch {
      setMessage(SORRY);
    } finally {
      setBusy(false);
    }
  }

  async function yes() {
    if (!question) return;
    const asked = question;
    clear();
    setBusy(true);
    try {
      show(await runVoiceAction(asked.name, asked.args, path));
    } catch {
      setMessage(SORRY);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    clear();
    const Ctor = getRecognition();
    if (!Ctor) {
      // Some phone browsers can't listen directly, but every phone keyboard has its own microphone key.
      typingBox.current?.focus();
      setMessage('To talk: tap the little microphone on your keyboard, say what you\'d like, then tap "Go".');
      return;
    }
    setText("");
    heard.current = "";
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;

    // Some phones (iPhone especially) never report that listening ended, so we finish ourselves:
    // when she taps stop, after a short pause in speech, or after 20 seconds at most.
    let finished = false;
    let pause: ReturnType<typeof setTimeout> | undefined;
    const limit = setTimeout(() => finish(), 20000);
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(pause);
      clearTimeout(limit);
      // Release the microphone and detach this session's handlers, so nothing from it can touch the next one.
      r.onresult = r.onerror = r.onend = null;
      try {
        r.stop();
      } catch {}
      try {
        r.abort();
      } catch {}
      if (recognition.current === r) recognition.current = null;
      if (finishRef.current === finish) finishRef.current = null;
      lastEnd.current = Date.now();
      setListening(false);
      if (heard.current.trim()) void send(heard.current);
    }

    r.onresult = (e) => {
      const words = Array.from(e.results, (res) => res[0]?.transcript ?? "").join(" ");
      heard.current = words;
      setText(words);
      clearTimeout(pause);
      pause = setTimeout(finish, 2500);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMessage(MIC_OFF);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setMessage("Sorry, I couldn't hear that. Please tap the microphone and try again.");
      }
      finish();
    };
    r.onend = finish;
    recognition.current = r;
    finishRef.current = finish;
    setListening(true);

    // Phones need a moment to free the microphone after the last try; starting too soon fails silently.
    // Starting to listen also makes the phone ask "Allow microphone?" the first time.
    const wait = Math.max(0, 700 - (Date.now() - lastEnd.current));
    const begin = (retry: boolean) => {
      if (finished) return;
      try {
        r.start();
      } catch {
        if (retry) setTimeout(() => begin(false), 600);
        else {
          setMessage("Sorry, the microphone is busy. Please wait a moment and tap it again.");
          finish();
        }
      }
    };
    setTimeout(() => begin(true), wait);
  }

  function stop() {
    finishRef.current?.();
  }

  const onRecipe = /^\/(recipes\/\d+|my-recipes\/)/.test(path);
  const examples = onRecipe
    ? ["Add this to my favorites", "Add this to my grocery list", "Put this on Tuesday dinner"]
    : ["Plan healthy dinners for this week", "Find a chicken soup recipe", "Add milk to my grocery list"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-bold">What would you like to do?</h2>
        <button
          type="button"
          onClick={listening ? stop : listen}
          disabled={busy}
          aria-label={listening ? "Stop listening" : "Tap the microphone and talk"}
          className={`flex size-28 items-center justify-center rounded-full bg-accent text-accent-ink shadow-soft hover:opacity-90 disabled:opacity-50 ${listening ? "animate-pulse ring-8 ring-accent/30" : ""}`}
        >
          {listening ? <Square aria-hidden className="size-12" /> : <Mic aria-hidden className="size-14" />}
        </button>
        <p className="text-xl font-bold" aria-live="polite">
          {listening ? "Listening… tap when you\u2019re done" : busy ? "Working on it…" : "Tap the microphone and talk"}
        </p>
        <p className="text-lg text-muted">
          Try: {examples.map((e, i) => (
            <span key={e}>
              {i > 0 && " · "}&ldquo;{e}&rdquo;
            </span>
          ))}
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label className="block space-y-1">
          <span className="block text-xl font-bold">Or type it here</span>
          <textarea
            ref={typingBox}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={500}
            className="block w-full rounded-xl border-2 border-border bg-card p-3 text-xl"
          />
        </label>
        {!listening && (
          <Button type="submit" disabled={busy || !text.trim()} className="w-full sm:w-auto">
            {busy ? "Working on it…" : "Go"}
          </Button>
        )}
      </form>

      {message && (
        <p role="alert" className="rounded-2xl border-2 border-accent bg-blush p-4 text-xl">
          {message}
        </p>
      )}

      {done && (
        <div role="status" className="space-y-3 rounded-2xl border-2 border-accent bg-sage/40 p-4">
          <p className="flex items-start gap-3 text-xl font-bold">
            <CheckCircle2 aria-hidden className="mt-0.5 size-7 shrink-0 text-accent" />
            {done.message}
          </p>
          {done.href && !done.open && (
            <Link
              href={done.href}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-7 text-xl font-bold text-accent-ink no-underline shadow-soft hover:opacity-90"
            >
              See it
            </Link>
          )}
        </div>
      )}

      {question && (
        <div className="space-y-4 rounded-2xl border-2 border-accent bg-blush p-4">
          <p className="text-2xl font-bold">{question.question}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={yes} disabled={busy}>
              Yes
            </Button>
            <button
              type="button"
              onClick={() => {
                setQuestion(null);
                setText("");
              }}
              className="min-h-14 rounded-full px-6 text-xl font-bold text-muted underline"
            >
              No, try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
