'use client';

import { ChatPanel } from '@/components/chat/chat-panel';
import { useAppStore } from '@/stores/app-store';
import { PortfolioView } from './portfolio/page';
import { DailyBriefView } from './daily-brief/page';
import { WatchlistView } from './watchlist/page';
import { SettingsView } from './settings/page';

export default function MainAppPage() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <>
      {activeView === 'chat' && <ChatPanel />}
      {activeView === 'portfolio' && <PortfolioView />}
      {activeView === 'brief' && <DailyBriefView />}
      {activeView === 'watchlist' && <WatchlistView />}
      {activeView === 'settings' && <SettingsView />}
    </>
  );
}
