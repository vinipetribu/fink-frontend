import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute adminOnly>
      <Header />
      {children}
    </ProtectedRoute>
  );
}
