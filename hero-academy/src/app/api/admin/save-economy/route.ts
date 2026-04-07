import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Uses service role to bypass RLS on economy_config
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { config, scope, scopeId, changedBy, scopeLabel } = await req.json();

  if (!config || !scope) {
    return NextResponse.json({ error: 'config and scope required' }, { status: 400 });
  }

  const key = scope === 'global' ? 'scope_global'
    : scope === 'school' ? `scope_school_${scopeId}`
    : `scope_class_${scopeId}`;

  // Read current value before overwriting (for audit)
  const { data: existing } = await admin
    .from('economy_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  const oldValue = existing?.value ?? null;

  // Upsert new config
  const { error } = await admin
    .from('economy_config')
    .upsert({ key, value: config }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write audit log (fire-and-forget)
  const label = scopeLabel ?? (scope === 'global' ? 'Глобально' : scope === 'school' ? `Школа` : `Класс`);
  Promise.resolve(
    admin.from('economy_audit_log').insert({
      scope_key:   key,
      scope_label: label,
      old_value:   oldValue,
      new_value:   config,
      changed_by:  changedBy ?? 'admin',
    })
  ).catch(() => {});

  return NextResponse.json({ success: true, key });
}
