-- A space can publish everything in it, or one note shown at the root. The
-- second is what a personal page is: one document, no index above it.
alter table spaces add column blog_note text;
