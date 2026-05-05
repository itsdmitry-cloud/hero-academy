-- Sync shop_items.icon with artifacts.icon.
--
-- Bug: shop showed emoji (🧪 / 🕯️ / ⚗️ / 🔮) but inventory showed PNG icons.
-- After purchase the player thought a different item appeared in the backpack.
--
-- Fix: copy artifacts.icon into shop_items.icon for every linked row that drifted.
-- Going forward, the shop UI also reads artifacts.icon via join (use-shop.ts),
-- so an out-of-sync row will no longer surface in the UI even if it appears.

UPDATE shop_items s
SET icon = a.icon
FROM artifacts a
WHERE s.artifact_id = a.id
  AND s.icon IS DISTINCT FROM a.icon;
