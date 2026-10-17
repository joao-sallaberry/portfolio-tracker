import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MIN_PASSWORD_LENGTH = 6;

interface ResetPasswordProps {
    /** The recovery link from the email signs the user in; without a session the link is invalid or expired */
    session: Session | null;
    onPasswordUpdated: () => void;
}

export default function ResetPassword({ session, onPasswordUpdated }: ResetPasswordProps) {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmation) {
            toast.error('As senhas não conferem.');
            return;
        }
        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            toast.success('Senha alterada com sucesso!');
            onPasswordUpdated();
            navigate('/', { replace: true });
        } catch (error) {
            const sameAsOld = typeof error === 'object' && error !== null && 'code' in error && error.code === 'same_password';
            toast.error(
                sameAsOld
                    ? 'A nova senha precisa ser diferente da atual.'
                    : (error instanceof Error && error.message) || 'Erro ao alterar a senha'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Redefinir senha</CardTitle>
                    <CardDescription>
                        {session ? `Crie uma nova senha para ${session.user.email}` : 'Link inválido ou expirado'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {session ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Nova senha</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmation}
                                    onChange={(e) => setConfirmation(e.target.value)}
                                    required
                                    minLength={MIN_PASSWORD_LENGTH}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar nova senha
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                O link de redefinição expira e só pode ser usado uma vez. Peça um novo na tela de login, em
                                "Esqueci minha senha".
                            </p>
                            <Button className="w-full" onClick={() => navigate('/auth', { replace: true })}>
                                Voltar para o login
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
