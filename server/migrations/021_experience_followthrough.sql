ALTER TABLE date_proposals ADD COLUMN IF NOT EXISTS source_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
ALTER TABLE date_proposals ADD COLUMN IF NOT EXISTS replaces_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS capsule_opens (
 capsule_id uuid NOT NULL REFERENCES time_capsules(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 opened_at timestamptz NOT NULL DEFAULT now(),
 reaction text NOT NULL DEFAULT '' CHECK (length(reaction) <= 500),
 PRIMARY KEY(capsule_id,user_id)
);
ALTER TABLE date_proposals ADD COLUMN IF NOT EXISTS is_reschedule boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION sync_accepted_date_proposals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.title IS DISTINCT FROM OLD.title OR NEW.start_at IS DISTINCT FROM OLD.start_at OR NEW.end_at IS DISTINCT FROM OLD.end_at THEN
  UPDATE date_proposals SET title=NEW.title,start_at=NEW.start_at,end_at=COALESCE(NEW.end_at,NEW.start_at+interval '30 minutes'),revision=revision+1,updated_at=now()
   WHERE event_id=NEW.id AND status='accepted';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_accepted_date_proposals ON events;
CREATE TRIGGER sync_accepted_date_proposals AFTER UPDATE ON events FOR EACH ROW EXECUTE FUNCTION sync_accepted_date_proposals();
