import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: arts } = await supabase.from('artifacts').select('*');
  const issues = [];
  
  arts.forEach(a => {
    if (a.max_charges > 0 && a.duration_days > 0) {
      issues.push(`🔥 КОНФЛИКТ: [${a.name}] имеет и заряд (${a.max_charges}) и срок (${a.duration_days})`);
    }
    const val = Number(a.effect_value) || 0;
    if (val > 1 && a.effect !== 'lootbox' && a.effect !== 'cosmetic') {
      const nums = (a.description || '').match(/\d+/g) || [];
      if (!nums.includes(String(val))) {
        issues.push(`⚠️ Нестыковка: [${a.name}] - значение ${val} (${a.effect}) не упомянуто в описании`);
      }
    }
  });

  console.log("=== НАЙДЕННЫЕ ПРОБЛЕМЫ ===");
  if (issues.length) issues.forEach(i => console.log(i));
  else console.log("Все чисто: артефактов с двойным сроком/зарядом нет. Все цифры в описаниях сходятся с effect_value.");
})();
