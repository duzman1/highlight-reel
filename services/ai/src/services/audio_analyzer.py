"""
Audio analysis for detecting excitement spikes.
Identifies moments of crowd cheering, parent excitement, whistles, etc.
"""

import numpy as np
from pathlib import Path


def analyze_audio(audio_path: str, fps: float = 1.0) -> list[dict]:
    """
    Analyze audio for energy spikes that indicate exciting moments.

    Returns a list of segments with audio spikes:
    [{ 'start_time_ms': int, 'end_time_ms': int, 'score': float }]
    """
    path = Path(audio_path)
    if not path.exists():
        return []

    try:
        import librosa

        # Load audio
        y, sr = librosa.load(str(path), sr=22050, mono=True)

        if len(y) == 0:
            return []

        # Compute short-time energy (RMS)
        hop_length = int(sr / fps)  # One value per "frame"
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

        if len(rms) == 0:
            return []

        # Normalize
        max_rms = np.max(rms) if np.max(rms) > 0 else 1.0
        normalized = rms / max_rms

        # Find spikes: > mean + 1.5 * std
        mean_val = np.mean(normalized)
        std_val = np.std(normalized)
        threshold = mean_val + 1.5 * std_val

        # Also detect sudden increases (derivative)
        diff = np.diff(normalized, prepend=normalized[0])
        diff_threshold = np.mean(np.abs(diff)) + 2 * np.std(np.abs(diff))

        # Combine: high energy OR sudden increase
        combined = np.maximum(
            (normalized > threshold).astype(float),
            (diff > diff_threshold).astype(float) * 0.8,
        )

        segments = _extract_audio_segments(combined, normalized, fps)
        return segments

    except ImportError:
        print("Warning: librosa not installed. Skipping audio analysis.")
        return []
    except Exception as e:
        print(f"Audio analysis error: {e}")
        return []


def _extract_audio_segments(
    trigger: np.ndarray,
    scores: np.ndarray,
    fps: float,
    min_duration_ms: int = 3000,
    max_duration_ms: int = 12000,
    padding_ms: int = 2000,
) -> list[dict]:
    """Extract segments around audio triggers with padding."""
    ms_per_frame = 1000.0 / fps
    segments: list[dict] = []
    in_segment = False
    seg_start = 0
    seg_scores: list[float] = []

    for i, t in enumerate(trigger):
        if t > 0.5:
            if not in_segment:
                # Add padding before
                seg_start = max(0, int(i - padding_ms / ms_per_frame))
                seg_scores = []
                in_segment = True
            seg_scores.append(float(scores[i]))
        else:
            if in_segment:
                # Add padding after
                end_idx = min(len(trigger), int(i + padding_ms / ms_per_frame))
                start_ms = int(seg_start * ms_per_frame)
                end_ms = int(end_idx * ms_per_frame)
                duration = end_ms - start_ms

                if duration >= min_duration_ms:
                    segments.append({
                        "start_time_ms": start_ms,
                        "end_time_ms": min(end_ms, start_ms + max_duration_ms),
                        "score": float(np.mean(seg_scores)) if seg_scores else 0.5,
                    })
                in_segment = False

    # Close final segment
    if in_segment and seg_scores:
        start_ms = int(seg_start * ms_per_frame)
        end_ms = int(len(trigger) * ms_per_frame)
        if end_ms - start_ms >= min_duration_ms:
            segments.append({
                "start_time_ms": start_ms,
                "end_time_ms": min(end_ms, start_ms + max_duration_ms),
                "score": float(np.mean(seg_scores)),
            })

    return segments
