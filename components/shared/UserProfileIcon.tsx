'use client';

import Link from 'next/link';
import { BsPerson } from 'react-icons/bs';

export const UserProfileIcon = () => {
  return (
    <Link
      href='/profile'
      aria-label='Abrir perfil'
      className='flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80'
    >
      <div className='flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-primary text-white'>
        <BsPerson aria-hidden='true' size={26} />
      </div>
    </Link>
  );
};
