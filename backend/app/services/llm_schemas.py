"""Internal model contracts, not public API responses or executable SQL.

The model returns source IDs only. Service code must resolve/validate
those IDs against the permitted database context before accepting an answer.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ModelOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


class AnswerDraft(ModelOutput):
    answer: str = Field(min_length=1, max_length=12000)
    source_segment_ids: list[int] = Field(max_length=30)
    insufficient_evidence: bool


class SummaryBullet(ModelOutput):
    text: str = Field(min_length=1, max_length=2000)
    source_segment_id: int | None


class ActionSuggestion(ModelOutput):
    description: str = Field(min_length=1, max_length=1000)
    source_segment_id: int
    assignee_id: int | None
    due_date: str | None


class SummaryDraft(ModelOutput):
    # Fixed fields avoid model-generated duplicate/missing section objects.
    overview: list[SummaryBullet] = Field(min_length=1, max_length=4)
    notes: list[SummaryBullet] = Field(max_length=20)
    topics: list[SummaryBullet] = Field(max_length=20)
    metrics: list[SummaryBullet] = Field(max_length=20)
    action_suggestions: list[ActionSuggestion] = Field(max_length=30)


class QueryPlan(ModelOutput):
    intent: Literal["tasks", "count", "decisions", "discussion", "summary"]
    scope: Literal["meeting", "workspace"]
    meeting_ids: list[int] = Field(max_length=50)
    participant_names: list[Annotated[str, Field(min_length=1, max_length=120)]] = Field(max_length=10)
    participant_role: Literal["attendee", "speaker", "assignee"]
    meeting_status: Literal["ready", "scheduled", "processing", "failed", "all"]
    count_target: Literal["meetings", "tasks"]
    date_preset: Literal["none", "custom", "today", "yesterday", "tomorrow", "this_week", "last_week", "next_week", "last_7_days", "this_month", "last_month", "next_month", "since_last_month"]
    date_from: str | None
    date_to: str | None
    date_field: Literal["meeting_date", "due_date", "completed_at", "created_at"]
    task_status: Literal["open", "in_progress", "done", "not_done"] | None
    search_terms: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(max_length=12)
    clarification: str | None

    @model_validator(mode="after")
    def valid_dates(self):
        start = date.fromisoformat(self.date_from) if self.date_from else None
        end = date.fromisoformat(self.date_to) if self.date_to else None
        if start == date.min or end == date.max:
            raise ValueError("Date is outside supported boundary conversion")
        if start and end and start > end:
            raise ValueError("Invalid date range")
        return self
