/**
 * Phase 1 smoke test — runs the mock data layer end-to-end (no UI):
 * fixtures load, stats compute, AskFred answers with citations, the
 * paste→processing→ready flow works, and exports render.
 *
 *   npx tsx scripts/smoke.ts
 */

import { mockApi } from "@/mock/api";
import { resetDb } from "@/mock/store";

async function main() {
  await resetDb();

  // dashboard
  const dash = await mockApi.getDashboard();
  console.log(`✓ dashboard: ${dash.total_meetings} meetings, ${dash.total_minutes} min, ${dash.open_tasks} open tasks, ${dash.upcoming_count} upcoming`);

  // list + filters
  const all = await mockApi.listMeetings({ sort: "recent" });
  console.log(`✓ list: ${all.total} meetings, first = "${all.items[0].title}"`);
  const sales = await mockApi.listMeetings({ tag: "sales" });
  console.log(`✓ tag filter (sales): ${sales.total} meetings`);
  const byParticipant = await mockApi.listMeetings({ participant: "Maya" });
  console.log(`✓ participant filter (Maya): ${byParticipant.total} meetings`);

  // transcript + stats
  const meeting = all.items.find((m) => m.status === "ready")!;
  const transcript = await mockApi.getTranscript(meeting.id);
  const stats = await mockApi.getStats(meeting.id);
  const topSpeaker = stats.speakers[0];
  console.log(
    `✓ transcript: ${transcript.segments.length} segments, ${Math.round(transcript.duration_ms / 60000)} min; top speaker ${topSpeaker.name} ${topSpeaker.talk_time_pct}% @ ${topSpeaker.wpm} wpm (${topSpeaker.sentiment})`,
  );
  console.log(
    `✓ smart search filters: Q${stats.filters.questions} T${stats.filters.tasks} D${stats.filters.dates} M${stats.filters.metrics} P${stats.filters.pricing} F${stats.filters.fillers}`,
  );

  // summary
  const summary = await mockApi.getSummary(meeting.id);
  console.log(
    `✓ summary (${summary.template}/${summary.generated_by}): sections = ${summary.sections.map((s) => `${s.heading}(${s.items.length})`).join(", ")}`,
  );

  // AskFred — scoped
  const pricingMeeting = (await mockApi.listMeetings({ q: "Acme" })).items[0];
  const when = await mockApi.sendChat(pricingMeeting.id, "When was pricing discussed?");
  console.log(`✓ AskFred (scoped): "${when.answer.slice(0, 90)}…"`);
  console.log(`  citations: ${when.citations.map((c) => `${c.speaker} @ ${Math.round(c.start_ms / 1000)}s`).join(" | ")}`);
  const seededThread = await mockApi.getChat(pricingMeeting.id);
  console.log(`✓ seeded chat thread: ${seededThread.length} messages (incl. generated replies)`);

  // AskFred — global
  const global = await mockApi.sendChat(null, "What action items do I have?");
  console.log(`✓ AskFred (global): ${global.answer.split("\n").length} lines, ${global.citations.length} citations`);

  // search
  const search = await mockApi.search("pricing");
  console.log(`✓ search "pricing": ${search.meetings.length} meetings + ${search.transcript_matches.length} transcript hits`);

  // create meeting from pasted transcript → processing → ready
  const created = await mockApi.createMeeting({
    title: "Smoke Test Meeting",
    meeting_date: new Date().toISOString(),
    participants: [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }],
    transcript_text: [
      "00:02 Ada Lovelace: Welcome everyone, today we'll plan the analytics launch.",
      "00:15 Grace Hopper: Great, thanks. I'll prepare the dashboard specs by Friday.",
      "00:28 Ada Lovelace: Perfect. What's the timeline for the beta?",
      "00:35 Grace Hopper: The beta is 3 weeks out, and we expect 40% adoption.",
      "00:47 Ada Lovelace: Good. I'll schedule the launch review for next Tuesday.",
    ].join("\n"),
  });
  console.log(`✓ create: id=${created.id} status=${created.status}`);
  await new Promise((r) => setTimeout(r, 3000)); // wait for simulated processing
  const processed = await mockApi.getMeeting(created.id);
  const processedSummary = await mockApi.getSummary(created.id);
  const processedActions = await mockApi.listActionItems({ meeting_id: created.id });
  console.log(
    `✓ processed: status=${processed.status}, ${processedSummary.sections.map((s) => `${s.heading}(${s.items.length})`).join(", ")}, ${processedActions.length} action items`,
  );

  // action item roundtrip
  const done = await mockApi.updateActionItem(processedActions[0].id, { status: "done" });
  console.log(`✓ action item done: "${done.description.slice(0, 40)}…" → ${done.status}`);

  // exports
  for (const format of ["txt", "md", "srt", "vtt", "json"] as const) {
    const exported = await mockApi.exportMeeting(meeting.id, format);
    console.log(`✓ export ${format}: ${exported.filename} (${exported.content.length} chars)`);
  }

  // engagement roundtrip
  const comment = await mockApi.addComment(meeting.id, "Phase 1 smoke comment", transcript.segments[0].id);
  const bookmark = await mockApi.addBookmark(meeting.id, transcript.segments[1].id, "smoke bookmark");
  const soundbite = await mockApi.addSoundbite(meeting.id, "Smoke bite", transcript.segments[0].start_ms, transcript.segments[0].end_ms);
  console.log(`✓ engagement: comment #${comment.id}, bookmark #${bookmark.id}, soundbite #${soundbite.id}`);

  console.log("\nSmoke test complete — all green ✅");
}

main().catch((err) => {
  console.error("SMOKE FAILED:", err);
  process.exit(1);
});
