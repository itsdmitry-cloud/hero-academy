import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL = 'admin@hero.academy';
const PASSWORD = 'Admin123!';

async function main() {
  console.log('🔧 Creating admin user...');

  // Check if already exists
  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users?.find(u => u.email === EMAIL);

  let userId;

  if (existing) {
    console.log('ℹ️  Auth user already exists:', existing.id);
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'Администратор' },
    });
    if (error) { console.error('❌ Failed to create auth user:', error.message); process.exit(1); }
    userId = data.user.id;
    console.log('✅ Auth user created:', userId);
  }

  // Upsert into users table
  const { error: uErr } = await supabase.from('users').upsert({
    id: userId,
    display_name: 'Администратор',
    role: 'admin',
  }, { onConflict: 'id' });

  if (uErr) console.error('⚠️  users table insert error:', uErr.message);
  else console.log('✅ User row created in users table.');

  console.log('\n════════════════════════════════');
  console.log('  📧 Email:    ' + EMAIL);
  console.log('  🔑 Password: ' + PASSWORD);
  console.log('  🌐 URL:      http://localhost:3000/auth/login');
  console.log('  🛡️  Panel:   http://localhost:3000/admin');
  console.log('════════════════════════════════\n');
}

main();
