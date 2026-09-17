'use client';

import { useState } from 'react';

import { SpinLoader } from '@/components/shared/SpinLoader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type { Pessoa } from '@/lib/api/types';

export default function AdminPessoasPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);

  const listarPessoas = async () => {
    setIsLoading(true);
    setStatus(null);
    setError('');
    setPessoas(null);
    let responseStatus: number | null = null;

    try {
      const response = await api.get<Pessoa[]>(
        `${API_ENDPOINTS.PESSOAS.LIST}/`,
        {
          cache: 'no-store',
          // Exibe o 401 nesta tela; o cliente continua limpando a sessão.
          redirectOnUnauthorized: false,
          onResponse: (httpResponse) => {
            responseStatus = httpResponse.status;
            setStatus(httpResponse.status);
          },
        }
      );
      setPessoas(response);
    } catch (requestError) {
      if (responseStatus === 403) {
        setError('Acesso negado. Esta área é exclusiva para administradores.');
      } else if (responseStatus === 401) {
        setError('Sessão inválida ou expirada.');
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível listar as pessoas.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='mx-auto max-w-[1440px] px-6 py-6 pb-32'>
      <h1 className='mb-6 text-3xl font-semibold text-slate-900'>
        Administração de Pessoas
      </h1>

      <Card className='bg-white p-6 shadow-sm'>
        <p className='mb-4 text-sm text-slate-600'>
          A autorização é decidida pelo backend ao listar as pessoas.
        </p>
        <p className='mb-4 break-all font-mono text-sm text-slate-600'>
          GET /api/v1/pessoas/
        </p>

        <Button type='button' disabled={isLoading} onClick={listarPessoas}>
          {isLoading ? (
            <>
              <SpinLoader />
              Carregando...
            </>
          ) : (
            'Listar pessoas'
          )}
        </Button>

        <div
          className='mt-4 space-y-4'
          aria-live='polite'
          aria-busy={isLoading}
        >
          {status !== null && (
            <p className='font-mono text-sm text-slate-700'>
              Resposta do backend: HTTP {status}
            </p>
          )}

          {error && (
            <p
              role='alert'
              className='rounded-md bg-red-50 p-3 text-sm text-red-700'
            >
              {error}
            </p>
          )}

          {pessoas !== null && (
            <>
              <p className='text-sm text-slate-600'>
                Pessoas retornadas: {pessoas.length}
              </p>
              {pessoas.length === 0 ? (
                <p className='text-sm text-slate-600'>
                  Nenhuma pessoa encontrada.
                </p>
              ) : (
                <div className='overflow-x-auto'>
                  <table className='w-full text-left text-sm'>
                    <caption className='sr-only'>
                      Pessoas retornadas pelo backend
                    </caption>
                    <thead className='border-b border-slate-200 text-slate-700'>
                      <tr>
                        <th scope='col' className='px-2 py-2 font-medium'>
                          ID
                        </th>
                        <th scope='col' className='px-2 py-2 font-medium'>
                          Nome
                        </th>
                        <th scope='col' className='px-2 py-2 font-medium'>
                          E-mail
                        </th>
                        <th scope='col' className='px-2 py-2 font-medium'>
                          Perfil
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pessoas.map((pessoa) => (
                        <tr
                          key={pessoa.id_pessoa ?? pessoa.email}
                          className='border-b border-slate-100 text-slate-600'
                        >
                          <td className='px-2 py-2'>
                            {pessoa.id_pessoa ?? '—'}
                          </td>
                          <td className='px-2 py-2'>{pessoa.nome}</td>
                          <td className='px-2 py-2'>{pessoa.email}</td>
                          <td className='px-2 py-2'>
                            {pessoa.admin ? 'ADMIN' : 'USER'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
