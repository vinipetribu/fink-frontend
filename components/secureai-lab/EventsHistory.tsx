'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';

const options = { cache: 'no-store' as const, suppressErrorLog: true };
const root = '/crypto-lab';
type Summary = { total: number; by_origin: Record<string, number>; by_type: Record<string, number>; by_day_utc: Record<string, number>; period: { start: string; end_exclusive: string } };
type EventRow = { id: string; occurred_at: string; origin: 'observed' | 'synthetic'; event_type: string; result: string };
type Page<T> = { items: T[]; next_cursor: string | null };
type Ratio = { value: number | null; numerator: number | null; denominator: number | null };
type Metrics = { precision: Ratio; recall: Ratio; f1: Ratio; false_positive_rate: Ratio; TP: number | null; FP: number | null; FN: number | null; matrix: number[][] | null };
type Run = { id: string; catalog: string; origin: string; state: string; finished_at: string; processed_volume: number | null; model_versions: { scikit_learn?: string | null; numpy?: string | null }; metrics: { event_count: number | null; window_count: number | null; methods: Record<string, { partitions: Record<string, Metrics> }> } };
type Ingestion = { status: 'completed' | 'partial'; requested: number; generated: number; persisted_confirmed: number; failed_or_unconfirmed: number; not_generated: number; duration_seconds: number };
const categories: Record<string, string> = { LOGIN_SUCCESS: 'Login concluído', LOGIN_FAILURE: 'Falha de login', ACCESS_DENIED: 'Acesso negado', ADMIN_ACCESS: 'Acesso administrativo', AES_ENCRYPT: 'Cifragem AES', AES_DECRYPT: 'Recuperação AES', TOY_ENCRYPT: 'Cifragem didática', TOY_DECRYPT: 'Recuperação didática', STEGO_EMBED: 'Inserção em PNG', STEGO_EXTRACT: 'Extração de PNG', ATTACK_RUN: 'Ataque controlado', ANOMALY_RUN: 'Análise de anomalias' };
const outcomes: Record<string, string> = { SUCCESS: 'Sucesso', FAILURE: 'Falha', DENIED: 'Negado', ALLOWED: 'Permitido', TIMEOUT: 'Tempo esgotado' };
const time = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'UTC' }) + ' UTC';
const fmt = (value: number) => value.toLocaleString('pt-BR');
const percent = (ratio?: Ratio) => ratio?.value == null ? 'Indefinido' : `${(ratio.value * 100).toFixed(2)}% (${ratio.numerator}/${ratio.denominator})`;

function errorMessage(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  if (status === 403) return 'Acesso exclusivo para administradores.';
  if (status === 503) return 'Armazenamento ou laboratório indisponível. Confira as flags locais e tente novamente.';
  if (status === 422) return 'Os dados informados não são válidos.';
  return 'Não foi possível obter os dados. Confira a sessão e a conexão.';
}

function LoadState({ loading, error }: { loading: boolean; error: unknown }) {
  if (loading) return <p role='status' className='text-sm text-slate-500'>Carregando…</p>;
  if (error) return <p role='alert' className='text-sm text-red-700'>{errorMessage(error)}</p>;
  return null;
}

export function EventsHistory({ active }: { active: boolean }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('600');
  const [origin, setOrigin] = useState('');
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  const [eventPrevious, setEventPrevious] = useState<(string | null)[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyPrevious, setHistoryPrevious] = useState<(string | null)[]>([]);
  const count = Number(amount);
  const valid = /^\d+$/.test(amount) && Number.isSafeInteger(count) && count >= 1 && count <= 10000;
  const summary = useQuery({ queryKey: ['lab-events-summary'], queryFn: () => api.get<Summary>(`${root}/events/summary`, options), enabled: active, retry: false, gcTime: 0 });
  const events = useQuery({ queryKey: ['lab-events', origin, eventCursor], queryFn: () => {
    const params = new URLSearchParams({ limit: '20' });
    if (origin) params.set('origin', origin);
    if (eventCursor) params.set('cursor', eventCursor);
    return api.get<Page<EventRow>>(`${root}/events?${params}`, options);
  }, enabled: active, retry: false, gcTime: 0 });
  const history = useQuery({ queryKey: ['lab-history', historyCursor], queryFn: () => {
    const params = new URLSearchParams({ limit: '5' });
    if (historyCursor) params.set('cursor', historyCursor);
    return api.get<Page<Run>>(`${root}/anomalies/history?${params}`, options);
  }, enabled: active, retry: false, gcTime: 0 });
  const ingestion = useMutation({ mutationFn: (quantity: number) => api.post<Ingestion>(`${root}/events/synthetic-ingestions`, { count: quantity }, { ...options, timeout: 30000 }), retry: false, gcTime: 0,
    onSuccess: async () => {
      setEventCursor(null); setEventPrevious([]);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['lab-events-summary'] }), queryClient.invalidateQueries({ queryKey: ['lab-events'] })]);
    } });
  const graph = Object.entries(summary.data?.by_type ?? {}).map(([key, value]) => ({ name: categories[key] ?? key, quantidade: value }));
  const timeline = Object.entries(summary.data?.by_day_utc ?? {}).map(([name, quantidade]) => ({ name, quantidade }));
  return <div className='space-y-8'>
    <div><h2 className='text-xl font-semibold'>Eventos e histórico</h2><p className='mt-2 text-sm text-slate-600'>Eventos observados representam metadados das operações; eventos sintéticos são gerados para experimentos. Totais e gráficos abrangem o período consultado, não todo o banco.</p></div>
    <section aria-labelledby='event-summary' className='space-y-4'><h3 id='event-summary' className='text-lg font-semibold'>Eventos persistidos</h3><LoadState loading={summary.isLoading} error={summary.error} />
      {summary.data && <><p className='text-xs text-slate-500'>Período padrão: {time(summary.data.period.start)} até {time(summary.data.period.end_exclusive)} (limite final exclusivo).</p><dl className='grid gap-3 sm:grid-cols-3'>{[['Total', summary.data.total], ['Observados', summary.data.by_origin.observed ?? 0], ['Sintéticos', summary.data.by_origin.synthetic ?? 0]].map(([name, value]) => <div key={name} className='rounded-lg bg-slate-50 p-4'><dt className='text-sm text-slate-600'>{name}</dt><dd className='mt-1 text-2xl font-semibold'>{fmt(value as number)}</dd></div>)}</dl>
        {summary.data.total === 0 ? <p className='text-sm text-slate-500'>Nenhum evento no período.</p> : <div className='grid gap-6 lg:grid-cols-2'><div><h4 className='text-sm font-semibold'>Distribuição por categoria</h4><div className='h-72'><ResponsiveContainer width='100%' height='100%'><BarChart data={graph} layout='vertical' margin={{ left: 10, right: 15 }}><CartesianGrid strokeDasharray='3 3'/><XAxis type='number' allowDecimals={false}/><YAxis type='category' dataKey='name' width={125} tick={{fontSize: 11}}/><Tooltip/><Bar dataKey='quantidade' name='Eventos' fill='#7761e8'/></BarChart></ResponsiveContainer></div></div><div><h4 className='text-sm font-semibold'>Evolução diária em UTC</h4><div className='h-72'><ResponsiveContainer width='100%' height='100%'><BarChart data={timeline}><CartesianGrid strokeDasharray='3 3'/><XAxis dataKey='name' tick={{fontSize: 10}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey='quantidade' name='Eventos' fill='#2563eb'/></BarChart></ResponsiveContainer></div></div></div>}</>}
    </section>
    <section aria-labelledby='ingestion' className='rounded-lg border border-violet-100 bg-violet-50 p-4'><h3 id='ingestion' className='font-semibold'>Gerar eventos sintéticos</h3><p className='mt-1 text-sm text-slate-600'>Gera metadados fictícios persistidos, sem usar dados financeiros. O volume não demonstra escalabilidade distribuída.</p><form className='mt-3 flex flex-wrap items-end gap-3' onSubmit={e => { e.preventDefault(); if (valid) ingestion.mutate(count); }}><div><label htmlFor='synthetic-count' className='mb-1 block text-sm font-medium'>Quantidade (1 a 10.000)</label><input id='synthetic-count' type='number' min={1} max={10000} step={1} value={amount} onChange={e => setAmount(e.target.value)} className='w-40 rounded-md border border-slate-300 bg-white p-2 text-sm' /></div><Button type='submit' disabled={!valid || ingestion.isPending}>{ingestion.isPending ? 'Gerando…' : 'Gerar lote'}</Button></form>
      <LoadState loading={false} error={ingestion.error} />{ingestion.data && <div role='status' className={`mt-3 text-sm ${ingestion.data.status === 'completed' ? 'text-emerald-800' : 'text-amber-800'}`}><p>{ingestion.data.status === 'completed' ? 'Ingestão concluída.' : 'Ingestão parcial; um lote não confirmado pode ou não ter sido gravado.'}</p><p>Solicitados: {fmt(ingestion.data.requested)} · Gerados: {fmt(ingestion.data.generated)} · Confirmados: {fmt(ingestion.data.persisted_confirmed)} · Falhos ou não confirmados: {fmt(ingestion.data.failed_or_unconfirmed)} · Não gerados: {fmt(ingestion.data.not_generated)} · Duração: {ingestion.data.duration_seconds.toFixed(2)} s</p></div>}
    </section>
    <section aria-labelledby='event-list' className='space-y-3'><div className='flex flex-wrap items-end justify-between gap-3'><h3 id='event-list' className='text-lg font-semibold'>Eventos no período</h3><div><label htmlFor='event-origin' className='mr-2 text-sm'>Origem</label><select id='event-origin' value={origin} onChange={e => { setOrigin(e.target.value); setEventCursor(null); setEventPrevious([]); }} className='rounded border border-slate-300 bg-white p-2 text-sm'><option value=''>Todas</option><option value='observed'>Observados</option><option value='synthetic'>Sintéticos</option></select></div></div><LoadState loading={events.isLoading || events.isFetching} error={events.error}/>
      {events.data && <>{events.data.items.length === 0 ? <p className='text-sm text-slate-500'>Nenhum evento encontrado.</p> : <div className='overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr className='border-b'><th className='p-2'>Horário UTC</th><th className='p-2'>Origem</th><th className='p-2'>Tipo</th><th className='p-2'>Resultado</th></tr></thead><tbody>{events.data.items.map(item => <tr key={item.id} className='border-b border-slate-100'><td className='whitespace-nowrap p-2'>{time(item.occurred_at)}</td><td className='p-2'>{item.origin === 'synthetic' ? 'Sintético' : 'Observado'}</td><td className='p-2'>{categories[item.event_type] ?? item.event_type}</td><td className='p-2'>{outcomes[item.result] ?? item.result}</td></tr>)}</tbody></table></div>}<div className='flex gap-2'><Button variant='outline' disabled={!eventPrevious.length || events.isFetching} onClick={() => { setEventCursor(eventPrevious[eventPrevious.length - 1]); setEventPrevious(eventPrevious.slice(0, -1)); }}>Anterior</Button><Button variant='outline' disabled={!events.data.next_cursor || events.isFetching} onClick={() => { setEventPrevious([...eventPrevious, eventCursor]); setEventCursor(events.data!.next_cursor); }}>Próxima</Button></div></>}
    </section>
    <section aria-labelledby='history' className='space-y-4'><h3 id='history' className='text-lg font-semibold'>Histórico de análises de IA</h3><p className='text-sm text-slate-600'>Resultados agregados de dados sintéticos no período padrão. A gravação do histórico é de melhor esforço.</p><LoadState loading={history.isLoading || history.isFetching} error={history.error}/>
      {history.data && <>{history.data.items.length === 0 ? <p className='text-sm text-slate-500'>Nenhuma execução encontrada.</p> : history.data.items.map(run => <article key={run.id} className='space-y-3 rounded-lg border border-slate-200 p-4'><div><h4 className='font-semibold'>{run.catalog} · {({completed: 'Concluída', failed: 'Falhou', timed_out: 'Tempo esgotado'} as Record<string,string>)[run.state] ?? run.state}</h4><p className='text-sm text-slate-600'>{time(run.finished_at)} · Origem sintética · {run.processed_volume == null ? 'Volume indisponível' : `${fmt(run.processed_volume)} janelas`} · {run.metrics.event_count == null ? 'Eventos indisponíveis' : `${fmt(run.metrics.event_count)} eventos`}</p><p className='text-xs text-slate-500'>scikit-learn: {run.model_versions.scikit_learn ?? 'não informado'} · NumPy: {run.model_versions.numpy ?? 'não informado'}</p></div>{Object.entries(run.metrics.methods).map(([method, data]) => { const m = data.partitions.test; return <div key={method} className='rounded bg-slate-50 p-3 text-sm'><h5 className='font-semibold'>{method === 'isolation_forest' ? 'Isolation Forest' : method === 'robust_baseline' ? 'Baseline robusto' : method} · teste sintético</h5>{m ? <><p>Precisão: {percent(m.precision)} · Recall: {percent(m.recall)} · F1: {percent(m.f1)} · Falsos positivos: {percent(m.false_positive_rate)}</p><p>Detectadas: {m.TP ?? '—'} · Falsos positivos: {m.FP ?? '—'} · Falsos negativos: {m.FN ?? '—'}</p>{m.matrix && <p>Matriz [[VN, FP], [FN, VP]]: [[{m.matrix[0]?.join(', ')}], [{m.matrix[1]?.join(', ')}]]</p>}</> : <p>Métricas de teste indisponíveis.</p>}</div>; })}{!Object.keys(run.metrics.methods).length && <p className='text-sm text-slate-500'>Métricas agregadas indisponíveis para esta execução.</p>}</article>)}<div className='flex gap-2'><Button variant='outline' disabled={!historyPrevious.length || history.isFetching} onClick={() => { setHistoryCursor(historyPrevious[historyPrevious.length - 1]); setHistoryPrevious(historyPrevious.slice(0, -1)); }}>Anterior</Button><Button variant='outline' disabled={!history.data.next_cursor || history.isFetching} onClick={() => { setHistoryPrevious([...historyPrevious, historyCursor]); setHistoryCursor(history.data!.next_cursor); }}>Próxima</Button></div></>}
    </section>
  </div>;
}
