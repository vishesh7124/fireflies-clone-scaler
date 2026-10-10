"""Internal scope plans. No generated SQL; dates/identities resolve on the backend."""

import re
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pydantic import ValidationError

from sqlalchemy import func, select, text

from app.database import SessionLocal
from app.models import Meeting, Participant, User, ChatMessage
from app.services.llm_client import LLMError
from app.services.llm_schemas import QueryPlan
from app.time_utils import utc_iso


class Clarify(Exception):
    pass


PRESETS = {
    "since_last_month": r"\bsince last month\b",
    "last_7_days": r"\b(last|past) (7|seven) days\b|\bpast week\b",
    "this_week": r"\bthis week\b", "last_week": r"\blast week\b", "next_week": r"\bnext week\b",
    "this_month": r"\bthis month\b", "last_month": r"\blast month\b", "next_month": r"\bnext month\b",
    "yesterday": r"\byesterday\b", "today": r"\btoday\b", "tomorrow": r"\btomorrow\b",
}
MONTH_WORDS = r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b"
WEEKDAY_WORDS = r"\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b"


def current_time(config):
    return datetime.now(timezone.utc).astimezone(ZoneInfo(config.workspace_timezone))


def _next_month(value):
    return date(value.year + (value.month == 12), value.month % 12 + 1, 1)


def preset_dates(preset, today):
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    previous = (month - timedelta(days=1)).replace(day=1)
    ranges = {
        "today": (today, today), "yesterday": (today - timedelta(days=1), today - timedelta(days=1)),
        "tomorrow": (today + timedelta(days=1), today + timedelta(days=1)),
        "this_week": (week, week + timedelta(days=6)),
        "last_week": (week - timedelta(days=7), week - timedelta(days=1)),
        "next_week": (week + timedelta(days=7), week + timedelta(days=13)),
        "last_7_days": (today - timedelta(days=6), today),
        "this_month": (month, _next_month(month) - timedelta(days=1)),
        "last_month": (previous, month - timedelta(days=1)),
        "next_month": (_next_month(month), _next_month(_next_month(month)) - timedelta(days=1)),
        "since_last_month": (previous, today),
    }
    return ranges[preset]


def date_bounds(plan, config):
    """Half-open SQL boundaries. Due dates are local calendar dates; other times UTC."""
    start = date.fromisoformat(plan.date_from) if plan.date_from else None
    end = date.fromisoformat(plan.date_to) + timedelta(days=1) if plan.date_to else None
    def convert(value):
        if value is None:
            return None
        value = datetime.combine(value, datetime.min.time())
        if plan.date_field == "due_date":
            return value
        return value.replace(tzinfo=ZoneInfo(config.workspace_timezone)).astimezone(timezone.utc).replace(tzinfo=None)
    return convert(start), convert(end)


def latest_meeting_id(plan, config, db=None):
    stmt = select(Meeting.id).where(Meeting.is_deleted == False, Meeting.status == "ready")
    if plan.participant_names and plan.participant_role in {"attendee", "speaker"}:
        stmt = stmt.where(Meeting.id.in_(select(Participant.meeting_id).where(Participant.name.in_(plan.participant_names))))
    if plan.date_field == "meeting_date":
        start, end = date_bounds(plan, config)
        if start:
            stmt = stmt.where(Meeting.meeting_date >= start)
        if end:
            stmt = stmt.where(Meeting.meeting_date < end)
    stmt = stmt.order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).limit(1)
    if db is not None:
        return db.scalar(stmt)
    with SessionLocal() as session:
        return session.scalar(stmt)


def iso_bounds(question):
    values = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", question)
    if not values:
        return None
    try:
        parsed = [date.fromisoformat(value) for value in values]
    except ValueError:
        raise Clarify("Please give a valid date range, for example 2026-10-01 to 2026-10-09.") from None
    if len(parsed) > 1:
        if parsed[0] > parsed[-1]:
            raise Clarify("The start date must not be after the end date.")
        return values[0], values[-1]
    if parsed[0] in {date.min, date.max}:
        raise Clarify("Please give a date within the supported calendar range.")
    if re.search(r"\bbefore\s+" + re.escape(values[0]), question, re.I):
        return None, (parsed[0] - timedelta(days=1)).isoformat()
    if re.search(r"\b(before|until|through|by)\s+" + re.escape(values[0]), question, re.I):
        return None, values[0]
    if re.search(r"\bafter\s+" + re.escape(values[0]), question, re.I):
        return (parsed[0] + timedelta(days=1)).isoformat(), None
    if re.search(r"\b(since|from)\s+" + re.escape(values[0]), question, re.I):
        return values[0], None
    return values[0], values[0]


def task_date_field(question):
    q = question.lower()
    if "due" in q:
        return "due_date"
    if "completed" in q and not re.search(r"\b(not completed|uncompleted)\b", q):
        return "completed_at"
    if "created" in q:
        return "created_at"
    return "due_date"


def read_catalog(question, config):
    with SessionLocal() as db:
        db.execute(text("BEGIN"))
        stmt = select(Meeting).where(Meeting.is_deleted == False)
        recent = list(db.scalars(stmt.order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).limit(config.global_catalog_limit)))
        latest_ready = db.scalar(stmt.where(Meeting.status == "ready").order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).limit(1))
        if latest_ready and all(m.id != latest_ready.id for m in recent):
            recent.append(latest_ready)
        explicit_ids = [int(value) for value in re.findall(r"\bmeeting\s*#?\s*(\d+)\b", question, re.I)]
        if any(mid < 1 or mid > 9223372036854775807 for mid in explicit_ids):
            raise Clarify("Please use a valid positive meeting ID.")
        explicit = list(db.scalars(stmt.where(Meeting.id.in_(explicit_ids)))) if explicit_ids else []
        entries = {meeting.id: meeting for meeting in [*recent, *explicit]}
        names = list(db.scalars(select(Participant.name).join(Meeting).where(Meeting.is_deleted == False).distinct().limit(500)))
        user = db.scalar(select(User).where(User.is_default == True))
        history = list(db.scalars(select(ChatMessage).where(ChatMessage.meeting_id.is_(None))
                      .order_by(ChatMessage.id.desc()).limit(6)))
        total = db.scalar(select(func.count(Meeting.id)).where(Meeting.is_deleted == False)) or 0
        return {"meetings": [{"id": m.id, "title": m.title, "date": utc_iso(m.meeting_date), "status": m.status} for m in entries.values()],
                "participant_names": names, "current_user": user.name if user else None,
                "catalog_truncated": total > len(entries),
                "history": [{"role": h.role, "content": h.content[:1000], "truncated": len(h.content) > 1000} for h in reversed(history)]}


def _support_text(question, catalog):
    follow_up = re.match(r"^(and\b|what about\b|how about\b|those\b|that\b|same\b)", question.strip(), re.I) or re.fullmatch(r"how many(?: of (those|them))?\??", question.strip(), re.I)
    if follow_up:
        previous = next((h for h in reversed(catalog["history"]) if h["role"] == "user"), None)
        if previous and previous.get("truncated"):
            raise Clarify("Please restate the meeting/participant and date range; the previous question was too long to reuse reliably.")
        return question + " " + (previous["content"] if previous else "")
    return question


def _actor_text(question, support, names):
    explicit = re.search(r"\b(my|me|i|what did|assigned to|tasks for|meetings with)\b", question, re.I)
    named = any(re.search(r"\b" + re.escape(name) + r"\b", question, re.I) or
                re.search(r"\b" + re.escape(name.split()[0]) + r"\b", question, re.I) for name in names if name.split())
    return question if explicit or named else support


def resolve_plan(plan, question, catalog, config, now):
    if plan.clarification:
        raise Clarify("Please clarify the meeting, participant, or date range you want me to use.")
    support = _support_text(question, catalog)
    if re.search(r"\b(tagged|with the tag|in (?:the )?(?:channel|folder|department|team))\b", support, re.I):
        raise Clarify("Please specify meeting IDs, participants, or dates; tag/channel/team scope is not supported in AskFred yet.")
    explicit_count = re.search(r"\b(?:how many|count|number of)\s+(?:(?:of|my|our|the|open|completed|done|unfinished|pending|overdue|recorded|scheduled|upcoming|failed|processing|accepted)\s+)*(meetings?|tasks?|action items?|to-?dos?)\b", support, re.I)
    if explicit_count:
        target = "meetings" if explicit_count[1].lower().startswith("meeting") else "tasks"
        if target == "meetings" and re.search(r"\b(discussed?|mentioned?|about|containing)\b", question, re.I):
            raise Clarify("I can count meetings by dates, participants, status or IDs. Topic-based exhaustive counts are not supported; ask me to retrieve the relevant discussions instead.")
        field = "meeting_date" if target == "meetings" else task_date_field(question)
        plan = plan.model_copy(update={"intent": "count", "count_target": target, "date_field": field})
    unsupported_count = r"\b(how many|count)\s+(users?|participants?|people|comments?|tags?|soundbites?|suggestions?)\b"
    if plan.intent == "count" and re.search(unsupported_count, support, re.I):
        raise Clarify("I can currently count meetings or accepted tasks. Please specify which one.")
    ids = list(dict.fromkeys(plan.meeting_ids))
    explicit = [int(value) for value in re.findall(r"\bmeeting\s*#?\s*(\d+)\b", support, re.I)]
    latest = bool(re.search(r"\b(last|latest|most recent) meeting\b", support, re.I))
    if latest:
        ready = [m for m in catalog["meetings"] if m["status"] == "ready"]
        if not ready:
            raise Clarify("There are no processed meetings to use yet.")
        ids = [max(ready, key=lambda m: (m["date"], m["id"]))["id"]]
    elif explicit:
        ids = list(dict.fromkeys(explicit))
    elif ids:
        words = {word.casefold() for word in re.findall(r"\w+", support)}
        for mid in ids:
            title = next((m["title"] for m in catalog["meetings"] if m["id"] == mid), "")
            title_words = {word.casefold() for word in re.findall(r"\w+", title) if len(word) > 2}
            if not title or (title.casefold() not in support.casefold() and len(title_words & words) < 2):
                raise LLMError("unrequested_meeting_filter")
    allowed = {m["id"] for m in catalog["meetings"]}
    if any(mid not in allowed for mid in ids):
        raise Clarify("I couldn't identify that meeting. Please give its title or meeting ID.")
    if plan.scope == "meeting" and not ids:
        raise Clarify("Which meeting would you like me to use?")
    known = list(dict.fromkeys(catalog["participant_names"]))
    actor_text = _actor_text(question, support, known)
    names = []
    requested = list(plan.participant_names)
    explicit_actor = re.search(r"(?:what did|assigned to|tasks for|meetings with)\s+([A-Za-z]+)", actor_text, re.I)
    if explicit_actor and explicit_actor[1].lower() not in {"me", "i", "we", "the", "my"}:
        full = [name for name in known if re.search(r"\b" + re.escape(name) + r"\b", actor_text, re.I)]
        requested.extend(full or [explicit_actor[1]])
    task_intent = plan.intent == "tasks" or (plan.intent == "count" and plan.count_target == "tasks")
    overdue = task_intent and bool(re.search(r"\boverdue\b", question, re.I))
    if overdue:
        plan = plan.model_copy(update={"date_field": "due_date"})
    self_reference = bool(re.search(r"\b(my|me|i)\b", actor_text, re.I))
    personal_tasks = task_intent and bool(re.search(r"\b(my\b.*\b(tasks?|action items?)|assigned to me|tasks do i have|action items do i have)\b", actor_text, re.I))
    if personal_tasks:
        requested.append("me")
    for requested_name in requested:
        if requested_name.casefold() in {"me", "my", "i"}:
            if not self_reference:
                raise LLMError("unrequested_participant_filter")
            if not catalog["current_user"]:
                raise Clarify("I couldn't resolve the current user.")
            names.append(catalog["current_user"])
            continue
        first = requested_name.split()[0]
        full_mentioned = bool(re.search(r"\b" + re.escape(requested_name) + r"\b", actor_text, re.I))
        first_mentioned = bool(re.search(r"\b" + re.escape(first) + r"\b", actor_text, re.I))
        is_self = self_reference and requested_name == catalog["current_user"]
        if not full_mentioned and not first_mentioned and not is_self:
            raise LLMError("unrequested_participant_filter")
        if first_mentioned and not full_mentioned and len([name for name in known if name.split()[0].casefold() == first.casefold()]) > 1:
            raise Clarify("Please use a full participant name so I can identify the right person.")
        if is_self:
            names.append(catalog["current_user"])
            continue
        exact = [name for name in known if name.casefold() == requested_name.casefold()]
        matches = exact or [name for name in known if name.split()[0].casefold() == requested_name.casefold()]
        if len(matches) != 1:
            raise Clarify("Please use a full participant name so I can identify the right person.")
        names.append(matches[0])
    start, end = plan.date_from, plan.date_to
    preset = plan.date_preset
    requested_preset = next((name for name, pattern in PRESETS.items() if re.search(pattern, question, re.I)), None)
    explicit_bounds = iso_bounds(question)
    if explicit_bounds and not requested_preset:
        start, end = explicit_bounds
        preset = "custom"
    overdue_end = (now.astimezone(ZoneInfo(config.workspace_timezone)).date() - timedelta(days=1)).isoformat()
    if overdue and (preset in {"none", "today"} or (not requested_preset and not explicit_bounds and not re.search(MONTH_WORDS + r"|\b\d{4}\b", question, re.I))):
        start, end, preset = None, overdue_end, "custom"
    if requested_preset and preset == "none":
        preset = requested_preset
    if preset not in {"none", "custom"}:
        supported = bool(re.search(PRESETS[preset], support, re.I))
        if preset == "since_last_month" and "last month" in support.lower() and "this month" in support.lower():
            supported = True
        if not supported:
            raise LLMError("unrequested_date_filter")
        if requested_preset and preset != requested_preset and preset != "since_last_month":
            raise LLMError("wrong_relative_period")
        a, b = preset_dates(preset, now.astimezone(ZoneInfo(config.workspace_timezone)).date())
        start, end = a.isoformat(), b.isoformat()
    elif preset == "none":
        if start or end:
            raise LLMError("unrequested_date_filter")
        if re.search(r"\b(last|past|next|this)\s+(?:\w+\s+)?(days?|weeks?|months?|years?)\b", support, re.I):
            raise LLMError("unresolved_date_filter")
        if re.search(WEEKDAY_WORDS, question, re.I):
            raise LLMError("unresolved_date_filter")
    elif preset == "custom":
        if not overdue and (not (start or end) or not re.search(r"\b\d{4}\b|" + MONTH_WORDS + r"|\bq[1-4]\b", support, re.I)):
            raise Clarify("Please specify an explicit date range.")
    if overdue:
        end = min(end, overdue_end) if end else overdue_end
    if not task_intent and plan.date_field != "meeting_date":
        raise LLMError("invalid_date_field")
    if plan.intent == "count":
        if re.search(r"\b(tasks?|action items?|todos?)\b", question, re.I) and plan.count_target != "tasks":
            raise LLMError("invalid_count_target")
        if re.search(r"\bmeetings?\b", question, re.I) and not re.search(r"\b(tasks?|action items?)\b", question, re.I) and plan.count_target != "meetings":
            raise LLMError("invalid_count_target")
    if task_intent and re.search(r"\bdue\b", question, re.I) and plan.date_field != "due_date":
        raise LLMError("invalid_date_field")
    if plan.participant_role == "assignee" and not task_intent:
        raise LLMError("invalid_participant_role")
    if not task_intent and plan.intent != "count" and plan.meeting_status != "ready":
        raise Clarify("Discussion answers need a processed meeting with a transcript.")
    status = plan.task_status
    requested_status = "in_progress" if re.search(r"\bin progress\b", support, re.I) else "not_done" if re.search(r"\b(unfinished|not done|not completed|incomplete)\b", support, re.I) else "open" if re.search(r"\b(open|pending)\b", support, re.I) else "done" if re.search(r"\b(completed|done|finished)\b", support, re.I) else None
    if overdue:
        if requested_status == "done":
            raise Clarify("Currently overdue excludes completed tasks. Please clarify whether you mean late completions.")
        requested_status = requested_status or "not_done"
        status = None  # computed by the backend, not the planner
    if task_intent and status is not None and status != requested_status:
        raise LLMError("unrequested_task_status")
    if task_intent:
        status = requested_status
    if task_intent and status in {"open", "in_progress", "not_done"} and plan.date_field == "completed_at" and (start or end):
        raise Clarify("Incomplete tasks have no completion date. Do you mean their due dates or creation dates?")
    meeting_status = plan.meeting_status
    if task_intent or plan.intent == "count":
        meeting_status = "scheduled" if re.search(r"\b(scheduled|upcoming)\b", support, re.I) else "failed" if "failed" in support.lower() else "processing" if "processing" in support.lower() else "ready" if re.search(r"\b(recorded|processed|past meetings)\b", support, re.I) else "all"
    resolved = plan.model_copy(update={"meeting_ids": ids, "participant_names": list(dict.fromkeys(names)),
                                   "date_from": start, "date_to": end, "date_preset": preset,
                                   "task_status": status, "meeting_status": meeting_status,
                                   "participant_role": "assignee" if personal_tasks or (task_intent and re.search(r"\b(assigned to|tasks for)\b", question, re.I)) else plan.participant_role})
    if latest:
        mid = latest_meeting_id(resolved, config)
        if mid is None:
            raise Clarify("There are no processed meetings matching that participant/date range.")
        resolved = resolved.model_copy(update={"meeting_ids": [mid], "scope": "meeting"})
    return resolved


def rule_plan(question, catalog):
    """Small conservative fallback. Unknown scope is clarified, never widened."""
    support = _support_text(question, catalog)
    q = support.lower()
    actor_text = _actor_text(question, support, catalog["participant_names"])
    tasks = bool(re.search(r"\b(tasks?|action items?|to-?dos?|next steps)\b", q))
    intent = "count" if re.search(r"\b(how many|count|number of)\b", q) else "tasks" if tasks else "summary" if re.search(r"summar|recap|takeaway", q) else "discussion"
    ids = [int(value) for value in re.findall(r"\bmeeting\s*#?\s*(\d+)\b", q)]
    for meeting in catalog["meetings"]:
        if meeting["title"].lower() in q and len(re.findall(r"\w+", meeting["title"])) > 1:
            ids.append(meeting["id"])
    if re.search(r"\b(last|latest|most recent) meeting\b", q):
        ready = [m for m in catalog["meetings"] if m["status"] == "ready"]
        if ready:
            ids = [max(ready, key=lambda m: (m["date"], m["id"]))["id"]]
        else:
            raise Clarify("There are no processed meetings to use yet.")
    names = []
    for name in catalog["participant_names"]:
        if re.search(r"\b" + re.escape(name) + r"\b", actor_text, re.I):
            names.append(name)
    # Detect ambiguous first names even when no full name was found.
    for first in {name.split()[0] for name in catalog["participant_names"] if name.split()}:
        if re.search(r"\b" + re.escape(first) + r"\b", actor_text, re.I) and not any(n.split()[0] == first for n in names):
            names.append(first)
    unknown = re.search(r"(?:what did|assigned to|tasks for)\s+([A-Za-z]+)", question, re.I)
    if unknown and not names and unknown[1].lower() not in {"me", "i", "we", "the", "my"}:
        names.append(unknown[1])
    preset = next((name for name, pattern in PRESETS.items() if re.search(pattern, question, re.I)), None)
    preset = preset or next((name for name, pattern in PRESETS.items() if re.search(pattern, q, re.I)), "none")
    explicit_dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", q)
    if explicit_dates:
        preset = "custom"
        try:
            parsed_dates = [date.fromisoformat(value) for value in explicit_dates]
        except ValueError:
            raise Clarify("Please give a valid date range, for example 2026-10-01 to 2026-10-09.") from None
        if len(parsed_dates) > 1 and parsed_dates[0] > parsed_dates[-1]:
            raise Clarify("The start date must not be after the end date.")
    # Unsupported relative periods must not silently turn into unrestricted scope.
    if preset == "none" and re.search(r"\b(since|between|during|quarter)\b|\b(last|past|next|this)\s+(?:\w+\s+)?(days?|weeks?|months?|years?)\b|" + MONTH_WORDS + "|" + WEEKDAY_WORDS + r"|\b20\d{2}\b", q):
        raise Clarify("Please specify the date range explicitly, for example 2026-10-01 to 2026-10-09.")
    status = None  # resolve_plan derives explicit status words consistently
    field = "meeting_date" if not tasks else task_date_field(q)
    meeting_status = "scheduled" if "scheduled" in q or "upcoming" in q else "all" if tasks or intent == "count" else "ready"
    start, end = iso_bounds(q) or (None, None)
    if intent == "count" and not re.search(r"\b(meetings?|tasks?|action items?|to-?dos?)\b", q):
        raise Clarify("Would you like a meeting count or a task count?")
    try:
        return QueryPlan(intent=intent, scope="meeting" if ids else "workspace", meeting_ids=ids,
            participant_names=names, participant_role="assignee" if tasks else "speaker" if "said" in q or "say" in q else "attendee",
            meeting_status=meeting_status, count_target="tasks" if tasks else "meetings", date_preset=preset,
            date_from=start, date_to=end, date_field=field, task_status=status, search_terms=[], clarification=None)
    except ValidationError:
        raise Clarify("I couldn't safely parse that scope. Please specify a meeting, participant, and valid date range.") from None
