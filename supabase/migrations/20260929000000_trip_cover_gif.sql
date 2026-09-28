-- Trip covers may now be an animated GIF (kept animated, not flattened to a static
-- JPEG). Receipts are unaffected -- they're still always a flattened photo.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/gif')
where id = 'trip-covers' and not ('image/gif' = any(allowed_mime_types));
