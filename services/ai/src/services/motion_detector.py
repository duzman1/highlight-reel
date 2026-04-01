"""
Motion detection using optical flow analysis.
Identifies high-motion segments in video frames that likely correspond to
exciting plays (goals, fast breaks, big hits, etc.)
"""

import cv2
import numpy as np
from pathlib import Path


def analyze_motion(frames_dir: str, fps: float = 1.0) -> list[dict]:
    """
    Analyze motion between consecutive frames using optical flow.

    Returns a list of segments with high motion:
    [{ 'start_time_ms': int, 'end_time_ms': int, 'score': float }]
    """
    frames_path = Path(frames_dir)
    frame_files = sorted(frames_path.glob("*.jpg")) + sorted(frames_path.glob("*.png"))

    if len(frame_files) < 2:
        return []

    # Calculate optical flow magnitude for each pair of consecutive frames
    motion_scores: list[float] = []
    prev_gray = None

    for frame_file in frame_files:
        frame = cv2.imread(str(frame_file))
        if frame is None:
            motion_scores.append(0.0)
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Resize for faster processing
        gray = cv2.resize(gray, (320, 240))

        if prev_gray is not None:
            # Calculate dense optical flow
            flow = cv2.calcOpticalFlowFarneback(
                prev_gray, gray, None,
                pyr_scale=0.5, levels=3, winsize=15,
                iterations=3, poly_n=5, poly_sigma=1.2, flags=0
            )
            # Compute magnitude
            magnitude = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
            avg_motion = float(np.mean(magnitude))
            motion_scores.append(avg_motion)
        else:
            motion_scores.append(0.0)

        prev_gray = gray

    if not motion_scores:
        return []

    # Normalize scores to 0-1
    max_motion = max(motion_scores) if max(motion_scores) > 0 else 1.0
    normalized = [s / max_motion for s in motion_scores]

    # Find segments above threshold (mean + 1 std dev)
    mean_score = np.mean(normalized)
    std_score = np.std(normalized)
    threshold = mean_score + std_score

    segments = _extract_segments(normalized, threshold, fps)
    return segments


def _extract_segments(
    scores: list[float],
    threshold: float,
    fps: float,
    min_duration_ms: int = 3000,
    max_duration_ms: int = 15000,
    merge_gap_ms: int = 2000,
) -> list[dict]:
    """Extract continuous segments above threshold and merge nearby ones."""
    ms_per_frame = 1000.0 / fps
    segments: list[dict] = []
    in_segment = False
    seg_start = 0
    seg_scores: list[float] = []

    for i, score in enumerate(scores):
        if score >= threshold:
            if not in_segment:
                seg_start = i
                seg_scores = []
                in_segment = True
            seg_scores.append(score)
        else:
            if in_segment:
                start_ms = int(seg_start * ms_per_frame)
                end_ms = int(i * ms_per_frame)
                duration = end_ms - start_ms

                if duration >= min_duration_ms:
                    segments.append({
                        "start_time_ms": start_ms,
                        "end_time_ms": min(end_ms, start_ms + max_duration_ms),
                        "score": float(np.mean(seg_scores)),
                    })
                in_segment = False

    # Close final segment if needed
    if in_segment:
        start_ms = int(seg_start * ms_per_frame)
        end_ms = int(len(scores) * ms_per_frame)
        if end_ms - start_ms >= min_duration_ms:
            segments.append({
                "start_time_ms": start_ms,
                "end_time_ms": min(end_ms, start_ms + max_duration_ms),
                "score": float(np.mean(seg_scores)),
            })

    # Merge nearby segments
    merged: list[dict] = []
    for seg in segments:
        if merged and seg["start_time_ms"] - merged[-1]["end_time_ms"] < merge_gap_ms:
            merged[-1]["end_time_ms"] = seg["end_time_ms"]
            merged[-1]["score"] = max(merged[-1]["score"], seg["score"])
        else:
            merged.append(seg)

    return merged
