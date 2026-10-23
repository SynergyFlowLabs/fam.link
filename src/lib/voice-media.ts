/**
 * Voice memories (issue #36) — pure validation/formatting policy for the
 * audio clips the Knowledge Holder records instead of typing. The hard
 * limits keep uploads inside the server action's 10 MB body budget and a
 * person's patience inside five minutes.
 */

export const VOICE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const VOICE_MAX_SECONDS = 5 * 60; // 5 minutes

/** Browser-recorder + common legacy formats we accept. */
export const ALLOWED_AUDIO_MIMES = [
  "audio/webm", // MediaRecorder default (opus inside)
  "audio/webm;codecs=opus",
  "audio/ogg", // opus/vorbis
  "audio/ogg;codecs=opus",
  "audio/mpeg", // mp3
  "audio/mp4", // m4a/aac (Safari MediaRecorder)
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
] as const;

export function isAllowedAudioMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const base = mime.toLowerCase().split(";")[0]!.trim();
  return (ALLOWED_AUDIO_MIMES as readonly string[]).some((m) => {
    const mb = m.toLowerCase().split(";")[0]!.trim();
    return base === mb;
  });
}

/** Storage extension for an accepted audio MIME (base, parameters dropped). */
export function audioExtForMime(mime: string): string {
  const base = mime.toLowerCase().split(";")[0]!.trim();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/x-m4a":
      return "m4a";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "audio";
  }
}

/**
 * Whole-clip guard: size and duration inside the caps. Duration comes
 * from the recorder; a missing duration (some browsers report Infinity
 * for streamed blobs) passes on size alone rather than blocking family.
 */
export function isValidVoiceClip(
  sizeBytes: number,
  durationSeconds: number | null | undefined,
): boolean {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return false;
  if (sizeBytes > VOICE_MAX_BYTES) return false;
  if (
    durationSeconds !== null &&
    durationSeconds !== undefined &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > VOICE_MAX_SECONDS
  ) {
    return false;
  }
  return true;
}

/**
 * MediaRecorder durations arrive as fractional seconds (or
 * Infinity for un-finalised blobs) — parse to whole seconds, clamped ≥ 0.
 */
export function parseDurationSeconds(
  raw: number | string | null | undefined,
): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** "1:23" / "4:05" — compact m:ss for cards and countdowns. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return "0:00";
  const whole = Math.round(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
