import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminPessoasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Header />
      {children}
    </ProtectedRoute>
  );
}
