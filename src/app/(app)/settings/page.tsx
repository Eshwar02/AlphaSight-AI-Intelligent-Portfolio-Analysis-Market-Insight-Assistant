'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function SettingsView() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setEmail(user?.email || '');
      setName(user?.user_metadata?.full_name || '');
    });
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="bg-gray-50 dark:bg-dark-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-100">
          <SettingsIcon className="h-6 w-6 text-accent-green" />
          Settings
        </h1>

        <div className="rounded-xl border border-dark-700 bg-dark-800 p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-100">Profile</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-gray-300">
              <User className="mt-0.5 h-4 w-4 text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Name</p>
                <p>{name || 'Not set'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-300">
              <Mail className="mt-0.5 h-4 w-4 text-dark-400" />
              <div>
                <p className="text-xs text-dark-400">Email</p>
                <p>{email || 'Not available'}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-dark-700 pt-4">
            <Button
              variant="danger"
              loading={signingOut}
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsView />;
}
