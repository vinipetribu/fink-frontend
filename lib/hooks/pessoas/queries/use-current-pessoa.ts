/**
 * Hook para buscar pessoa logada atual
 * Combina useValidateSession e usePessoa para buscar automaticamente
 * os dados da pessoa autenticada
 */

import { useValidateSession } from '@/lib/hooks/sessoes/queries/use-validate-session';
import { usePessoa } from './use-pessoa';

export const useCurrentPessoa = (options?: { enabled?: boolean }) => {
  // Busca a sessão atual para obter o ID da pessoa
  const {
    data: session,
    isLoading: isLoadingSession,
    isFetching: isFetchingSession,
    isError: isSessionError,
  } = useValidateSession();

  // Busca os dados da pessoa usando o ID da sessão
  const {
    data: pessoa,
    isLoading: isLoadingPessoa,
    isFetching: isFetchingPessoa,
    isError: isPessoaError,
    error: pessoaError,
  } = usePessoa(session?.fk_pessoa_id_pessoa ?? '', {
    enabled:
      (options?.enabled ?? true) &&
      !isSessionError &&
      !!session?.fk_pessoa_id_pessoa,
  });

  return {
    data: pessoa,
    isLoading: isLoadingSession || isLoadingPessoa,
    isFetching: isFetchingSession || isFetchingPessoa,
    isError: isSessionError || isPessoaError,
    error: pessoaError,
  };
};
