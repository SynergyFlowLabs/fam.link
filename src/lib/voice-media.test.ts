import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VOICE_MAX_BYTES,
  VOICE_MAX_SECONDS,
  audioExtForMime,
  formatDuration,
  isAllowedAudioMime,
  isValidVoiceClip,
  parseDurationSeconds,
} from "./voice-media.ts";

describe("voice-media", () => {
  it("isAllowedAudioMime accepts recorder formats, rejects the rest", () => {
    assert.ok(isAllowedAudioMime("audio/webm"));
    assert.ok(isAllowedAudioMime("audio/webm;codecs=opus"));
    assert.ok(isAllowedAudioMime("AUDIO/MP4"));
    assert.ok(isAllowedAudioMime("audio/ogg;codecs=opus"));
    assert.ok(isAllowedAudioMime("audio/mpeg"));
    assert.equal(isAllowedAudioMime("image/jpeg"), false);
    assert.equal(isAllowedAudioMime("video/webm"), false);
    assert.equal(isAllowedAudioMime("application/pdf"), false);
    assert.equal(isAllowedAudioMime(null), false);
    assert.equal(isAllowedAudioMime(undefined), false);
    assert.equal(isAllowedAudioMime(""), false);
  });

  it("audioExtForMime maps base types to storage extensions", () => {
    assert.equal(audioExtForMime("audio/webm;codecs=opus"), "webm");
    assert.equal(audioExtForMime("audio/ogg"), "ogg");
    assert.equal(audioExtForMime("audio/mpeg"), "mp3");
    assert.equal(audioExtForMime("audio/mp4"), "m4a");
    assert.equal(audioExtForMime("audio/x-m4a"), "m4a");
    assert.equal(audioExtForMime("audio/wav"), "wav");
    assert.equal(audioExtForMime("audio/whatever"), "audio");
  });

  it("isValidVoiceClip enforces size and duration caps", () => {
    assert.ok(isValidVoiceClip(1024, 30));
    assert.ok(isValidVoiceClip(VOICE_MAX_BYTES, VOICE_MAX_SECONDS));
    assert.equal(isValidVoiceClip(VOICE_MAX_BYTES + 1, 10), false);
    assert.equal(isValidVoiceClip(1024, VOICE_MAX_SECONDS + 1), false);
    // missing/unknown duration passes on size alone (browser Infinity case)
    assert.ok(isValidVoiceClip(1024, null));
    assert.ok(isValidVoiceClip(1024, undefined));
    // non-positive sizes are nonsense
    assert.equal(isValidVoiceClip(0, 10), false);
    assert.equal(isValidVoiceClip(-5, 10), false);
  });

  it("parseDurationSeconds normalises recorder output", () => {
    assert.equal(parseDurationSeconds(12.4), 12);
    assert.equal(parseDurationSeconds("9.9"), 10);
    assert.equal(parseDurationSeconds(0), 0);
    assert.equal(parseDurationSeconds(null), null);
    assert.equal(parseDurationSeconds(undefined), null);
    assert.equal(parseDurationSeconds(""), null);
    assert.equal(parseDurationSeconds(Number.POSITIVE_INFINITY), null);
    assert.equal(parseDurationSeconds(-3), null);
    assert.equal(parseDurationSeconds("not a number"), null);
  });

  it("formatDuration renders m:ss and tolerates junk", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(59), "0:59");
    assert.equal(formatDuration(60), "1:00");
    assert.equal(formatDuration(83.6), "1:24");
    assert.equal(formatDuration(VOICE_MAX_SECONDS), "5:00");
    assert.equal(formatDuration(null), "0:00");
    assert.equal(formatDuration(Number.POSITIVE_INFINITY), "0:00");
    assert.equal(formatDuration(-4), "0:00");
  });
});
