"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { fillPlan } from "@/app/plan/actions";
import { understandPlanRequest, type VoicePlan } from "@/app/plan/voice-actions";
import { Button } from "@/components/button";

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
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MIC_OFF =
  "The microphone is turned off for this site. To turn it on: on iPhone or iPad, open the Settings app, tap Safari, tap Microphone and choose Allow. On Android, tap the lock next to the web address, tap Permissions and turn on Microphone. Then tap the microphone again.";

const FILTERS = ["highProtein", "lowCalorie", "seasonal", "picky", "comfort"] as const;

/** "Ask out loud": say what you'd like, see it in plain words, tap Yes to fill the plan. */
export function VoicePlanner() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [thinking, startThinking] = useTransition();
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const finishRef = useRef<(() => void) | null>(null);
  const typingBox = useRef<HTMLTextAreaElement>(null);

  function understand(words: string) {
    setMessage(null);
    setPlan(null);
    if (!words.trim()) {
      setMessage("I didn't catch anything. Please try again.");
      return;
    }
    startThinking(async () => {
      const result = await understandPlanRequest(words);
      if (result.ok) setPlan(result.plan);
      else setMessage(result.message);
    });
  }

  function listen() {
    setMessage(null);
    setPlan(null);
    const Ctor = getRecognition();
    if (!Ctor) {
      // Some phone browsers can't listen directly, but every phone keyboard has its own microphone key.
      typingBox.current?.focus();
      setMessage(
        "This browser can't listen directly. Tap the microphone on your keyboard and speak, then tap \"Make my plan\". (Safari on iPhone and Chrome on Android can listen directly.)",
      );
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
    let done = false;
    let pause: ReturnType<typeof setTimeout> | undefined;
    const limit = setTimeout(() => finish(), 20000);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(pause);
      clearTimeout(limit);
      try {
        r.abort();
      } catch {}
      recognition.current = null;
      finishRef.current = null;
      setListening(false);
      if (heard.current.trim()) understand(heard.current);
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
    // Starting to listen makes the phone ask "Allow microphone?" the first time.
    try {
      r.start();
    } catch {
      setMessage(MIC_OFF);
      finish();
    }
  }

  function stop() {
    finishRef.current?.();
  }

  return (
    <section className="no-print space-y-5 rounded-3xl border-2 border-accent bg-card p-5 shadow-soft">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-bold">Ask for a meal plan</h2>
        <button
          type="button"
          onClick={listening ? stop : listen}
          disabled={thinking}
          aria-label={listening ? "Stop listening" : "Tap the microphone and talk"}
          className={`flex size-28 items-center justify-center rounded-full bg-accent text-accent-ink shadow-soft hover:opacity-90 disabled:opacity-50 ${listening ? "animate-pulse ring-8 ring-accent/30" : ""}`}
        >
          {listening ? <Square aria-hidden className="size-12" /> : <Mic aria-hidden className="size-14" />}
        </button>
        <p className="text-xl font-bold" aria-live="polite">
          {listening ? "Listening… tap when you\u2019re done" : thinking ? "Thinking…" : "Tap the microphone and talk"}
        </p>
        <p className="text-lg text-muted">Try: &ldquo;Plan healthy dinners for this week.&rdquo;</p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          understand(text);
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
          <Button type="submit" disabled={thinking || !text.trim()} className="w-full sm:w-auto">
            {thinking ? "Thinking…" : "Make my plan"}
          </Button>
        )}
      </form>

      {message && (
        <p role="alert" className="rounded-2xl border-2 border-accent bg-blush p-4 text-xl">
          {message}
        </p>
      )}

      {plan && (
        <form action={fillPlan} className="space-y-4 rounded-2xl border-2 border-accent bg-blush p-4">
          <p className="text-2xl font-bold">{plan.summary}</p>
          <input type="hidden" name="start" value={plan.start} />
          <input type="hidden" name="days" value={plan.days} />
          <input type="hidden" name="country" value={plan.country} />
          {plan.meals.map((m) => (
            <input key={m} type="hidden" name={m} value="on" />
          ))}
          {FILTERS.filter((f) => plan[f]).map((f) => (
            <input key={f} type="hidden" name={f} value="on" />
          ))}
          {plan.replace && <input type="hidden" name="replace" value="on" />}
          <div className="flex flex-wrap gap-3">
            <YesButton />
            <button
              type="button"
              onClick={() => {
                setPlan(null);
                setText("");
              }}
              className="min-h-14 rounded-full px-6 text-xl font-bold text-muted underline"
            >
              No, try again
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function YesButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Planning…" : "Yes, plan it"}
    </Button>
  );
}
