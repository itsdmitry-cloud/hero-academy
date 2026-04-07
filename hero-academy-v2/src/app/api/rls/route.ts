import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  const log: string[] = [];

  const tables = ['schools', 'classes', 'users', 'heroes', 'hero_stats', 'quests', 'quest_submissions',
    'hero_artifacts', 'artifact_catalog', 'shop_items', 'seasons', 'activity_log', 'boss_events',
    'boss_participants', 'news', 'parent_links'];

  // Step 1: Enable RLS on all tables (idempotent)
  for (const table of tables) {
    const { error } = await admin.rpc('exec_sql', {
      sql: `ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY;`
    });
    // rpc might not exist, fall back to raw
    if (error) {
      // Try direct approach
    }
  }

  // Step 2: Run all RLS policies via raw SQL
  // We use supabase-js admin to run SQL through the REST API
  // Since supabase-js doesn't have raw SQL, we'll use fetch directly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const sqlStatements = `
    -- ============================================================
    -- RLS POLICIES FOR HERO ACADEMY
    -- Run with service_role key
    -- ============================================================

    -- Drop all existing policies first (clean slate)
    DO $$ 
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
      ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      END LOOP;
    END $$;

    -- ============================================================
    -- SCHOOLS
    -- ============================================================
    ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
    
    -- Everyone can read schools
    CREATE POLICY "schools_select_all" ON public.schools
      FOR SELECT USING (true);
    
    -- Admins can do everything
    CREATE POLICY "schools_admin_all" ON public.schools
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- CLASSES
    -- ============================================================
    ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
    
    -- Everyone can read classes
    CREATE POLICY "classes_select_all" ON public.classes
      FOR SELECT USING (true);
    
    -- Admins can do everything
    CREATE POLICY "classes_admin_all" ON public.classes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- Teachers can read classes in their school
    CREATE POLICY "classes_teacher_select" ON public.classes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND users.role = 'teacher' 
          AND users.school_id = classes.school_id
        )
      );

    -- ============================================================
    -- USERS (profiles)
    -- ============================================================
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Users can read their own profile
    CREATE POLICY "users_select_own" ON public.users
      FOR SELECT USING (id = auth.uid());
    
    -- Users can update their own profile
    CREATE POLICY "users_update_own" ON public.users
      FOR UPDATE USING (id = auth.uid());
    
    -- Teachers can read students in their school
    CREATE POLICY "users_teacher_read_students" ON public.users
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users AS teacher 
          WHERE teacher.id = auth.uid() 
          AND teacher.role = 'teacher' 
          AND teacher.school_id = users.school_id
        )
      );
    
    -- Admins can do everything
    CREATE POLICY "users_admin_all" ON public.users
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users AS u WHERE u.id = auth.uid() AND u.role = 'admin')
      );
    
    -- Parents can read their linked children
    CREATE POLICY "users_parent_read_children" ON public.users
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.parent_links 
          WHERE parent_links.parent_id = auth.uid() 
          AND parent_links.student_id = users.id
        )
      );

    -- ============================================================
    -- HEROES
    -- ============================================================
    ALTER TABLE public.heroes ENABLE ROW LEVEL SECURITY;
    
    -- Users can read their own hero
    CREATE POLICY "heroes_select_own" ON public.heroes
      FOR SELECT USING (user_id = auth.uid());
    
    -- Users can update their own hero
    CREATE POLICY "heroes_update_own" ON public.heroes
      FOR UPDATE USING (user_id = auth.uid());
    
    -- Teachers can read heroes of students in their school
    CREATE POLICY "heroes_teacher_read" ON public.heroes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users AS student 
          JOIN public.users AS teacher ON teacher.school_id = student.school_id
          WHERE student.id = heroes.user_id 
          AND teacher.id = auth.uid() 
          AND teacher.role = 'teacher'
        )
      );
    
    -- Teachers can update heroes (grant XP, damage HP)
    CREATE POLICY "heroes_teacher_update" ON public.heroes
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.users AS student 
          JOIN public.users AS teacher ON teacher.school_id = student.school_id
          WHERE student.id = heroes.user_id 
          AND teacher.id = auth.uid() 
          AND teacher.role = 'teacher'
        )
      );
    
    -- Admins can do everything
    CREATE POLICY "heroes_admin_all" ON public.heroes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
    
    -- Parents can read their children's heroes
    CREATE POLICY "heroes_parent_read" ON public.heroes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.parent_links 
          WHERE parent_links.parent_id = auth.uid() 
          AND parent_links.student_id = heroes.user_id
        )
      );

    -- ============================================================
    -- HERO_STATS
    -- ============================================================
    ALTER TABLE public.hero_stats ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "hero_stats_select_own" ON public.hero_stats
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.heroes WHERE heroes.id = hero_stats.hero_id AND heroes.user_id = auth.uid())
      );
    
    CREATE POLICY "hero_stats_teacher_read" ON public.hero_stats
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.heroes 
          JOIN public.users AS student ON student.id = heroes.user_id
          JOIN public.users AS teacher ON teacher.school_id = student.school_id
          WHERE heroes.id = hero_stats.hero_id 
          AND teacher.id = auth.uid() 
          AND teacher.role = 'teacher'
        )
      );
    
    CREATE POLICY "hero_stats_admin_all" ON public.hero_stats
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- QUESTS
    -- ============================================================
    ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
    
    -- Students can read quests for their class
    CREATE POLICY "quests_student_read" ON public.quests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND users.class_id = quests.class_id
        )
      );
    
    -- Teachers can CRUD quests for their school's classes
    CREATE POLICY "quests_teacher_all" ON public.quests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.classes 
          JOIN public.users AS teacher ON teacher.school_id = classes.school_id
          WHERE classes.id = quests.class_id 
          AND teacher.id = auth.uid() 
          AND teacher.role = 'teacher'
        )
      );
    
    CREATE POLICY "quests_admin_all" ON public.quests
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- QUEST_SUBMISSIONS
    -- ============================================================
    ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "submissions_student_own" ON public.quest_submissions
      FOR ALL USING (student_id = auth.uid());
    
    CREATE POLICY "submissions_teacher_read" ON public.quest_submissions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users AS student
          JOIN public.users AS teacher ON teacher.school_id = student.school_id
          WHERE student.id = quest_submissions.student_id
          AND teacher.id = auth.uid()
          AND teacher.role = 'teacher'
        )
      );
    
    CREATE POLICY "submissions_admin_all" ON public.quest_submissions
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- ARTIFACT_CATALOG (read-only for all authenticated)
    -- ============================================================
    ALTER TABLE public.artifact_catalog ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "artifact_catalog_read_all" ON public.artifact_catalog
      FOR SELECT USING (true);
    
    CREATE POLICY "artifact_catalog_admin_all" ON public.artifact_catalog
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- HERO_ARTIFACTS
    -- ============================================================
    ALTER TABLE public.hero_artifacts ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "hero_artifacts_own" ON public.hero_artifacts
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.heroes WHERE heroes.id = hero_artifacts.hero_id AND heroes.user_id = auth.uid())
      );
    
    CREATE POLICY "hero_artifacts_admin_all" ON public.hero_artifacts
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- SHOP_ITEMS (read-only for all authenticated)
    -- ============================================================
    ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "shop_items_read_all" ON public.shop_items
      FOR SELECT USING (true);
    
    CREATE POLICY "shop_items_admin_all" ON public.shop_items
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- SEASONS
    -- ============================================================
    ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "seasons_read_all" ON public.seasons
      FOR SELECT USING (true);
    
    CREATE POLICY "seasons_admin_all" ON public.seasons
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- ACTIVITY_LOG
    -- ============================================================
    ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "activity_log_own" ON public.activity_log
      FOR SELECT USING (hero_id IN (SELECT id FROM public.heroes WHERE user_id = auth.uid()));
    
    CREATE POLICY "activity_log_insert" ON public.activity_log
      FOR INSERT WITH CHECK (true);
    
    CREATE POLICY "activity_log_teacher_read" ON public.activity_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.heroes 
          JOIN public.users AS student ON student.id = heroes.user_id
          JOIN public.users AS teacher ON teacher.school_id = student.school_id
          WHERE heroes.id = activity_log.hero_id
          AND teacher.id = auth.uid()
          AND teacher.role = 'teacher'
        )
      );
    
    CREATE POLICY "activity_log_admin_all" ON public.activity_log
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- BOSS_EVENTS
    -- ============================================================
    ALTER TABLE public.boss_events ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "boss_events_read_all" ON public.boss_events
      FOR SELECT USING (true);
    
    CREATE POLICY "boss_events_teacher_all" ON public.boss_events
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'teacher')
      );
    
    CREATE POLICY "boss_events_admin_all" ON public.boss_events
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- BOSS_PARTICIPANTS
    -- ============================================================
    ALTER TABLE public.boss_participants ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "boss_participants_read_all" ON public.boss_participants
      FOR SELECT USING (true);
    
    CREATE POLICY "boss_participants_student_insert" ON public.boss_participants
      FOR INSERT WITH CHECK (student_id = auth.uid());
    
    CREATE POLICY "boss_participants_admin_all" ON public.boss_participants
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- NEWS
    -- ============================================================
    ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "news_read_all" ON public.news
      FOR SELECT USING (true);
    
    CREATE POLICY "news_admin_all" ON public.news
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );

    -- ============================================================
    -- PARENT_LINKS
    -- ============================================================
    ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "parent_links_own" ON public.parent_links
      FOR SELECT USING (parent_id = auth.uid() OR student_id = auth.uid());
    
    CREATE POLICY "parent_links_admin_all" ON public.parent_links
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
      );
  `;

  // Execute via Supabase REST SQL endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sql: sqlStatements }),
  });

  // If rpc doesn't exist, try the SQL endpoint directly
  if (!response.ok) {
    // Use the pg_net or direct SQL approach
    // Supabase provides a SQL endpoint at /pg/query for service role
    const sqlResponse = await fetch(`${supabaseUrl}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sqlStatements }),
    });

    if (!sqlResponse.ok) {
      // Last resort: execute individual statements via supabase admin client
      log.push('RPC and PG endpoints not available, using individual table approach');
      
      // Disable RLS entirely on all tables as a workaround
      // This is safe because we're using service role key
      for (const table of tables) {
        try {
          const { error } = await admin.from(table).select('*').limit(0);
          if (error) {
            log.push(`Table ${table}: ${error.message}`);
          } else {
            log.push(`Table ${table}: accessible`);
          }
        } catch {
          log.push(`Table ${table}: not found`);
        }
      }
      
      // Since we can't run raw SQL through the API, 
      // let's disable RLS on critical tables
      log.push('⚠️ Cannot run SQL via API. Please run the SQL manually in Supabase SQL Editor.');
      log.push('Alternatively, disable RLS on the tables via Supabase Dashboard.');
      
      return NextResponse.json({ 
        success: false, 
        message: 'Cannot run SQL via REST API. Use the SQL below in Supabase SQL Editor.',
        sql: sqlStatements,
        log 
      });
    }
    
    log.push('✅ RLS policies applied via PG endpoint');
  } else {
    log.push('✅ RLS policies applied via RPC');
  }

  return NextResponse.json({ success: true, message: '✅ RLS policies configured!', log });
}
