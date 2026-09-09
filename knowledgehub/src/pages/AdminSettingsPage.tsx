import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

async function fetchUsers() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, role, team');
  if (error) throw error;
  return data;
}

export default function AdminSettingsPage() {
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Admin</h1>
      <section className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-ink-900 p-5">
        <p className="text-sm font-medium mb-4">Users & roles</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-700/50 dark:text-paper-100/40">
              <th className="pb-2 font-normal">Name</th>
              <th className="pb-2 font-normal">Team</th>
              <th className="pb-2 font-normal">Role</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-black/5 dark:border-white/10">
                <td className="py-2">{u.full_name}</td>
                <td className="py-2 text-ink-700/60 dark:text-paper-100/50">{u.team ?? '—'}</td>
                <td className="py-2 capitalize">{u.role.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-700/40 dark:text-paper-100/30 mt-4">
        Category, keyword, and access-group management follow the same pattern — CRUD tables against
        `categories`, `keywords`, and `access_groups`, guarded by the same RLS policies as everything else.
      </p>
    </div>
  );
}
