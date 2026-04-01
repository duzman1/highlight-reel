from pydantic import BaseModel
from typing import Optional


class HighlightCandidate(BaseModel):
    start_time_ms: int
    end_time_ms: int
    score: float  # 0.0 to 1.0
    type: str  # 'motion', 'audio_spike', 'scene_change', 'combined'
    label: Optional[str] = None


class AnalysisRequest(BaseModel):
    video_id: str
    frames_dir: str  # Path to extracted frames
    audio_path: str  # Path to extracted audio WAV
    fps: float = 1.0  # Frames per second that were extracted
    max_highlights: int = 15


class AnalysisResponse(BaseModel):
    video_id: str
    highlights: list[HighlightCandidate]
    processing_time_seconds: float
