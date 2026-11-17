'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { useCurrentPessoa } from '@/lib/hooks/pessoas';

const root = '/crypto-lab';
const options = { cache: 'no-store' as const, suppressErrorLog: true };
type Envelope = { version: number; algorithm: string; key_id: string; nonce: string; ciphertext: string };
type Toy = { key_id: string; ciphertext: string };
type Job = { status: string; experiment?: string; metrics?: Record<string, unknown>; dataset_id?: string; result_id?: string; metadata?: { window_count: number } };
type Ratio = { value: number | null; numerator: number; denominator: number };
type ModelMetrics = { matrix: number[][]; precision: Ratio; recall: Ratio; f1: Ratio; false_positive_rate: Ratio; FP: number; FN: number; normal_support: number; anomaly_support: number };
type Analysis = { scope: string; partition_sizes: Record<string, number>; methods: Record<string, { threshold: number; partitions: Record<string, ModelMetrics> }> };
const control = 'w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const section = 'scroll-mt-4 bg-white p-5 shadow-sm sm:p-6';
const bytes = (value: string) => new TextEncoder().encode(value).length;

function safeError(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 401) return 'Sessão expirada. Entre novamente.';
  if (status === 403) return 'Acesso restrito a administradores.';
  if (status === 404) return 'Laboratório, trabalho ou resultado indisponível ou expirado.';
  if (status === 413) return 'Entrada acima do limite permitido.';
  if (status === 422) return 'Entrada inválida. Confira os dados e tente novamente.';
  if (status === 429) return 'Limite de requisições atingido. Aguarde antes de tentar novamente.';
  if (status === 503) return 'Laboratório indisponível. Confira a configuração local e tente novamente mais tarde.';
  return 'Não foi possível concluir a operação. Confira a conexão e tente novamente.';
}

function useAction() {
  return useMutation({ mutationFn: async (action: () => Promise<void>) => action(), retry: false, gcTime: 0 });
}

function Feedback({ error, children }: { error: unknown; children?: React.ReactNode }) {
  return <div aria-live='polite'>{error ? <p role='alert' className='mt-3 text-sm text-red-700'>{safeError(error)}</p> : children}</div>;
}

function useJob(path: string) {
  const [id, setId] = useState<string>();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 135000;
    const poll = async () => {
      try {
        const next = await api.get<Job>(`${root}/${path}/${id}`, options);
        if (!active) return;
        setJob(next);
        if (next.status === 'running') {
          if (Date.now() >= deadline) setError(new Error('timeout'));
          else timer = setTimeout(poll, 2500);
        }
      } catch (e) { if (active) setError(e); }
    };
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [id, path]);
  function start(next: string) { setJob({ status: 'running' }); setError(undefined); setId(next); }
  return { job, error, start };
}

function JobState({ job, error }: { job?: Job; error: unknown }) {
  if (error) return <p role='alert' className='mt-3 text-red-700'>O acompanhamento terminou por falha de conexão ou prazo esgotado. O trabalho pode continuar no servidor. Atualize a página antes de iniciar outra execução.</p>;
  if (!job) return <p className='mt-3 text-sm text-slate-500'>Nenhuma execução iniciada.</p>;
  const messages: Record<string, string> = { running: 'Execução em andamento…', completed: 'Execução concluída.', timed_out: 'Prazo esgotado. Resultado inconclusivo.', failed: 'A execução falhou.' };
  return <p className='mt-3 text-sm' role='status'>{messages[job.status] ?? 'Estado desconhecido.'}</p>;
}

function Results({ metrics }: { metrics: Record<string, unknown> }) {
  const blocks = Object.entries(metrics).filter(([, value]) => typeof value === 'number' || typeof value === 'boolean');
  const hist = (metrics.plaintext_bit_flips as { histogram_bits_changed?: number[] } | undefined)?.histogram_bits_changed;
  const frequencies = metrics.byte_counts as number[] | undefined;
  const chart = hist ?? frequencies;
  return <div className='mt-4 space-y-4'>
    <div className='overflow-x-auto'><table className='w-full text-left text-sm'><caption className='sr-only'>Métricas da execução</caption><tbody>{blocks.map(([key, value]) => <tr className='border-b' key={key}><th scope='row' className='py-2 pr-4 font-medium'>{key}</th><td>{String(value)}</td></tr>)}</tbody></table></div>
    {chart && <div><p className='mb-2 text-sm font-medium'>{hist ? 'Distribuição de bits alterados' : 'Frequência de bytes cifrados'}</p><div className='h-56 w-full' role='img' aria-label='Gráfico das métricas observadas'><ResponsiveContainer width='100%' height='100%'><BarChart data={chart.map((value, index) => ({ index, value }))}><CartesianGrid strokeDasharray='3 3' /><XAxis dataKey='index' tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey='value' fill='#7761e8' /></BarChart></ResponsiveContainer></div></div>}
    <details><summary className='cursor-pointer text-sm text-slate-700'>Ver todas as métricas e denominadores</summary><pre className='mt-2 max-h-72 overflow-auto rounded bg-slate-50 p-3 text-xs'>{JSON.stringify(metrics, null, 2)}</pre></details>
  </div>;
}

export function Lab() {
  const { data: pessoa, isLoading: checkingRole } = useCurrentPessoa();
  const isAdmin = pessoa?.admin === true;
  const [text, setText] = useState('');
  const [envelope, setEnvelope] = useState<Envelope>();
  const [recovered, setRecovered] = useState<string>();
  const [toyText, setToyText] = useState('');
  const [toy, setToy] = useState<Toy>();
  const [toyRecovered, setToyRecovered] = useState<string>();
  const [image, setImage] = useState<string>();
  const [pngResult, setPngResult] = useState<string>();
  const [imageError, setImageError] = useState('');
  const [experiment, setExperiment] = useState('brute_force');
  const [analysis, setAnalysis] = useState<Analysis>();
  const [datasetId, setDatasetId] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const [attackCooldown, setAttackCooldown] = useState(0);
  const imageChoice = useRef(0);
  const aesAction = useAction();
  const toyAction = useAction();
  const pngAction = useAction();
  const attackAction = useAction();
  const anomalyAction = useAction();
  const attack = useJob('attacks/runs');
  const anomaly = useJob('anomalies/jobs');
  const [anomalyKind, setAnomalyKind] = useState<'dataset' | 'run'>();

  useEffect(() => {
    if (cooldown <= 0 && attackCooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(value => Math.max(0, value - 1));
      setAttackCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0, attackCooldown > 0]);

  useEffect(() => {
    if (anomaly.job?.status !== 'completed') return;
    if (anomalyKind === 'dataset' && anomaly.job.dataset_id) setDatasetId(anomaly.job.dataset_id);
    if (anomalyKind === 'run' && anomaly.job.result_id) {
      let active = true;
      void api.get<{ result: Analysis }>(`${root}/anomalies/results/${anomaly.job.result_id}`, options)
        .then(value => { if (active) setAnalysis(value.result); })
        .catch(() => { if (active) anomalyAction.mutate(async () => { throw new Error('result'); }); });
      return () => { active = false; };
    }
  }, [anomaly.job, anomalyKind]);

  const selectPng = async (file?: File) => {
    const selection = ++imageChoice.current;
    setImage(undefined); setPngResult(undefined); setImageError('');
    if (!file) return;
    if (file.size > 1048576 || file.size === 0) { setImageError('Selecione um PNG de até 1 MiB.'); return; }
    const data = await file.arrayBuffer();
    if (selection !== imageChoice.current) return;
    const view = new DataView(data);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (data.byteLength < 24 || !signature.every((value, i) => view.getUint8(i) === value) ||
        view.getUint32(16) < 1 || view.getUint32(20) < 1 || view.getUint32(16) > 256 || view.getUint32(20) > 256) {
      setImageError('Selecione um PNG válido com dimensões de até 256 × 256 pixels.'); return;
    }
    const reader = new FileReader();
    reader.onload = () => { if (selection === imageChoice.current && typeof reader.result === 'string') setImage(reader.result.split(',')[1]); };
    reader.onerror = () => setImageError('Não foi possível ler a imagem.');
    reader.readAsDataURL(file);
  };

  return <main className='min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6'>
    <div className='mx-auto max-w-6xl space-y-6'>
      <header><p className='text-sm font-medium text-violet-700'>FINK · SecureAI Lab</p><h1 className='mt-1 text-3xl font-semibold'>Laboratório de segurança</h1><p className='mt-3 max-w-3xl text-sm text-slate-600'>Ambiente local e experimental. Use somente dados fictícios. Os resultados de IA são sintéticos e as chaves e execuções expiram ou desaparecem quando o servidor reinicia.</p></header>
      <nav aria-label='Seções do laboratório' className='flex flex-wrap gap-2 text-sm'>{[['aes','AES'], ['png','Esteganografia'], ...(isAdmin ? [['toy','Cifra didática'], ['attacks','Ataques'], ['anomalies','Anomalias']] : [])].map(([id, name]) => <a key={id} href={`#${id}`} className='rounded-full border border-slate-200 bg-white px-4 py-2 hover:border-violet-500'>{name}</a>)}</nav>
      <div className='grid gap-6 lg:grid-cols-2'>
        <Card id='aes' className={section}><h2 className='text-xl font-semibold'>AES-256-GCM</h2><p className='mt-2 text-sm text-slate-600'>Cifre e recupere uma mensagem fictícia com a mesma conta. O envelope fica nesta página.</p>
          <label className={`${label} mt-4`} htmlFor='aes-text'>Texto fictício</label><textarea id='aes-text' className={control} rows={4} value={text} onChange={e => setText(e.target.value)} /><p className='mt-1 text-xs text-slate-500'>{bytes(text)} / 4.096 bytes UTF-8</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!bytes(text) || bytes(text) > 4096 || aesAction.isPending} onClick={() => aesAction.mutate(async () => { const result = await api.post<{ envelope: Envelope }>(`${root}/encrypt`, { text }, options); setEnvelope(result.envelope); setRecovered(undefined); })}>Cifrar</Button><Button variant='outline' disabled={!envelope || aesAction.isPending} onClick={() => aesAction.mutate(async () => { const result = await api.post<{ text: string }>(`${root}/decrypt`, { envelope }, options); setRecovered(result.text); })}>Recuperar</Button></div>
          <Feedback error={aesAction.error}>{aesAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando…</p> : envelope && <p className='mt-3 text-sm text-emerald-700'>Envelope disponível em memória para recuperação e esteganografia.</p>}</Feedback>{recovered !== undefined && <div className='mt-3 rounded bg-slate-50 p-3'><p className='text-xs font-medium'>Texto recuperado</p><p className='break-words text-sm'>{recovered}</p></div>}
        </Card>
        <Card id='png' className={section}><h2 className='text-xl font-semibold'>Esteganografia PNG</h2><p className='mt-2 text-sm text-slate-600'>Oculte um envelope AES em uma imagem ou extraia um envelope de um PNG. Use a mesma conta que criou a chave.</p>
          <label htmlFor='png-input' className={`${label} mt-4`}>Imagem PNG</label><input id='png-input' className={control} type='file' accept='image/png' onChange={e => void selectPng(e.target.files?.[0])} /><p className='mt-1 text-xs text-slate-500'>Até 1 MiB e 256 × 256 pixels. PNG RGB ou RGBA de 8 ou 16 bits.</p>{imageError && <p role='alert' className='mt-2 text-sm text-red-700'>{imageError}</p>}
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!image || !envelope || pngAction.isPending} onClick={() => pngAction.mutate(async () => { const r = await api.post<{ image_png: string }>(`${root}/steganography/embed`, { image_png: image, envelope }, options); setPngResult(r.image_png); })}>Inserir envelope</Button><Button variant='outline' disabled={!image || pngAction.isPending} onClick={() => pngAction.mutate(async () => { const r = await api.post<{ envelope: Envelope }>(`${root}/steganography/extract`, { image_png: image }, options); setEnvelope(r.envelope); setRecovered(undefined); })}>Extrair envelope</Button></div>
          <Feedback error={pngAction.error}>{pngAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando imagem…</p> : pngAction.isSuccess && <p className='mt-3 text-sm text-emerald-700'>Operação concluída.</p>}</Feedback>{pngResult && <a className='mt-3 inline-block text-sm font-medium text-violet-700 underline' href={`data:image/png;base64,${pngResult}`} download='secureai-lab.png'>Baixar PNG gerado</a>}
        </Card>
      </div>
      {checkingRole && <p role='status' className='text-sm'>Verificando permissões…</p>}
      {isAdmin && <>
        <Card id='toy' className={section}><h2 className='text-xl font-semibold'>Cifra didática</h2><p className='mt-2 text-sm text-amber-800'>Cifra insegura e sem autenticação. Use exclusivamente para demonstração com dados fictícios.</p>
          <label className={`${label} mt-4`} htmlFor='toy-text'>Texto fictício</label><textarea id='toy-text' className={control} rows={3} value={toyText} onChange={e => setToyText(e.target.value)} /><p className='mt-1 text-xs text-slate-500'>{bytes(toyText)} / 4.096 bytes UTF-8</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!bytes(toyText) || bytes(toyText) > 4096 || toyAction.isPending} onClick={() => toyAction.mutate(async () => { const r = await api.post<Toy>(`${root}/experimental/run`, { action: 'encrypt', text: toyText }, options); setToy(r); setToyRecovered(undefined); })}>Cifrar</Button><Button variant='outline' disabled={!toy || toyAction.isPending} onClick={() => toyAction.mutate(async () => { const r = await api.post<{ text: string }>(`${root}/experimental/run`, { action: 'decrypt', key_id: toy?.key_id, ciphertext: toy?.ciphertext }, options); setToyRecovered(r.text); })}>Descriptografar</Button></div>
          <Feedback error={toyAction.error}>{toyAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando…</p> : toy && <p className='mt-3 text-sm text-emerald-700'>Resultado disponível em memória.</p>}</Feedback>{toyRecovered !== undefined && <p className='mt-3 break-words rounded bg-slate-50 p-3 text-sm'>{toyRecovered}</p>}
        </Card>
        <Card id='attacks' className={section}><h2 className='text-xl font-semibold'>Ataques controlados</h2><p className='mt-2 text-sm text-slate-600'>Experimentos executados apenas na cifra didática, com amostras internas fictícias.</p>
          <label htmlFor='experiment' className={`${label} mt-4`}>Experimento</label><select id='experiment' className={control} value={experiment} onChange={e => setExperiment(e.target.value)}><option value='brute_force'>Força bruta</option><option value='statistics'>Análise estatística</option><option value='differential'>Análise diferencial</option><option value='avalanche'>Efeito avalanche</option></select>
          <Button className='mt-4' disabled={attackAction.isPending || attack.job?.status === 'running' || attackCooldown > 0} onClick={() => attackAction.mutate(async () => { const r = await api.post<{ run_id: string }>(`${root}/attacks/runs`, { experiment }, options); setAttackCooldown(60); attack.start(r.run_id); })}>Iniciar experimento</Button>{attackCooldown > 0 && <p className='mt-2 text-xs text-slate-500'>Novo início disponível em aproximadamente {attackCooldown} s.</p>}
          <Feedback error={attackAction.error} /><JobState job={attack.job} error={attack.error} />{attack.job?.status === 'completed' && attack.job.metrics && <><p className='mt-3 text-sm font-medium'>Resultado: {({ brute_force: 'Força bruta', statistics: 'Análise estatística', differential: 'Análise diferencial', avalanche: 'Efeito avalanche' } as Record<string, string>)[attack.job.experiment ?? ''] ?? 'Experimento'}</p><Results metrics={attack.job.metrics} /></>}
        </Card>
        <Card id='anomalies' className={section}><h2 className='text-xl font-semibold'>Detecção de anomalias</h2><p className='mt-2 text-sm text-slate-600'>Gere eventos sintéticos e compare os modelos. O resultado não representa desempenho em dados reais.</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={anomalyAction.isPending || anomaly.job?.status === 'running' || cooldown > 0 || !!datasetId} onClick={() => anomalyAction.mutate(async () => { const r = await api.post<{ job_id: string }>(`${root}/anomalies/datasets`, { profile: 'synthetic-security-v1' }, options); setAnalysis(undefined); setAnomalyKind('dataset'); setCooldown(60); anomaly.start(r.job_id); })}>Gerar dataset sintético</Button><Button variant='outline' disabled={!datasetId || anomalyAction.isPending || anomaly.job?.status === 'running' || cooldown > 0} onClick={() => anomalyAction.mutate(async () => { const r = await api.post<{ job_id: string }>(`${root}/anomalies/runs`, { dataset_id: datasetId }, options); setAnalysis(undefined); setAnomalyKind('run'); setCooldown(60); anomaly.start(r.job_id); })}>Executar análise</Button></div>
          {cooldown > 0 && <p className='mt-2 text-xs text-slate-500'>Próxima execução disponível em aproximadamente {cooldown} s.</p>}<Feedback error={anomalyAction.error} /><JobState job={anomaly.job} error={anomaly.error} />{datasetId && <p className='mt-2 text-sm text-emerald-700'>Dataset sintético disponível nesta sessão.</p>}
          {analysis && <div className='mt-5 space-y-5'><p className='text-sm text-slate-600'>Comparação no conjunto de teste sintético · {analysis.partition_sizes.test} janelas</p><div className='grid gap-4 md:grid-cols-2'>{Object.entries(analysis.methods).map(([key, method]) => { const m = method.partitions.test; return <div key={key} className='rounded-lg border border-slate-200 p-4'><h3 className='font-semibold'>{key === 'isolation_forest' ? 'Isolation Forest' : 'Baseline robusto'}</h3><p className='mt-1 text-xs text-slate-500'>Limiar {method.threshold.toFixed(4)} · normais {m.normal_support} · anômalas {m.anomaly_support}</p><table className='mt-3 w-full text-left text-sm'><caption className='mb-1 text-left text-xs'>Matriz de confusão — linhas reais, colunas previstas</caption><thead><tr><th>Real / previsto</th><th>Normal</th><th>Anomalia</th></tr></thead><tbody><tr><th>Normal</th><td>{m.matrix[0][0]}</td><td>{m.matrix[0][1]}</td></tr><tr><th>Anomalia</th><td>{m.matrix[1][0]}</td><td>{m.matrix[1][1]}</td></tr></tbody></table><dl className='mt-3 space-y-1 text-sm'>{[['Precisão',m.precision],['Recall',m.recall],['F1',m.f1],['Taxa de falsos positivos',m.false_positive_rate]].map(([name, ratio]) => { const metric = ratio as Ratio; return <div key={name as string} className='flex justify-between gap-3'><dt>{name as string}</dt><dd>{metric.value === null ? 'Indefinido' : `${(metric.value * 100).toFixed(2)}%`} ({metric.numerator}/{metric.denominator})</dd></div>; })}<div className='flex justify-between'><dt>Falsos positivos / negativos</dt><dd>{m.FP} / {m.FN}</dd></div></dl></div>; })}</div></div>}
        </Card>
      </>}
    </div>
  </main>;
}
