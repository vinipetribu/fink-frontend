/**
 * Hook para fazer login
 * POST /api/v1/sessoes/login
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { LoginData, LoginResponse } from '@/lib/api/types';

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginData): Promise<LoginResponse> => {
      return api.post<LoginResponse>(API_ENDPOINTS.SESSOES.LOGIN, data);
    },
    onSuccess: (loginResponse) => {
      if (typeof window !== 'undefined') {
        // Impede que dados da conta anterior permaneçam no perfil.
        queryClient.removeQueries();
        localStorage.setItem('authToken', loginResponse.token);
        localStorage.setItem('userId', loginResponse.fk_pessoa_id_pessoa);
        localStorage.setItem('sessionId', String(loginResponse.id_sessao));
      }
    },
    onError: (error) => {
      console.error('Erro ao fazer login:', error);
      // ❌ NÃO limpar token aqui, pois pode não existir
      // Apenas loga o erro
    },
    // ✅ Não tentar novamente em caso de erro
    retry: false,
  });
};
