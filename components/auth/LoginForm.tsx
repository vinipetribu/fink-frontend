'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useLogin } from '@/lib/hooks/sessoes';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SpinLoader } from '../shared/SpinLoader';

// Schema de validação
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginForm = () => {
  const router = useRouter();
  const { mutate: login, isPending } = useLogin();
  const [errorMessage, setErrorMessage] = useState<string>('');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setErrorMessage('');

    login(data, {
      onSuccess: () => {
        // Redirecionar para home após login
        router.push('/home');
      },
      onError: (error: Error) => {
        console.error('Login error:', error);
        setErrorMessage(
          error.message || 'Erro ao fazer login. Verifique suas credenciais.'
        );
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Garante que não recarrega
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <div className='w-full max-w-md space-y-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold tracking-tight'>
          Bem-vindo de volta
        </h2>
        <p className='mt-2 text-sm text-muted-foreground'>
          Entre com sua conta para continuar
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Email */}
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='seu@email.com'
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Senha */}
          <FormField
            control={form.control}
            name='senha'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder='••••••••'
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Mensagem de erro */}
          {errorMessage && (
            <div className='rounded-md bg-destructive/15 p-3'>
              <p className='text-sm text-destructive'>{errorMessage}</p>
            </div>
          )}

          {/* Botão de submit */}
          <Button type='submit' className='w-full' disabled={isPending}>
            {isPending ? (
              <>
                <SpinLoader />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </Form>

      {/* Link para cadastro (opcional) */}
      <div className='text-center text-sm'>
        <span className='text-muted-foreground'>Não tem uma conta? </span>
        <button
          type='button'
          onClick={() => {
            // TODO: Implementar navegação para cadastro
            console.log('Navegar para cadastro');
          }}
          className='font-medium text-primary hover:underline bg-transparent border-none cursor-pointer'
        >
          Cadastre-se
        </button>
      </div>
    </div>
  );
};
