'use client';

import { useQuery } from '@tanstack/react-query';

import { SpinLoader } from '@/components/shared/SpinLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

const EVENT_LABELS = {
  LOGIN_SUCCESS: 'Login realizado',
  LOGIN_FAILURE: 'Falha de login',
  ACCESS_DENIED: 'Acesso negado',
  ADMIN_ACCESS: 'Acesso administrativo',
};

const RESULT_LABELS = {
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
  DENIED: 'Negado',
  ALLOWED: 'Permitido',
};

interface SecurityLog {
  timestamp: string;
  event: keyof typeof EVENT_LABELS;
  result: keyof typeof RESULT_LABELS;
  method: string;
  route: string;
  user_id?: string;
}

export function SecurityLogs() {
  const {
    data: logs,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['security-logs'],
    queryFn: () =>
      api.get<SecurityLog[]>(API_ENDPOINTS.SECURITY_LOGS.LIST, {
        cache: 'no-store',
      }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const errorMessage =
    error && 'status' in error && error.status === 403
      ? 'Acesso negado. Os logs são exclusivos para administradores.'
      : error?.message;

  return (
    <Card className='mt-6 bg-white p-6 shadow-sm'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-4'>
        <h2 className='text-2xl font-semibold text-slate-900'>
          Logs de Segurança
        </h2>
        <Button
          type='button'
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching && <SpinLoader />}
          Atualizar logs
        </Button>
      </div>

      <p className='mb-4 text-sm text-slate-600'>
        Últimos 200 eventos, do mais recente para o mais antigo. Os registros
        ficam em memória e são apagados ao reiniciar o backend.
      </p>

      <div aria-live='polite' aria-busy={isFetching}>
        {errorMessage ? (
          <p
            role='alert'
            className='rounded-md bg-red-50 p-3 text-sm text-red-700'
          >
            {errorMessage}
          </p>
        ) : isPending ? (
          <p className='text-sm text-slate-600'>Carregando logs...</p>
        ) : logs?.length === 0 ? (
          <p className='text-sm text-slate-600'>
            Nenhum evento de segurança registrado nesta execução.
          </p>
        ) : (
          <div className='max-h-[480px] overflow-auto'>
            <table className='w-full text-left text-sm'>
              <caption className='sr-only'>
                Eventos recentes de segurança
              </caption>
              <thead className='sticky top-0 border-b border-slate-200 bg-white text-slate-700'>
                <tr>
                  {[
                    'Data/Hora',
                    'Evento',
                    'Resultado',
                    'Método',
                    'Rota',
                    'Usuário',
                  ].map((column) => (
                    <th
                      key={column}
                      scope='col'
                      className='px-2 py-2 font-medium'
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs?.map((log, index) => (
                  <tr
                    key={`${log.timestamp}-${index}`}
                    className='border-b border-slate-100 text-slate-600'
                  >
                    <td className='whitespace-nowrap px-2 py-2'>
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td
                      className='whitespace-nowrap px-2 py-2'
                      title={log.event}
                    >
                      {EVENT_LABELS[log.event] ?? log.event}
                    </td>
                    <td className='px-2 py-2'>
                      {RESULT_LABELS[log.result] ?? log.result}
                    </td>
                    <td className='px-2 py-2'>{log.method}</td>
                    <td className='px-2 py-2 font-mono'>{log.route}</td>
                    <td className='px-2 py-2 font-mono'>
                      {log.user_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
