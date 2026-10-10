"""SQLite FTS and revision triggers, additive/idempotent and safe on deletion."""

from sqlalchemy.exc import OperationalError


def _invalidate(meeting_id: str) -> str:
    # During cascading meeting deletion the parent is already gone. Never reinsert
    # an orphan state row from a child DELETE trigger.
    return f"""
      INSERT INTO retrieval_states(meeting_id,revision,indexed_revision,profile)
      SELECT {meeting_id},0,-1,'' WHERE EXISTS(SELECT 1 FROM meetings WHERE id={meeting_id})
      ON CONFLICT(meeting_id) DO UPDATE SET revision=revision+1;
    """


def init_retrieval_schema(engine):
    with engine.begin() as conn:
        conn.exec_driver_sql("""INSERT INTO retrieval_states(meeting_id,revision,indexed_revision,profile)
            SELECT id,0,-1,'' FROM meetings WHERE true ON CONFLICT(meeting_id) DO NOTHING""")
        try:
            conn.exec_driver_sql("CREATE VIRTUAL TABLE IF NOT EXISTS retrieval_fts USING fts5(text, tokenize='unicode61')")
            conn.exec_driver_sql("SELECT rowid FROM retrieval_fts LIMIT 0")
        except OperationalError:
            # Only our derived triggers are removed. Original meeting data stays.
            for suffix in ["insert", "delete", "update"]:
                conn.exec_driver_sql(f"DROP TRIGGER IF EXISTS retrieval_fts_{suffix}")
        else:
            for suffix, event, body in [
                ("insert", "AFTER INSERT", "INSERT INTO retrieval_fts(rowid,text) VALUES(NEW.id,NEW.text);"),
                ("delete", "AFTER DELETE", "DELETE FROM retrieval_fts WHERE rowid=OLD.id;"),
                ("update", "AFTER UPDATE OF text", "UPDATE retrieval_fts SET text=NEW.text WHERE rowid=NEW.id;"),
            ]:
                conn.exec_driver_sql(f"CREATE TRIGGER IF NOT EXISTS retrieval_fts_{suffix} {event} ON retrieval_chunks BEGIN {body} END")
            # Backfill derived text if this database previously lacked FTS support.
            conn.exec_driver_sql("""INSERT INTO retrieval_fts(rowid,text)
                SELECT id,text FROM retrieval_chunks WHERE id NOT IN(SELECT rowid FROM retrieval_fts)""")

        specs = [
            ("meetings", "insert", "AFTER INSERT", "NEW.id"),
            ("meetings", "update", "AFTER UPDATE OF title,meeting_date,status,is_deleted", "NEW.id"),
        ]
        for table in ["transcript_segments", "participants", "summaries"]:
            for event, row in [("insert", "NEW"), ("update", "NEW"), ("delete", "OLD")]:
                specs.append((table, event, f"AFTER {event.upper()}", f"{row}.meeting_id"))
        for table in ["summary_sections", "summary_items"]:
            for event, row in [("insert", "NEW"), ("update", "NEW"), ("delete", "OLD")]:
                mid = (f"(SELECT meeting_id FROM summaries WHERE id={row}.summary_id)" if table == "summary_sections" else
                       f"(SELECT s.meeting_id FROM summaries s JOIN summary_sections b ON b.summary_id=s.id WHERE b.id={row}.section_id)")
                specs.append((table, event, f"AFTER {event.upper()}", mid))
        for table, name, event, mid in specs:
            body = _invalidate(mid)
            if name == "update" and table != "meetings":
                body += _invalidate(mid.replace("NEW.", "OLD."))
            conn.exec_driver_sql(f"CREATE TRIGGER IF NOT EXISTS retrieval_revision_{table}_{name} {event} ON {table} BEGIN {body} END")
