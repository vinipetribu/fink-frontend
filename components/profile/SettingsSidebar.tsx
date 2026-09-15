// SettingsSidebar.tsx
import { Card } from '@/components/ui/card';
import { SettingsItem } from './SettingsItem';
import { FiRefreshCw, FiLogOut } from 'react-icons/fi';

interface SettingsSidebarProps {
  settingsItems: Array<{
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }>;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

export function SettingsSidebar({
  settingsItems,
  onLogout,
  onSwitchAccount,
}: SettingsSidebarProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="mb-1 text-2xl font-semibold text-slate-900">
            Configurações
          </h3>
          <p className="text-sm text-slate-600">
            Personalize sua gestão financeira
          </p>
        </div>

        <div className="space-y-3">
          {settingsItems.map((item) => (
            <SettingsItem key={item.title} {...item} />
          ))}
        </div>
      </Card>

      <Card className="bg-white p-6 shadow-sm">
        <button
          onClick={onSwitchAccount}
          className='flex w-full items-center gap-3 py-2 text-left text-sm text-slate-900 transition-opacity hover:opacity-70'
        >
          <FiRefreshCw className='text-slate-900' size={20} />
          <span>Trocar de conta</span>
        </button>

        <div className="my-4 border-t border-[#E7EBEE]" />

        <button
          onClick={onLogout}
          className='flex w-full items-center gap-3 py-2 text-left text-sm text-red-600 transition-opacity hover:opacity-70'
        >
          <FiLogOut className='text-red-600' size={20} />
          <span>Sair</span>
        </button>
      </Card>
    </div>
  );
}
