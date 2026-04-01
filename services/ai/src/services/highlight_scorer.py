"""
Combines signals from motion detection and audio analysis
to produce final highlight candidates, scored and ranked.
"""

from ..schemas.analysis import HighlightCandidate


def score_and_rank_highlights(
    motion_segments: list[dict],
    audio_segments: list[dict],
    max_highlights: int = 15,
) -> list[HighlightCandidate]:
    """
    Merge and score highlight candidates from multiple detectors.

    Segments that appear in both motion and audio get a boosted score
    (indicating high confidence — both visual action AND audio excitement).
    """
    candidates: list[HighlightCandidate] = []

    # Add motion segments
    for seg in motion_segments:
        candidates.append(HighlightCandidate(
            start_time_ms=seg["start_time_ms"],
            end_time_ms=seg["end_time_ms"],
            score=seg["score"] * 0.7,  # Base weight for motion
            type="motion",
            label="Action",
        ))

    # Add audio segments
    for seg in audio_segments:
        candidates.append(HighlightCandidate(
            start_time_ms=seg["start_time_ms"],
            end_time_ms=seg["end_time_ms"],
            score=seg["score"] * 0.6,  # Base weight for audio
            type="audio_spike",
            label="Excitement",
        ))

    # Check for overlaps and boost combined signals
    combined = _merge_overlapping(candidates)

    # Sort by score descending
    combined.sort(key=lambda h: h.score, reverse=True)

    # Return top N
    return combined[:max_highlights]


def _merge_overlapping(
    candidates: list[HighlightCandidate],
    overlap_threshold_ms: int = 3000,
) -> list[HighlightCandidate]:
    """
    Merge overlapping candidates from different detectors.
    Overlapping segments get a boosted score since multiple signals agree.
    """
    if not candidates:
        return []

    # Sort by start time
    sorted_candidates = sorted(candidates, key=lambda h: h.start_time_ms)
    merged: list[HighlightCandidate] = []

    for candidate in sorted_candidates:
        was_merged = False

        for i, existing in enumerate(merged):
            overlap = _compute_overlap(existing, candidate)

            if overlap > overlap_threshold_ms:
                # Merge: extend the time range, boost the score
                merged[i] = HighlightCandidate(
                    start_time_ms=min(existing.start_time_ms, candidate.start_time_ms),
                    end_time_ms=max(existing.end_time_ms, candidate.end_time_ms),
                    score=min(1.0, existing.score + candidate.score * 0.5),  # Boost
                    type="combined",
                    label="Key Moment",
                )
                was_merged = True
                break

        if not was_merged:
            merged.append(candidate)

    return merged


def _compute_overlap(a: HighlightCandidate, b: HighlightCandidate) -> int:
    """Compute overlap in milliseconds between two time ranges."""
    overlap_start = max(a.start_time_ms, b.start_time_ms)
    overlap_end = min(a.end_time_ms, b.end_time_ms)
    return max(0, overlap_end - overlap_start)
