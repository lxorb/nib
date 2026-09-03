-- The rail order is the user's, not the database's. Existing rows all get 0
-- and fall back to created_at, which is the order they were already listed in.
alter table spaces add column position integer not null default 0;
