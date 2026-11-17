'use client';

import { Header } from '@/components/Header';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Lab } from '@/components/secureai-lab/Lab';

export default function SecureAiLabPage() {
  return <ProtectedRoute><Header /><Lab /></ProtectedRoute>;
}
