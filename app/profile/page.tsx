'use client';

import { useRouter } from 'next/navigation';
import { BsCalendar3, BsGeoAlt, BsPerson } from 'react-icons/bs';
import { FiBell, FiCreditCard, FiHelpCircle, FiShield } from 'react-icons/fi';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  CsvUpload,
  ProfileDetails,
  ProfileHeader,
  SettingsSidebar,
} from '@/components/profile';
import { SpinLoader } from '@/components/shared/SpinLoader';
import { Card } from '@/components/ui/card';
import { useCurrentPessoa } from '@/lib/hooks/pessoas';
import { useAuth } from '@/lib/hooks/sessoes/use-auth';
import { getFormattedDate } from '@/lib/utils/get-formatted-date';

function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayHasPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!birthdayHasPassed) {
    age -= 1;
  }
  return age;
}

function formatBirthDate(birthDate: string): string {
  const [year, month, day] = birthDate.split('-');
  return `${day}/${month}/${year}`;
}

function ProfileContent() {
  const { logout, isLoggingOut } = useAuth();
  const { data: pessoa, isLoading, isError } = useCurrentPessoa();
  const router = useRouter();

  const settingsItems = [
    {
      icon: <FiCreditCard className='text-[#808088]' size={20} />,
      title: 'Minhas contas',
      subtitle: 'Todas as suas contas em um só lugar',
      onClick: () => router.push('/contas'),
    },
    {
      icon: <FiBell className='text-[#808088]' size={20} />,
      title: 'Notificações e alertas',
      subtitle: 'Lembre-se sempre dos seus objetivos',
      onClick: () => router.push('/notificacoes'),
    },
    {
      icon: <FiShield className='text-[#808088]' size={20} />,
      title: 'Segurança',
      subtitle: 'Senhas, dados sensíveis e detalhes',
      onClick: () => router.push('/seguranca'),
    },
    {
      icon: <FiHelpCircle className='text-[#808088]' size={20} />,
      title: 'Ajuda',
      subtitle: 'Conte conosco para tirar suas dúvidas',
      onClick: () => router.push('/ajuda'),
    },
  ];

  if (isLoading) {
    return (
      <div className='flex min-h-[420px] items-center justify-center gap-3 text-slate-600'>
        <SpinLoader />
        <span>Carregando perfil...</span>
      </div>
    );
  }

  if (isError || !pessoa) {
    return (
      <div className='flex min-h-[420px] items-center justify-center px-6 text-center text-slate-600'>
        Não foi possível carregar o perfil.
      </div>
    );
  }

  const profileLeftItems = [
    {
      icon: <BsPerson className='text-accent' size={20} />,
      label: 'Gênero',
      value: pessoa.genero,
    },
    {
      icon: <BsCalendar3 className='text-accent' size={20} />,
      label: 'Data de nascimento',
      value: formatBirthDate(pessoa.data_nascimento),
    },
  ];

  const profileRightItems = [
    {
      icon: <BsGeoAlt className='text-accent' size={20} />,
      label: 'Cidade e estado',
      value: `${pessoa.cidade}, ${pessoa.estado}`,
    },
  ];

  return (
    <div className='bg-slate-50'>
      <div className='mx-auto max-w-[1440px] px-6 py-4 pb-32'>
        <div className='mb-6'>
          <p
            className='mb-1 text-base font-normal text-muted'
            style={{ fontFamily: 'DM Sans' }}
          >
            {getFormattedDate(new Date())}
          </p>
          <h1 className='text-3xl font-semibold text-slate-900'>
            Perfil Finker
          </h1>
        </div>

        <div className='flex flex-col items-start gap-6 lg:flex-row'>
          <div className='flex-1 space-y-6'>
            <Card className='bg-white p-6 shadow-sm'>
              <ProfileHeader
                nome={pessoa.nome}
                idade={calculateAge(pessoa.data_nascimento)}
                email={pessoa.email}
                telefone={pessoa.telefone}
              />
              <div className='mb-6 border-t border-border' />
              <ProfileDetails
                leftItems={profileLeftItems}
                rightItems={profileRightItems}
              />
            </Card>

            <CsvUpload />
          </div>

          <div className='w-full lg:w-96'>
            <SettingsSidebar
              settingsItems={settingsItems}
              onLogout={logout}
              onSwitchAccount={logout}
            />
            {isLoggingOut && (
              <p className='mt-3 text-center text-sm text-slate-600'>
                Encerrando sessão...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
