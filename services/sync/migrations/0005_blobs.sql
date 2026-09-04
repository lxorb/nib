-- Images, addressed by the hash of their contents. The same picture pasted
-- twice, or by two people, is one object in R2; the rows here are what say
-- who is keeping it, so a quota can be counted per account and the object
-- can be dropped once nobody references it any more.
create table blobs (
  hash       text    not null,
  user_id    text    not null references users(id) on delete cascade,
  size       integer not null,
  type       text    not null,
  created_at integer not null,
  primary key (hash, user_id)
);

create index blobs_user on blobs(user_id);
