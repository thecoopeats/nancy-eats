"use client";

import { Mic, Square } from "lucide-react";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
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
};
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

const FILTERS = ["similar", "highProtein", "lowCalorie", "seasonal", "picky", "comfort"] as const;

/** "Ask out loud": say what you'd like, see it in plain words, tap Yes to fill the plan. */
export function VoicePlanner() {
  // False on the server and in browsers without speech-to-text (like Firefox), which get the typing box only.
  const canListen = useSyncExternalStore(noop, () => getRecognition() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<VoicePlan | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [thinking, startThinking] = useTransition();
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");

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
    const Ctor = getRecognition();
    if (!Ctor) return;
    setMessage(null);
    setPlan(null);
    setText("");
    heard.current = "";
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const words = Array.from(e.results, (res) => res[0]?.transcript ?? "").join(" ");
      heard.current = words;
      setText(words);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMessage("Your device didn't let the site use the microphone. You can type what you'd like instead.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setMessage("Sorry, I couldn't hear that. Please try again, or type it instead.");
      }
    };
    r.onend = () => {
      setListening(false);
      recognition.current = null;
      if (heard.current.trim()) understand(heard.current);
    };
    recognition.current = r;
    setListening(true);
    r.start();
  }

  function stop() {
    recognition.current?.stop();
  }

  return (
    <section className="no-print space-y-5 rounded-3xl border-2 border-accent bg-card p-5 shadow-soft">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">{canListen ? "Ask out loud" : "Ask for a meal plan"}</h2>
        <p className="text-lg text-muted">
          Try {canListen ? "saying" : "typing"}: &ldquo;Plan healthy dinners for this week.&rdquo;
        </p>
      </div>

      {canListen &&
        (listening ? (
          <Button type="button" onClick={stop} className="w-full sm:w-auto">
            <Square aria-hidden className="size-6" />
            Listening… tap when you&apos;re done
          </Button>
        ) : (
          <Button type="button" onClick={listen} disabled={thinking} className="w-full sm:w-auto">
            <Mic aria-hidden className="size-7" />
            Tap and talk
          </Button>
        ))}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          understand(text);
        }}
      >
        <label className="block space-y-1">
          <span className="block text-xl font-bold">{canListen ? "Or type it here" : "What would you like?"}</span>
          <textarea
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
