'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLink {
  href: string;
  label: string;
  disabled?: boolean;
}

export const Navbar = () => {
  const pathname = usePathname();

  const navLinks: NavLink[] = [
    { href: '/categorias', label: 'Categorias', disabled: true },
    { href: '/movimentacoes', label: 'Movimentações' },
    { href: '/home', label: 'Espaço Finker' },
    { href: '/metas', label: 'Metas' },
    { href: '/admin/pessoas', label: 'Administração' },
    { href: '/academy', label: 'Academy', disabled: true },
  ];

  const isActive = (href: string) => {
    if (href === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  const getLinkClassName = (href: string, disabled?: boolean) => {
    const active = isActive(href);
    const baseClasses =
      'text-md font-medium transition-colors px-3 relative whitespace-nowrap';
    const activeClasses = 'text-zinc-900 overflow-visible';
    const inactiveClasses = 'text-zinc-500 hover:text-zinc-900 truncate';
    const disabledClasses = 'text-zinc-400 cursor-not-allowed opacity-60';

    if (disabled) {
      return `${baseClasses} ${disabledClasses}`;
    }

    return `${baseClasses} ${active ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className='hidden md:flex items-center gap-6 border-b-2 border-[#D1D2D9] pb-4 pt-2 '>
      {navLinks.map((link) => {
        const className = getLinkClassName(link.href, link.disabled);
        const active = isActive(link.href);

        if (link.disabled) {
          return (
            <span key={link.label} className={className}>
              {link.label}
            </span>
          );
        }

        return (
          <Link key={link.label} href={link.href} className={className}>
            {link.label}
            {active && (
              <span
                className='absolute -left-3 -right-3 h-[2px] bg-primary'
                style={{ bottom: '-1rem', marginBottom: '-2px' }}
              ></span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};
