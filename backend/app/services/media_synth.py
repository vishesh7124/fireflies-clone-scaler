"""Media synthesis — generate placeholder WAV audio per meeting (docs/03 §5.6).

Each speaker turn gets a soft tone (unique pitch per speaker) so the player,
seek bar, and click-to-seek behave *for real* in the demo. Silence between
turns. Pure stdlib — no ffmpeg dependency.
"""

import struct
import wave
from pathlib import Path

SAMPLE_RATE = 8000  # small files (~1 MB/min)


def synthesize_wav(
    segments: list[dict],
    speaker_ids: dict[int, int],
    out_path: Path,
    max_seconds: int = 180,
) -> str:
    """Generate a WAV file with soft tones per speaker turn.

    segments: [{start_ms, end_ms, speaker_id}]
    speaker_ids: {speaker_id: index} → unique pitch per speaker
    out_path: destination .wav path
    Returns the relative media path (e.g. "media/meeting_1.wav").
    """
    if not segments:
        return ""

    out_path.parent.mkdir(parents=True, exist_ok=True)
    total_ms = min(max_seconds * 1000, (segments[-1]["end_ms"] or 0) + 500)
    n_samples = int(SAMPLE_RATE * total_ms / 1000)

    # precompute a pitch per speaker (pentatonic scale for pleasant tones)
    PENTATONIC = [220, 261, 293, 329, 392, 440, 523]
    def pitch_for(speaker_id: int | None) -> float:
        idx = speaker_ids.get(speaker_id or 0, 0)
        return PENTATONIC[idx % len(PENTATONIC)]

    # build the sample buffer
    buf = [0.0] * n_samples
    for seg in segments:
        start = int(seg["start_ms"] * SAMPLE_RATE / 1000)
        end = min(n_samples, int(seg["end_ms"] * SAMPLE_RATE / 1000))
        if start >= n_samples:
            break
        freq = pitch_for(seg.get("speaker_id"))
        for i in range(start, end):
            t = i / SAMPLE_RATE
            # soft sine with gentle envelope
            env = 0.3 * min(1, (i - start) / 800) * min(1, (end - i) / 800)
            buf[i] += env * _sine(2 * 3.14159265 * freq * t)

    # write 16-bit PCM mono
    with wave.open(str(out_path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in buf)
        w.writeframes(frames)

    return f"media/{out_path.name}"


def _sine(x: float) -> float:
    """Approximate sine (fast, no math import per-sample)."""
    import math
    return math.sin(x)
