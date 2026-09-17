'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/sessoes';
import { useCurrentPessoa } from '@/lib/hooks/pessoas';
import { SpinLoader } from '../shared/SpinLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const ProtectedRoute = ({
  children,
  adminOnly = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const {
    data: pessoa,
    isLoading: isLoadingPessoa,
    isFetching: isFetchingPessoa,
    isError: isPessoaError,
  } = useCurrentPessoa({ enabled: adminOnly && isAuthenticated });
  const isCheckingAdmin = adminOnly && (isLoadingPessoa || isFetchingPessoa);
  const isAdmin = !isPessoaError && pessoa?.admin === true;
  const router = useRouter();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    if (!isMounted || isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
    } else if (adminOnly && !isCheckingAdmin && !isAdmin) {
      router.replace('/home');
    }
  }, [
    isMounted,
    isAuthenticated,
    isLoading,
    adminOnly,
    isCheckingAdmin,
    isAdmin,
    router,
  ]);

  // ✅ Durante SSR ou carregamento inicial
  if (!isMounted || isLoading || isCheckingAdmin) {
    return (
      <div className='container min-h-screen flex items-center justify-center'>
        <SpinLoader />
      </div>
    );
  }

  // Só monta o conteúdo após confirmar sessão e o privilégio exigido.
  if (!isAuthenticated || (adminOnly && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
};
