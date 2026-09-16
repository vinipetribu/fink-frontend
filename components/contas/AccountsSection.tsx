'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, UserRound } from 'lucide-react';

import { AccountCard, Bank } from './AccountCard';
import PluggyButton from '@/components/home/PluggyButton';
import { usePluggyAccounts } from '@/lib/hooks/pluggy';
import type { PluggyAccount } from '@/lib/api/types/pluggy';

const PLUGGY_ITEM_ID = 'b1a3c84f-5a5b-4a26-abd4-ac39555506f4';

// Agrupa contas reais por banco e define logo/imagem
function groupAccountsByBank(accounts: PluggyAccount[]): Bank[] {
  const map = new Map<string, Bank>();

  accounts.forEach((acc) => {
    const bankName = acc.institution?.name ?? acc.name ?? 'Conta';
    const bankId =
      acc.institution?.id?.toString() ??
      bankName.toLowerCase().replace(/\s+/g, '-');

    const lower = bankName.toLowerCase();
    const isNubank = lower.includes('nubank') || lower.startsWith('nu ');

    let bank = map.get(bankId);

    if (!bank) {
      const initials = bankName.slice(0, 2).toUpperCase();

      bank = {
        id: bankId,
        name: bankName,
        logoUrl: isNubank ? '/images/banks/nubank-logo.png' : undefined,
        logoInitials: isNubank ? undefined : initials,
        logoBgClass: isNubank ? 'bg-[#8A05BE]' : 'bg-slate-900',
        branch: '0001',
        totalAccounts: 0,
        accounts: [],
      };

      map.set(bankId, bank);
    }

    const status: 'active' | 'inactive' =
      acc.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active';

    const raw: unknown = acc.number ?? acc.accountNumber;
    const displayNumber =
      typeof raw === 'string' && raw.length > 0
        ? raw
        : `Conta ${bank.accounts.length + 1}`;

    bank.accounts.push({
      id: String(acc.id),
      number: displayNumber,
      type: acc.type ?? 'Conta',
      status,
    });

    bank.totalAccounts += 1;
  });

  return Array.from(map.values());
}

export function AccountsSection() {
  const {
    data: accounts = [],
    isLoading,
    isError,
  } = usePluggyAccounts(PLUGGY_ITEM_ID);

  const banks = React.useMemo(() => groupAccountsByBank(accounts), [accounts]);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter(
    (acc) => acc.status?.toLowerCase() !== 'inactive'
  );
  const inactiveAccounts = accounts.filter(
    (acc) => acc.status?.toLowerCase() === 'inactive'
  );

  return (
    <div className="min-h-screen bg-[#F5F7F9]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {/* Topo */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-lg text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </Link>

          <div className="flex-1">
            <h1 className="text-3xl font-semibold text-slate-900">
              Minhas contas
            </h1>
            <p className="text-lg text-slate-600">
              Todas as suas contas em um só lugar
            </p>
          </div>

          <PluggyButton />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mt-8 flex items-center justify-center text-base text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando contas...
          </div>
        )}

        {/* Erro */}
        {isError && !isLoading && (
          <div className="mt-8 text-base text-red-500">
            Não foi possível carregar suas contas agora.
          </div>
        )}

        {/* Conteúdo */}
        {!isLoading && !isError && (
          <div className="flex w-full flex-col items-start gap-6 lg:flex-row">
            {/* Painel lateral */}
            <aside className="flex w-full flex-col gap-5 rounded-3xl border border-slate-100 bg-white px-6 py-6 shadow-sm lg:w-80">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-slate-600"
                  aria-label="Avatar genérico"
                >
                  <UserRound aria-hidden="true" className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    Pessoa fictícia do laboratório
                  </p>
                  <p className="text-base text-slate-600">
                    Identidade ilustrativa, não vinculada à sessão
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-base text-slate-600">
                <span>Contas cadastradas</span>
                <span className="text-base font-semibold text-slate-900">
                  {totalAccounts} conta{totalAccounts === 1 ? '' : 's'}
                </span>
              </div>

              {/* Ativas */}
              <section className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-base text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-500">
                      ✦
                    </div>
                    <span>Contas ativas</span>
                  </div>
                  <span className="text-base font-semibold text-slate-900">
                    {activeAccounts.length} conta
                    {activeAccounts.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2 text-base">
                  {activeAccounts.slice(0, 3).map((acc) => (
                    <div key={acc.id} className="flex justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {acc.institution?.name ?? acc.name ?? 'Conta'}
                        </p>
                        <p className="text-slate-500">
                          {acc.type ?? 'Conta'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {activeAccounts.length === 0 && (
                    <p className="text-slate-400">
                      Nenhuma conta ativa.
                    </p>
                  )}
                </div>
              </section>

              {/* Inativas */}
              <section className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-base text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      ⏻
                    </div>
                    <span>Contas inativas</span>
                  </div>
                  <span className="text-base font-semibold text-slate-900">
                    {inactiveAccounts.length} conta
                    {inactiveAccounts.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2 text-base">
                  {inactiveAccounts.slice(0, 3).map((acc) => (
                    <div key={acc.id} className="flex justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {acc.institution?.name ?? acc.name ?? 'Conta'}
                        </p>
                        <p className="text-slate-500">
                          {acc.type ?? 'Conta'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {inactiveAccounts.length === 0 && (
                    <p className="text-slate-400">
                      Nenhuma conta inativa.
                    </p>
                  )}
                </div>
              </section>
            </aside>

            {/* Lista de bancos e cartões */}
            <main className="w-full flex-1 space-y-4">
              {banks.length === 0 && (
                <div className="text-base text-slate-500">
                  Nenhuma conta conectada ainda.
                </div>
              )}

              {banks.map((bank) => (
                <AccountCard key={bank.id} bank={bank} />
              ))}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
