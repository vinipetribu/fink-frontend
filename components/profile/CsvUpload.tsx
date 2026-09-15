'use client';

import { FormEvent, useState } from 'react';

import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SpinLoader } from '@/components/shared/SpinLoader';

interface CsvPreviewRow {
  data: string;
  descricao: string;
  valor: string;
}

interface CsvUploadResponse {
  nome_original: string;
  sha256: string;
  quantidade_registros: number;
  previa: CsvPreviewRow[];
}

export function CsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CsvUploadResponse | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo CSV.');
      return;
    }

    setIsUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('arquivo', file);

    try {
      const response = await api.postForm<CsvUploadResponse>(
        API_ENDPOINTS.UPLOADS.CSV,
        formData
      );
      setResult(response);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Não foi possível enviar o arquivo.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className='bg-white p-6 shadow-sm'>
      <div className='mb-5'>
        <h2 className='text-2xl font-semibold text-slate-900'>
          Importar transações
        </h2>
        <p className='mt-1 text-sm text-slate-600'>
          Envie um CSV com as colunas data, descricao e valor.
        </p>
      </div>

      <form className='space-y-4' onSubmit={handleSubmit}>
        <input
          type='file'
          accept='.csv,text/csv'
          disabled={isUploading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError('');
            setResult(null);
          }}
          className='block w-full rounded-md border border-slate-200 p-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white'
        />

        <Button type='submit' disabled={!file || isUploading}>
          {isUploading ? (
            <>
              <SpinLoader />
              Enviando...
            </>
          ) : (
            'Enviar CSV'
          )}
        </Button>
      </form>

      {error && (
        <p className='mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </p>
      )}

      {result && (
        <div className='mt-6 space-y-4' aria-live='polite'>
          <div className='grid gap-3 text-sm sm:grid-cols-2'>
            <div>
              <span className='font-medium text-slate-700'>Arquivo:</span>{' '}
              <span className='text-slate-600'>{result.nome_original}</span>
            </div>
            <div>
              <span className='font-medium text-slate-700'>Registros:</span>{' '}
              <span className='text-slate-600'>
                {result.quantidade_registros}
              </span>
            </div>
            <div className='sm:col-span-2'>
              <span className='font-medium text-slate-700'>SHA-256:</span>
              <p className='mt-1 break-all font-mono text-xs text-slate-600'>
                {result.sha256}
              </p>
            </div>
          </div>

          {result.previa.length > 0 && (
            <div className='overflow-x-auto'>
              <h3 className='mb-2 font-medium text-slate-900'>Prévia</h3>
              <table className='w-full text-left text-sm'>
                <thead className='border-b border-slate-200 text-slate-700'>
                  <tr>
                    <th className='px-2 py-2 font-medium'>Data</th>
                    <th className='px-2 py-2 font-medium'>Descrição</th>
                    <th className='px-2 py-2 font-medium'>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.previa.slice(0, 5).map((row, index) => (
                    <tr
                      key={`${row.data}-${row.descricao}-${index}`}
                      className='border-b border-slate-100 text-slate-600'
                    >
                      <td className='px-2 py-2'>{row.data}</td>
                      <td className='px-2 py-2'>{row.descricao}</td>
                      <td className='px-2 py-2'>{row.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
