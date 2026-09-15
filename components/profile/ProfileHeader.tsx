import { BsPerson } from 'react-icons/bs';

interface ProfileHeaderProps {
  nome: string;
  idade: number;
  email: string;
  telefone: string;
}

export function ProfileHeader({
  nome,
  idade,
  email,
  telefone,
}: ProfileHeaderProps) {
  return (
    <div className='mb-8 flex items-start'>
      <div className='flex items-start gap-4'>
        <div
          className='flex h-[64px] w-[64px] flex-shrink-0 items-center justify-center rounded-full bg-primary text-white'
          aria-label='Avatar genérico'
        >
          <BsPerson aria-hidden='true' size={34} />
        </div>

        <div>
          <h2 className='mb-1 text-3xl font-semibold text-slate-900'>
            {nome}
          </h2>
          <p className='mb-3 text-base text-slate-500'>{idade} anos</p>

          <div className='flex flex-wrap items-center gap-4 text-base text-slate-900'>
            <span>{email}</span>
            <span className='h-4 w-px bg-slate-200' />
            <span>{telefone}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
