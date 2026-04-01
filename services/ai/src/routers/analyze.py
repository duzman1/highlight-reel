import time
from fastapi import APIRouter, HTTPException
from ..schemas.analysis import AnalysisRequest, AnalysisResponse
from ..services.motion_detector import analyze_motion
from ..services.audio_analyzer import analyze_audio
from ..services.highlight_scorer import score_and_rank_highlights

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_video(request: AnalysisRequest):
    """
    Analyze video frames and audio to detect highlight candidates.
    Called by the Node.js video processing worker after frame/audio extraction.
    """
    start_time = time.time()

    try:
        # 1. Analyze motion in frames
        motion_segments = analyze_motion(
            frames_dir=request.frames_dir,
            fps=request.fps,
        )

        # 2. Analyze audio for excitement spikes
        audio_segments = analyze_audio(
            audio_path=request.audio_path,
            fps=request.fps,
        )

        # 3. Score and rank combined highlights
        highlights = score_and_rank_highlights(
            motion_segments=motion_segments,
            audio_segments=audio_segments,
            max_highlights=request.max_highlights,
        )

        processing_time = time.time() - start_time

        return AnalysisResponse(
            video_id=request.video_id,
            highlights=highlights,
            processing_time_seconds=round(processing_time, 2),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
