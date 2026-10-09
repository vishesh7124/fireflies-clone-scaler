"""Pydantic schemas — mirror the frontend contract (frontend/src/lib/types.ts)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_serializer, field_validator


# ---------- primitives ----------

def _iso(dt: datetime | None) -> str | None:
    """Serialize datetime → ISO-8601 string (matches the frontend contract)."""
    return dt.isoformat() if dt else None


class Paginated(BaseModel):
    items: list[Any]
    page: int
    page_size: int
    total: int


# ---------- user & settings ----------

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    avatar_color: str

    model_config = {"from_attributes": True}


class SettingsOut(BaseModel):
    theme: str
    default_summary_template: str
    default_playback_speed: float
    auto_join_meetings: bool
    send_recaps_to: str

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    theme: str | None = None
    default_summary_template: str | None = None
    default_playback_speed: float | None = None
    auto_join_meetings: bool | None = None
    send_recaps_to: str | None = None


# ---------- meetings ----------

class ParticipantSummary(BaseModel):
    name: str
    avatar_color: str


class ParticipantOut(BaseModel):
    id: int
    name: str
    email: str | None
    avatar_color: str
    is_host: bool
    talk_time_ms: int
    word_count: int

    model_config = {"from_attributes": True}


class TagOut(BaseModel):
    name: str
    color: str

    model_config = {"from_attributes": True}


class ActionItemCounts(BaseModel):
    open: int
    done: int


class MeetingListItem(BaseModel):
    id: int
    title: str
    meeting_date: str
    duration_seconds: int | None
    status: str
    source: str
    channel: str | None
    language: str
    media_type: str | None
    participants: list[ParticipantSummary]
    tags: list[TagOut]
    action_item_counts: ActionItemCounts
    preview: str | None


class MeetingOut(MeetingListItem):
    participants: list[ParticipantOut]
    description: str | None
    host_id: int
    media_url: str | None
    counts: dict[str, int]
    created_at: str
    updated_at: str


class CreateMeetingInput(BaseModel):
    title: str
    meeting_date: str
    description: str | None = None
    channel: str | None = None
    participants: list[dict[str, str]] = []
    transcript_text: str | None = None


class ParticipantInput(BaseModel):
    id: int | None = None
    name: str
    email: str | None = None

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Participant name cannot be blank")
        return value.strip()


class UpdateMeetingInput(BaseModel):
    title: str | None = None
    description: str | None = None
    meeting_date: str | None = None
    channel: str | None = None
    language: str | None = None
    participants: list[ParticipantInput] | None = None

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Title cannot be blank")
        return value.strip() if value is not None else None


# ---------- transcript ----------

class TranscriptSegmentOut(BaseModel):
    id: int
    meeting_id: int
    speaker_id: int | None
    speaker_name: str
    avatar_color: str
    start_ms: int
    end_ms: int
    text: str
    is_edited: bool


class TranscriptOut(BaseModel):
    meeting_id: int
    duration_ms: int
    segments: list[TranscriptSegmentOut]


# ---------- summary ----------

class SummaryItemOut(BaseModel):
    id: int
    text: str
    timestamp_ms: int | None
    end_timestamp_ms: int | None
    source_segment_id: int | None

    model_config = {"from_attributes": True}


class SummarySectionOut(BaseModel):
    id: int
    section_type: str
    heading: str
    items: list[SummaryItemOut]


class SummaryOut(BaseModel):
    meeting_id: int
    template: str
    generated_by: str
    sections: list[SummarySectionOut]


class SummaryItemUpdate(BaseModel):
    text: str


# ---------- action items / tasks ----------

class ActionItemOut(BaseModel):
    id: int
    meeting_id: int
    meeting_title: str
    description: str
    assignee_id: int | None
    assignee_name: str | None
    status: str
    due_date: str | None
    source_segment_id: int | None
    source_start_ms: int | None
    completed_at: str | None
    created_at: str
    updated_at: str


class ActionItemCreate(BaseModel):
    description: str
    assignee_id: int | None = None
    due_date: str | None = None
    source_segment_id: int | None = None


class ActionItemUpdate(BaseModel):
    description: str | None = None
    assignee_id: int | None = None
    status: str | None = None
    due_date: str | None = None

    @field_validator("description")
    @classmethod
    def nonblank_description(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Task cannot be blank")
        return value.strip() if value is not None else None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"open", "in_progress", "done"}:
            raise ValueError("Invalid task status")
        return value


# ---------- engagement ----------

class CommentOut(BaseModel):
    id: int
    meeting_id: int
    segment_id: int | None
    user_name: str
    body: str
    created_at: str


class CommentCreate(BaseModel):
    body: str
    segment_id: int | None = None


class BookmarkOut(BaseModel):
    id: int
    meeting_id: int
    segment_id: int | None
    label: str | None
    created_at: str


class BookmarkCreate(BaseModel):
    segment_id: int | None = None
    label: str | None = None


class SoundbiteOut(BaseModel):
    id: int
    meeting_id: int
    title: str
    start_ms: int
    end_ms: int
    created_at: str


class SoundbiteCreate(BaseModel):
    title: str
    start_ms: int
    end_ms: int


# ---------- chat ----------

class ChatCitation(BaseModel):
    meeting_id: int
    meeting_title: str
    segment_id: int
    start_ms: int
    speaker: str
    quote: str


class ChatMessageOut(BaseModel):
    id: int
    meeting_id: int | None
    role: str
    content: str
    citations: list[ChatCitation] | None
    created_at: str


class ChatRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def nonblank_question(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question cannot be blank")
        return value.strip()


class ChatResponseOut(BaseModel):
    answer: str
    citations: list[ChatCitation]


# ---------- stats ----------

class SpeakerStats(BaseModel):
    name: str
    avatar_color: str
    talk_time_ms: int
    talk_time_pct: int
    word_count: int
    wpm: int
    sentiment: str


class MeetingStatsOut(BaseModel):
    speakers: list[SpeakerStats]
    filters: dict[str, int]
    sentiment: str


# ---------- dashboard ----------

class AiFeedEntry(BaseModel):
    meeting_id: int
    title: str
    meeting_date: str
    headline: str
    bullets: list[str]


class DashboardOut(BaseModel):
    total_meetings: int
    total_minutes: int
    meetings_this_week: int
    open_tasks: int
    upcoming_count: int
    top_participants: list[dict[str, Any]]
    recent: list[MeetingListItem]
    upcoming_list: list[MeetingListItem]
    ai_feed: list[AiFeedEntry]


# ---------- search ----------

class TranscriptMatch(BaseModel):
    meeting_id: int
    meeting_title: str
    segment_id: int
    start_ms: int
    speaker: str
    text: str


class SearchResultOut(BaseModel):
    meetings: list[MeetingListItem]
    transcript_matches: list[TranscriptMatch]
    total: int


# ---------- export ----------

class ExportResult(BaseModel):
    filename: str
    mime: str
    content: str
