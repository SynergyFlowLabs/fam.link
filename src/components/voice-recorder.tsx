"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { addVoiceMemoryAction } from "@/actions/persons";
import { formatDuration } from "@/lib/voice-media";
import type { ActionResult } from "@/lib/action-result";

/**
 * Voice memories (issue #36) — record a short story in the browser with
 * MediaRecorder, listen back, retake if the words came out wrong, then
 * save it as a memory the whole tree can play.
 */
function VoiceSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={disabled || pending}>
      {pending ? "Saving…" : "Save voice memory"}
    </button>
  );
}

const MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
const MAX_MS = 5 * 60 * 1000;

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function VoiceRecorder({
  treeId,
  personId,
  personName,
  onSaved,
}: {
  treeId: string;
  personId: string;
  personName: string;
  onSaved?: () => void;
}) {
  const [supported, setSupported] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clipped, setClipped] = useState(false);
  const [clip, setClip] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipRef = useRef<Blob | null>(null);

  useEffect(() => {
    // Feature detection must run client-side only (MediaRecorder is a browser API).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof MediaRecorder !== "undefined" && !!pickRecorderMime());
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (clip) URL.revokeObjectURL(clip.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state === "recording") rec.stop();
  };

  const start = async () => {
    setPermissionError(null);
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        if (clip) URL.revokeObjectURL(clip.url);
        clipRef.current = blob;
        setClip({ blob, url: URL.createObjectURL(blob), seconds });
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setClipped(false);
      setRecording(true);
      recorder.start();
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_MS) {
          setClipped(true);
          finishRecording();
        }
      }, 250);
    } catch {
      setRecording(false);
      setPermissionError(
        "Microphone access was blocked — allow it in your browser and try again.",
      );
    }
  };

  const retake = () => {
    if (clip) URL.revokeObjectURL(clip.url);
    clipRef.current = null;
    setClip(null);
    setResult(null);
    setClipped(false);
    setElapsedMs(0);
  };

  async function save(formData: FormData) {
    const blob = clipRef.current;
    if (!blob) return;
    formData.set("audio", new File([blob], "voice-memory.webm", { type: blob.type }));
    const res = await addVoiceMemoryAction(formData);
    setResult(res);
    if (res.ok) {
      retake();
      onSaved?.();
    }
  }

  if (!supported) {
    return (
      <div className="card-quiet text-sm text-ink-soft">
        Voice recording needs a newer browser — Chrome, Edge, Firefox, or Safari 17+.
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden>🎙</span>
          <span className="text-sm font-medium text-ink-strong">
            Record a memory for {personName}
          </span>
        </div>
        {recording ? (
          <span className="text-sm font-mono text-rosewood">
            ● {formatDuration(elapsedMs / 1000)} / 5:00
          </span>
        ) : clip ? (
          <span className="text-sm text-ink-soft">{formatDuration(clip.seconds)}</span>
        ) : null}
      </div>

      {clipped ? (
        <p className="text-xs text-rosewood">
          Five minutes reached — the recording stopped there. Save it or start over.
        </p>
      ) : null}
      {permissionError ? <p className="text-xs text-rosewood">{permissionError}</p> : null}
      {error ? <p className="text-xs text-rosewood">{error}</p> : null}
      {result && !result.ok ? (
        <p className="text-xs text-rosewood">{result.error}</p>
      ) : null}

      {clip ? (
        <audio controls preload="metadata" src={clip.url} className="w-full" />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button type="button" className="btn-secondary" onClick={finishRecording}>
            ⏹ Stop
          </button>
        ) : clip ? (
          <button type="button" className="btn-secondary" onClick={retake}>
            ↺ Retake
          </button>
        ) : (
          <button type="button" className="btn-secondary" onClick={start}>
            ● Record
          </button>
        )}
        <span className="text-xs text-ink-soft">
          Up to 5 minutes · stays in your family tree
        </span>
      </div>

      {clip ? (
        <form action={save} className="space-y-2">
          <input type="hidden" name="treeId" value={treeId} />
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="duration" value={String(clip.seconds)} />
          <input
            type="text"
            name="occurredText"
            placeholder="When was this? (e.g. summer 1998)"
            className="input input-sm w-full"
            maxLength={60}
          />
          <input
            type="text"
            name="authorName"
            placeholder="Who is telling this story?"
            className="input input-sm w-full"
            autoComplete="off"
            maxLength={60}
          />
          <textarea
            name="body"
            placeholder="Optional transcript or notes…"
            className="input input-sm w-full"
            rows={3}
            maxLength={4000}
          />
          <div className="flex items-center gap-2">
            <VoiceSubmitButton disabled={false} />
            {result && result.ok ? (
              <span className="text-xs text-pine-700">
                {result.message ?? "Voice memory saved"}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
