/**
 * Fixture imports — the sample data authored once in `shared/fixtures/`
 * (see that folder's README for the format). The same files feed the backend
 * seeder in Phase 5.
 */

import m01 from "../../../shared/fixtures/meeting-01.json";
import m02 from "../../../shared/fixtures/meeting-02.json";
import m03 from "../../../shared/fixtures/meeting-03.json";
import m04 from "../../../shared/fixtures/meeting-04.json";
import m05 from "../../../shared/fixtures/meeting-05.json";
import m06 from "../../../shared/fixtures/meeting-06.json";
import m07 from "../../../shared/fixtures/meeting-07.json";
import m08 from "../../../shared/fixtures/meeting-08.json";
import m09 from "../../../shared/fixtures/meeting-09.json";
import m10 from "../../../shared/fixtures/meeting-10.json";
import type { ActionItemStatus, MeetingSource, MeetingStatus, SummaryTemplate } from "@/lib/types";

// ---------- fixture shape (see shared/fixtures/README.md) ----------

export interface FixtureParticipant {
  name: string;
  email?: string;
  host?: boolean;
}

export interface FixtureTopic {
  text: string;
  at: string;
  end?: string;
}

export interface FixtureMetric {
  text: string;
  at?: string;
}

export interface FixtureActionItem {
  text: string;
  speaker: string;
  at: string;
  status?: ActionItemStatus;
  due?: string | null;
}

export interface FixtureSummary {
  template?: SummaryTemplate;
  overview: string;
  notes: string[];
  topics?: FixtureTopic[];
  metrics?: FixtureMetric[];
  action_items?: FixtureActionItem[];
}

export interface FixtureMeeting {
  title: string;
  meeting_date: string;
  description?: string;
  channel?: string;
  source?: MeetingSource;
  language?: string;
  status?: MeetingStatus;
  tags?: string[];
  participants: FixtureParticipant[];
  transcript?: string[];
  summary?: FixtureSummary | null;
  comments?: { by: string; at?: string; body: string }[];
  bookmarks?: { at: string; label?: string }[];
  soundbites?: { title: string; at: string; end: string }[];
  chat?: { role: "user" | "assistant"; content: string; cites?: string[] }[];
}

// JSON imports infer literal shapes — cast through unknown to the contract.
export const FIXTURES: FixtureMeeting[] = [
  m01,
  m02,
  m03,
  m04,
  m05,
  m06,
  m07,
  m08,
  m09,
  m10,
] as unknown as FixtureMeeting[];

/** Bump when fixture content changes so persisted copies reseed. */
export const FIXTURES_VERSION = 1;
