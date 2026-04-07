const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAvatarTrigger() {
  console.log('Creating sync_avatar function and trigger...');

  const sql = `
CREATE OR REPLACE FUNCTION sync_hero_avatar()
RETURNS trigger AS $$
DECLARE
  v_avatar text;
  v_tier int;
BEGIN
  -- Only run if level or gender changed (or on insert)
  IF TG_OP = 'INSERT' OR OLD.level IS DISTINCT FROM NEW.level OR OLD.gender IS DISTINCT FROM NEW.gender THEN
    -- Calculate avatar tier: Math.min(20, Math.max(1, Math.floor(hero.level / 5) + 1))
    v_tier := LEAST(20, GREATEST(1, FLOOR(NEW.level / 5) + 1));
    
    -- Format like: /assets/avatars/m_02.png
    v_avatar := '/assets/avatars/' || 
                CASE WHEN NEW.gender = 'female' THEN 'f' ELSE 'm' END || 
                '_' || 
                LPAD(v_tier::text, 2, '0') || 
                '.png';
                
    -- Update users table
    UPDATE users SET avatar_url = v_avatar WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_hero_avatar ON heroes;
CREATE TRIGGER tr_sync_hero_avatar
  AFTER INSERT OR UPDATE OF level, gender
  ON heroes
  FOR EACH ROW
  EXECUTE FUNCTION sync_hero_avatar();
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });
  
  if (error) {
    if (error.message.includes('Could not find the function')) {
      console.error('No exec_sql RPC available. I will run the sql directly using the pg connection pool.');
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(sql);
      console.log('Trigger created via direct pg pool.');
      await pool.end();
    } else {
      console.error('Error creating trigger:', error);
    }
  } else {
    console.log('Trigger created successfully via RPC.');
  }
}

addAvatarTrigger().catch(console.error);
