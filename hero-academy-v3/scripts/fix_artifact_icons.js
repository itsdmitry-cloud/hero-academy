require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Map from artifact name to actual file in /assets/artifacts/
const iconMap = {
  'Guardian Shield': '/assets/artifacts/rar_shield.png',
  'Gold Pouch': '/assets/artifacts/rar_pouch.png',
  'Midnight Candle': '/assets/artifacts/rar_candle.png',
  'Quill of Wisdom': '/assets/artifacts/rar_pen.png',
  'Hero Crown': '/assets/artifacts/leg_crown.png',
  'Dragon Orb': '/assets/artifacts/epi_orb.png',
  'Crystal Ball': '/assets/artifacts/epi_crystal.png',
  'Scroll of Power': '/assets/artifacts/epi_scroll.png',
  'Ancient Amulet': '/assets/artifacts/rar_amulet.png',
  'Shield of Endurance': '/assets/artifacts/epi_shield.png',
  'Lucky Ring': '/assets/artifacts/com_ring.png',
  'Ring of Power': '/assets/artifacts/epi_ring.png',
  'Cloak of Speed': '/assets/artifacts/com_magnet.png',
  'Elixir of Focus': '/assets/artifacts/rar_focus.png',
  "Scholar's Elixir": '/assets/artifacts/rar_elixir.png',
  'Common Potion': '/assets/artifacts/com_potion.png',
  'Rare Potion': '/assets/artifacts/rar_potion.png',
  'Epic Potion': '/assets/artifacts/epi_potion.png',
  'Ink of Insight': '/assets/artifacts/com_ink.png',
  'Scroll of Fortune': '/assets/artifacts/com_scroll.png',
  'Runic Stone': '/assets/artifacts/epi_rune.png',
  'Armored Cloak': '/assets/artifacts/rar_cloak.png',
  'Coin of Luck': '/assets/artifacts/com_coin.png',
  'Parchment of Knowledge': '/assets/artifacts/com_parchment.png',
  'Legendary Staff': '/assets/artifacts/leg_staff.png',
  'Hourglass': '/assets/artifacts/leg_hourglass.png',
  'Legendary Scroll': '/assets/artifacts/leg_scroll.png',
  'Dragon Heart': '/assets/artifacts/leg_dragon.png',
  'Legendary Aegis': '/assets/artifacts/leg_aegis.png',
};

(async () => {
  const { data: artifacts } = await supabase.from('artifacts').select('id, name, icon');
  if (!artifacts) { console.log('no artifacts'); return; }
  
  let updated = 0;
  for (const art of artifacts) {
    const newIcon = iconMap[art.name];
    if (newIcon && newIcon !== art.icon) {
      const { error } = await supabase.from('artifacts').update({ icon: newIcon }).eq('id', art.id);
      if (!error) { console.log(`Updated ${art.name}: ${newIcon}`); updated++; }
      else console.error(`Error updating ${art.name}:`, error.message);
    } else if (!newIcon) {
      console.warn(`No icon mapping for: ${art.name} (current: ${art.icon})`);
    }
  }
  console.log(`\nUpdated ${updated} artifacts.`);
})();
