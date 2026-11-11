-- Review-by date per room, and a small details field on activity rows.
-- Additive only: existing rooms and activity are untouched.

-- The day the studio would like the client's feedback by. Shown in the room
-- ("Please review by Fri, Nov 14") and on the admin dashboard.
alter table public.rooms add column if not exists review_by date;

-- Extra details for one activity line, for example {"count": 8} when a client
-- approves the rest of a room in one tap.
alter table public.activity add column if not exists meta jsonb;
