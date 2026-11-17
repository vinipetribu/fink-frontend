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
type Job = { status: string; experiment?: string; metrics?: Record<string, unknown>; dataset_id?: string; result_id?: string; metadata?: { window_count: number; event_count: number } };
type Ratio = { value: number | null; numerator: number; denominator: number };
type ModelMetrics = { matrix: number[][]; precision: Ratio; recall: Ratio; f1: Ratio; false_positive_rate: Ratio; FP: number; FN: number; normal_support: number; anomaly_support: number; TP: number; families: Record<string, { support: number; detected: number }> };
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

type Difference = { pairs: number; mean_percent: number; min_percent: number; max_percent: number; population_stddev_percent: number; histogram_bits_changed: number[] };
function Results({ metrics, experiment }: { metrics: Record<string, unknown>; experiment?: string }) {
  const number = (key: string) => typeof metrics[key] === 'number' ? (metrics[key] as number).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—';
  const plain = metrics.plaintext_bit_flips as Difference | undefined;
  const key = metrics.key_bit_flips as Difference | undefined;
  const groups = metrics.groups as Record<string, { mean_repeated_fraction: number; per_key: { total_blocks: number; distinct_blocks: number; repeated_excess: number }[] }> | undefined;
  const frequencies = metrics.byte_counts as number[] | undefined;
  const histogram = experiment === 'statistics' ? frequencies : plain?.histogram_bits_changed;
  return <div className='mt-4 space-y-4 text-sm'>
    {experiment === 'brute_force' && <dl className='grid gap-2 sm:grid-cols-2'><div>Espaço de chaves: {number('key_space')}</div><div>Tentativas: {number('attempts')}</div><div>Duração: {number('duration_seconds')} s</div><div>Taxa: {number('keys_per_second')} chaves/s</div><div>Candidatos no primeiro par: {number('first_pair_candidates')}</div><div>Candidatos após segundo par: {number('second_pair_candidates')}</div><div>Chave alvo encontrada internamente: {metrics.target_found === true ? 'Sim' : metrics.target_found === false ? 'Não' : '—'}</div></dl>}
    {experiment === 'statistics' && <><p>Blocos iguais sob a mesma chave produzem saídas iguais, expondo padrões. Os valores abaixo são agregados por chave.</p><p>Bytes analisados: {number('byte_denominator')}</p>{groups && <table className='w-full text-left'><caption>Blocos da primeira chave de cada conjunto e fração média entre chaves</caption><thead><tr><th>Conjunto</th><th>Blocos</th><th>Distintos</th><th>Excedentes repetidos</th><th>Fração média</th></tr></thead><tbody>{Object.entries(groups).map(([name, group]) => <tr key={name}><th>{({ repeated: 'Repetidos', distinct: 'Distintos', synthetic: 'Sintéticos' } as Record<string,string>)[name] ?? name}</th><td>{group.per_key[0]?.total_blocks}</td><td>{group.per_key[0]?.distinct_blocks}</td><td>{group.per_key[0]?.repeated_excess}</td><td>{(group.mean_repeated_fraction * 100).toFixed(2)}%</td></tr>)}</tbody></table>}</>}
    {experiment === 'differential' && plain && <p>Um bit da entrada é alterado e as saídas são comparadas pela distância de Hamming. Foram analisados {plain.pairs.toLocaleString('pt-BR')} pares de blocos de 64 bits.</p>}
    {experiment === 'avalanche' && plain && key && <><p>A referência teórica é aproximadamente 50% de bits alterados. Esse valor isoladamente não comprova segurança.</p><table className='w-full text-left'><thead><tr><th>Alteração</th><th>Pares</th><th>Média</th><th>Mínimo</th><th>Máximo</th><th>Desvio-padrão</th></tr></thead><tbody>{[['Plaintext',plain],['Chave',key]].map(([name, d]) => { const v=d as Difference; return <tr key={name as string}><th>{name as string}</th><td>{v.pairs.toLocaleString('pt-BR')}</td><td>{v.mean_percent.toFixed(2)}%</td><td>{v.min_percent.toFixed(2)}%</td><td>{v.max_percent.toFixed(2)}%</td><td>{v.population_stddev_percent.toFixed(2)}%</td></tr>; })}</tbody></table></>}
    {histogram && <div><p className='font-medium'>{experiment === 'statistics' ? 'Frequência de bytes cifrados' : 'Distância de Hamming — alteração no plaintext'}</p><div className='h-56 w-full'><ResponsiveContainer width='100%' height='100%'><BarChart data={histogram.map((value,index)=>({index,value}))}><CartesianGrid strokeDasharray='3 3'/><XAxis dataKey='index' tick={{fontSize:10}}/><YAxis/><Tooltip/><Bar dataKey='value' fill='#7761e8'/></BarChart></ResponsiveContainer></div></div>}
    {experiment === 'avalanche' && key && <div><p>Distância de Hamming — alteração na chave</p><div className='h-56 w-full'><ResponsiveContainer width='100%' height='100%'><BarChart data={key.histogram_bits_changed.map((value,index)=>({index,value}))}><XAxis dataKey='index'/><YAxis/><Tooltip/><Bar dataKey='value' fill='#2563eb'/></BarChart></ResponsiveContainer></div></div>}
    <details><summary>Dados técnicos completos</summary><pre className='max-h-72 overflow-auto rounded bg-slate-50 p-3 text-xs'>{JSON.stringify(metrics,null,2)}</pre></details>
  </div>;
}

export function Lab() {
  const { data: pessoa, isLoading: checkingRole } = useCurrentPessoa();
  const isAdmin = pessoa?.admin === true;
  const [tab, setTab] = useState('aes');
  const [original, setOriginal] = useState('');
  const [toyOriginal, setToyOriginal] = useState('');
  const [text, setText] = useState('');
  const [envelope, setEnvelope] = useState<Envelope>();
  const [recovered, setRecovered] = useState<string>();
  const [toyText, setToyText] = useState('');
  const [toy, setToy] = useState<Toy>();
  const [toyRecovered, setToyRecovered] = useState<string>();
  const [image, setImage] = useState<string>();
  const [pngResult, setPngResult] = useState<string>();
  const [imageError, setImageError] = useState('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number; size: number }>();
  const [extracted, setExtracted] = useState<Envelope>();
  const [pngRecovered, setPngRecovered] = useState<string>();
  const [experiment, setExperiment] = useState('brute_force');
  const [analysis, setAnalysis] = useState<Analysis>();
  const [datasetId, setDatasetId] = useState<string>();
  const [resultError, setResultError] = useState(false);
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

  const cooldownActive = cooldown > 0 || attackCooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => {
      setCooldown(value => Math.max(0, value - 1));
      setAttackCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  useEffect(() => {
    if (anomaly.job?.status !== 'completed') return;
    if (anomalyKind === 'dataset' && anomaly.job.dataset_id) { const id = anomaly.job.dataset_id; Promise.resolve().then(() => setDatasetId(id)); }
    if (anomalyKind === 'run' && anomaly.job.result_id) {
      let active = true;
      void api.get<{ result: Analysis }>(`${root}/anomalies/results/${anomaly.job.result_id}`, options)
        .then(value => { if (active) setAnalysis(value.result); })
        .catch(() => { if (active) setResultError(true); });
      return () => { active = false; };
    }
  }, [anomaly.job, anomalyKind]);

  const selectPng = async (file?: File) => {
    const selection = ++imageChoice.current;
    setImage(undefined); setPngResult(undefined); setImageError(''); setDimensions(undefined); setExtracted(undefined); setPngRecovered(undefined);
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
    setDimensions({ width: view.getUint32(16), height: view.getUint32(20), size: file.size });
    const reader = new FileReader();
    reader.onload = () => { if (selection === imageChoice.current && typeof reader.result === 'string') setImage(reader.result.split(',')[1]); };
    reader.onerror = () => setImageError('Não foi possível ler a imagem.');
    reader.readAsDataURL(file);
  };

  return <main className='min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6'>
    <div className='mx-auto max-w-6xl space-y-6'>
      <header><p className='text-sm font-medium text-violet-700'>FINK · SecureAI Lab</p><h1 className='mt-1 text-3xl font-semibold'>Laboratório de segurança</h1><p className='mt-3 max-w-3xl text-sm text-slate-600'>Ambiente local e experimental. Use somente dados fictícios. Os resultados de IA são sintéticos e as chaves e execuções expiram ou desaparecem quando o servidor reinicia.</p></header>
      <nav aria-label='Seções do laboratório' className='flex flex-wrap gap-2 text-sm'>{[['aes','AES'], ['png','Esteganografia'], ...(isAdmin ? [['toy','Cifra didática'], ['attacks','Ataques'], ['anomalies','Anomalias']] : [])].map(([id, name]) => <button key={id} type='button' aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded-full border px-4 py-2 ${tab === id ? 'border-violet-600 bg-violet-700 text-white' : 'border-slate-200 bg-white'}`}>{name}</button>)}</nav>
      <div className='grid gap-6'>
        <Card id='aes' hidden={tab !== 'aes'} className={section}><h2 className='text-xl font-semibold'>AES-256-GCM</h2><p className='mt-2 text-sm text-slate-600'>Cifre e recupere uma mensagem fictícia com a mesma conta. O envelope fica nesta página.</p>
          <label className={`${label} mt-4`} htmlFor='aes-text'>Texto fictício</label><textarea id='aes-text' className={control} rows={4} value={text} onChange={e => setText(e.target.value)} /><p className='mt-1 text-xs text-slate-500'>{bytes(text)} / 4.096 bytes UTF-8</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!bytes(text) || bytes(text) > 4096 || aesAction.isPending} onClick={() => aesAction.mutate(async () => { const result = await api.post<{ envelope: Envelope }>(`${root}/encrypt`, { text }, options); setEnvelope(result.envelope); setOriginal(text); setRecovered(undefined); })}>Cifrar</Button><Button variant='outline' disabled={!envelope || aesAction.isPending} onClick={() => aesAction.mutate(async () => { const result = await api.post<{ text: string }>(`${root}/decrypt`, { envelope }, options); setRecovered(result.text); })}>Recuperar</Button></div>
          <Feedback error={aesAction.error}>{aesAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando…</p> : envelope && <p className='mt-3 text-sm text-emerald-700'>Envelope disponível em memória para recuperação e esteganografia.</p>}</Feedback>{envelope && <div className='mt-4 space-y-2 text-sm'><p>Algoritmo: {envelope.algorithm}</p>{original && <p className='break-words'>Texto original: {original}</p>}<p className='break-all'>Ciphertext Base64: {envelope.ciphertext}</p><p>Base64 representa o conteúdo cifrado e não é um método de criptografia.</p><div className='flex gap-2'><Button variant='outline' onClick={() => void navigator.clipboard.writeText(envelope.ciphertext)}>Copiar ciphertext</Button><Button variant='outline' onClick={() => void navigator.clipboard.writeText(JSON.stringify(envelope))}>Copiar envelope</Button></div><details><summary>Envelope completo</summary><pre className='overflow-auto whitespace-pre-wrap break-all'>{JSON.stringify(envelope, null, 2)}</pre></details></div>}{recovered !== undefined && <div className='mt-3 rounded bg-slate-50 p-3'><p className='text-xs font-medium'>Texto recuperado</p><p className='break-words text-sm'>{recovered}</p></div>}
        </Card>
        <Card id='png' hidden={tab !== 'png'} className={section}><h2 className='text-xl font-semibold'>Esteganografia PNG</h2><p className='mt-2 text-sm text-slate-600'>Oculte um envelope AES em uma imagem ou extraia um envelope de um PNG. Use a mesma conta que criou a chave.</p>
          <label htmlFor='png-input' className={`${label} mt-4`}>Imagem PNG</label><input id='png-input' className={control} type='file' accept='image/png' onChange={e => void selectPng(e.target.files?.[0])} /><p className='mt-1 text-xs text-slate-500'>Até 1 MiB e 256 × 256 pixels. PNG RGB ou RGBA de 8 ou 16 bits.</p>{imageError && <p role='alert' className='mt-2 text-sm text-red-700'>{imageError}</p>}
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!image || !envelope || pngAction.isPending} onClick={() => pngAction.mutate(async () => { const r = await api.post<{ image_png: string }>(`${root}/steganography/embed`, { image_png: image, envelope }, options); setPngResult(r.image_png); })}>Inserir envelope</Button><Button variant='outline' disabled={!image || pngAction.isPending} onClick={() => pngAction.mutate(async () => { const r = await api.post<{ envelope: Envelope }>(`${root}/steganography/extract`, { image_png: image }, options); setEnvelope(r.envelope); setExtracted(r.envelope); setPngRecovered(undefined); setOriginal(''); setRecovered(undefined); })}>Extrair envelope</Button></div>
          <Feedback error={pngAction.error}>{pngAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando imagem…</p> : pngAction.isSuccess && <p className='mt-3 text-sm text-emerald-700'>Operação concluída.</p>}</Feedback>{dimensions && <p className='mt-3 text-sm'>Imagem original: {dimensions.width} × {dimensions.height} pixels · {dimensions.size.toLocaleString('pt-BR')} bytes. Capacidade teórica do quadro: {Math.floor(dimensions.width * dimensions.height * 3 / 8)} bytes; após cabeçalho de 40 bytes, até {Math.max(0, Math.floor(dimensions.width * dimensions.height * 3 / 8) - 40)} bytes para JSON. A capacidade efetiva depende da validação da imagem e do envelope.</p>}{pngResult && <p className='mt-2 text-sm'>PNG modificado: {dimensions?.width} × {dimensions?.height} pixels · {(atob(pngResult).length).toLocaleString('pt-BR')} bytes.</p>}{image && <div className='mt-4 grid gap-4 sm:grid-cols-2'><figure><img src={`data:image/png;base64,${image}`} alt='Imagem selecionada' className='max-h-56 max-w-full' /><figcaption>Imagem selecionada</figcaption></figure>{pngResult && <figure><img src={`data:image/png;base64,${pngResult}`} alt='Imagem modificada' className='max-h-56 max-w-full' /><figcaption>Imagem modificada</figcaption></figure>}</div>}{envelope && <details className='mt-3'><summary>Envelope AES disponível</summary><pre className='overflow-auto break-all whitespace-pre-wrap'>{JSON.stringify(envelope, null, 2)}</pre></details>}{extracted && <div className='mt-4 space-y-2'><details open><summary>Envelope extraído</summary><pre className='overflow-auto whitespace-pre-wrap break-all'>{JSON.stringify(extracted, null, 2)}</pre></details><Button variant='outline' disabled={pngAction.isPending} onClick={() => pngAction.mutate(async () => { setPngRecovered(undefined); const result = await api.post<{ text: string }>(`${root}/decrypt`, { envelope: extracted }, options); setPngRecovered(result.text); })}>Recuperar texto do envelope extraído</Button><p className='text-xs text-slate-500'>A chave deve estar ativa e pertencer à mesma conta. Falhas de chave e autenticação têm resposta genérica.</p>{pngRecovered !== undefined && <p className='break-words'>Texto recuperado: {pngRecovered}</p>}</div>}{pngResult && <a className='mt-3 inline-block text-sm font-medium text-violet-700 underline' href={`data:image/png;base64,${pngResult}`} download='secureai-lab.png'>Baixar PNG gerado</a>}
        </Card>
      </div>
      {checkingRole && <p role='status' className='text-sm'>Verificando permissões…</p>}
      {isAdmin && <>
        <Card id='toy' hidden={tab !== 'toy'} className={section}><h2 className='text-xl font-semibold'>Cifra didática</h2><p className='mt-2 text-sm text-amber-800'>Cifra insegura e sem autenticação. Use exclusivamente para demonstração com dados fictícios.</p>
          <label className={`${label} mt-4`} htmlFor='toy-text'>Texto fictício</label><textarea id='toy-text' className={control} rows={3} value={toyText} onChange={e => setToyText(e.target.value)} /><p className='mt-1 text-xs text-slate-500'>{bytes(toyText)} / 4.096 bytes UTF-8</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={!bytes(toyText) || bytes(toyText) > 4096 || toyAction.isPending} onClick={() => toyAction.mutate(async () => { const r = await api.post<Toy>(`${root}/experimental/run`, { action: 'encrypt', text: toyText }, options); setToy(r); setToyOriginal(toyText); setToyRecovered(undefined); })}>Cifrar</Button><Button variant='outline' disabled={!toy || toyAction.isPending} onClick={() => toyAction.mutate(async () => { const r = await api.post<{ text: string }>(`${root}/experimental/run`, { action: 'decrypt', key_id: toy?.key_id, ciphertext: toy?.ciphertext }, options); setToyRecovered(r.text); })}>Descriptografar</Button></div>
          <Feedback error={toyAction.error}>{toyAction.isPending ? <p role='status' className='mt-3 text-sm'>Processando…</p> : toy && <p className='mt-3 text-sm text-emerald-700'>Resultado disponível em memória.</p>}</Feedback>{toy && <div className='mt-4 space-y-2 text-sm'><p>TOY-V1-INSECURE · chave de 16 bits</p><p className='break-words'>Texto original: {toyOriginal}</p><p>Identificador: {toy.key_id}</p><p className='break-all'>Ciphertext Base64: {toy.ciphertext}</p><Button variant='outline' onClick={() => void navigator.clipboard.writeText(toy.ciphertext)}>Copiar ciphertext</Button><p>XOR e substituição contribuem para confusão; permutação e mistura contribuem para difusão.</p></div>}{toyRecovered !== undefined && <p className='mt-3 break-words rounded bg-slate-50 p-3 text-sm'>{toyRecovered}</p>}
        </Card>
        <Card id='attacks' hidden={tab !== 'attacks'} className={section}><h2 className='text-xl font-semibold'>Ataques controlados</h2><p className='mt-2 text-sm text-slate-600'>Experimentos executados apenas na cifra didática, com amostras internas fictícias.</p>
          <label htmlFor='experiment' className={`${label} mt-4`}>Experimento</label><select id='experiment' className={control} value={experiment} onChange={e => setExperiment(e.target.value)}><option value='brute_force'>Força bruta</option><option value='statistics'>Análise estatística</option><option value='differential'>Análise diferencial</option><option value='avalanche'>Efeito avalanche</option></select>
          <Button className='mt-4' disabled={attackAction.isPending || attack.job?.status === 'running' || attackCooldown > 0} onClick={() => attackAction.mutate(async () => { const r = await api.post<{ run_id: string }>(`${root}/attacks/runs`, { experiment }, options); setAttackCooldown(60); attack.start(r.run_id); })}>Iniciar experimento</Button>{attackCooldown > 0 && <p className='mt-2 text-xs text-slate-500'>Novo início disponível em aproximadamente {attackCooldown} s.</p>}
          <Feedback error={attackAction.error} /><JobState job={attack.job} error={attack.error} />{attack.job?.status === 'completed' && attack.job.metrics && <><p className='mt-3 text-sm font-medium'>Resultado: {({ brute_force: 'Força bruta', statistics: 'Análise estatística', differential: 'Análise diferencial', avalanche: 'Efeito avalanche' } as Record<string, string>)[attack.job.experiment ?? ''] ?? 'Experimento'}</p><Results metrics={attack.job.metrics} experiment={attack.job.experiment} /></>}
        </Card>
        <Card id='anomalies' hidden={tab !== 'anomalies'} className={section}><h2 className='text-xl font-semibold'>Detecção de anomalias</h2><p className='mt-2 text-sm text-slate-600'>Gere eventos sintéticos e compare os modelos. O resultado não representa desempenho em dados reais.</p>
          <div className='mt-4 flex flex-wrap gap-2'><Button disabled={anomalyAction.isPending || anomaly.job?.status === 'running' || cooldown > 0 || !!datasetId} onClick={() => anomalyAction.mutate(async () => { const r = await api.post<{ job_id: string }>(`${root}/anomalies/datasets`, { profile: 'synthetic-security-v1' }, options); setAnalysis(undefined); setAnomalyKind('dataset'); setCooldown(60); anomaly.start(r.job_id); })}>Gerar dataset sintético</Button><Button variant='outline' disabled={!datasetId || anomalyAction.isPending || anomaly.job?.status === 'running' || cooldown > 0} onClick={() => anomalyAction.mutate(async () => { const r = await api.post<{ job_id: string }>(`${root}/anomalies/runs`, { dataset_id: datasetId }, options); setAnalysis(undefined); setResultError(false); setAnomalyKind('run'); setCooldown(60); anomaly.start(r.job_id); })}>Executar análise</Button></div>
          {cooldown > 0 && <p className='mt-2 text-xs text-slate-500'>Próxima execução disponível em aproximadamente {cooldown} s.</p>}<Feedback error={anomalyAction.error || (resultError ? new Error('result') : undefined)} /><JobState job={anomaly.job} error={anomaly.error} />{datasetId && <div className='mt-2 text-sm text-emerald-700'><p>Dataset sintético armazenado temporariamente na memória do servidor.</p>{anomalyKind === 'dataset' && anomaly.job?.metadata && <p>Janelas: {anomaly.job.metadata.window_count.toLocaleString('pt-BR')} · Eventos: {anomaly.job.metadata.event_count.toLocaleString('pt-BR')}</p>}<p>Partições, classes e famílias serão exibidas quando a análise retornar esses dados.</p></div>}
          {analysis && <div className='mt-5 space-y-5'><p className='text-sm text-slate-600'>Comparação no conjunto de teste sintético · {analysis.partition_sizes.test} janelas</p><p className='text-sm'>Isolation Forest identifica observações raras; o baseline compara desvios estatísticos. Ambos usam somente dados sintéticos.</p><div className='h-64'><ResponsiveContainer width='100%' height='100%'><BarChart data={Object.entries(analysis.methods).map(([name,method]) => ({ name: name === 'isolation_forest' ? 'Isolation Forest' : 'Baseline', precisao: method.partitions.test.precision.value, recall: method.partitions.test.recall.value, f1: method.partitions.test.f1.value }))}><CartesianGrid strokeDasharray='3 3'/><XAxis dataKey='name'/><YAxis domain={[0,1]}/><Tooltip/><Bar dataKey='precisao' name='Precisão' fill='#7761e8'/><Bar dataKey='recall' name='Recall' fill='#2563eb'/><Bar dataKey='f1' name='F1' fill='#059669'/></BarChart></ResponsiveContainer></div><p className='text-sm'>Partições: {Object.entries(analysis.partition_sizes).map(([name,count]) => `${name}: ${count}`).join(' · ')}</p><p className='text-sm'>Distribuição das classes e famílias no teste sintético</p><ul className='text-sm'>{Object.entries(analysis.methods[Object.keys(analysis.methods)[0]].partitions.test.families).map(([family, data]) => <li key={family}>{({login_failures: 'Falhas de login', access_denied: 'Acesso negado', request_volume: 'Volume de requisições', admin_activity: 'Atividade administrativa'} as Record<string,string>)[family] ?? family}: {data.support} janelas, {data.detected} detectadas pelo primeiro modelo.</li>)}</ul><div className='grid gap-4 md:grid-cols-2'>{Object.entries(analysis.methods).map(([key, method]) => { const m = method.partitions.test; return <div key={key} className='rounded-lg border border-slate-200 p-4'><h3 className='font-semibold'>{key === 'isolation_forest' ? 'Isolation Forest' : 'Baseline robusto'}</h3><p className='mt-1 text-xs text-slate-500'>Limiar {method.threshold.toFixed(4)} · normais {m.normal_support} · anômalas {m.anomaly_support}</p><table className='mt-3 w-full text-left text-sm'><caption className='mb-1 text-left text-xs'>Matriz de confusão — linhas reais, colunas previstas</caption><thead><tr><th>Real / previsto</th><th>Normal</th><th>Anomalia</th></tr></thead><tbody><tr><th>Normal</th><td>{m.matrix[0][0]}</td><td>{m.matrix[0][1]}</td></tr><tr><th>Anomalia</th><td>{m.matrix[1][0]}</td><td>{m.matrix[1][1]}</td></tr></tbody></table><dl className='mt-3 space-y-1 text-sm'>{[['Precisão',m.precision],['Recall',m.recall],['F1',m.f1],['Taxa de falsos positivos',m.false_positive_rate]].map(([name, ratio]) => { const metric = ratio as Ratio; return <div key={name as string} className='flex justify-between gap-3'><dt>{name as string}</dt><dd>{metric.value === null ? 'Indefinido' : `${(metric.value * 100).toFixed(2)}%`} ({metric.numerator}/{metric.denominator})</dd></div>; })}<div className='flex justify-between'><dt>Anomalias detectadas</dt><dd>{m.TP}</dd></div><div className='flex justify-between'><dt>Falsos positivos / negativos</dt><dd>{m.FP} / {m.FN}</dd></div></dl></div>; })}</div></div>}
        </Card>
      </>}
    </div>
  </main>;
}
