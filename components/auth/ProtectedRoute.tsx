'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/sessoes';
import { SpinLoader } from '../shared/SpinLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    if (isMounted && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isMounted, isAuthenticated, isLoading, router]);

  // ✅ Durante SSR ou carregamento inicial
  if (!isMounted || isLoading) {
    return (
      <div className='container min-h-screen flex items-center justify-center'>
        <SpinLoader />
      </div>
    );
  }

  // ✅ Após carregar, se não autenticado
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};
