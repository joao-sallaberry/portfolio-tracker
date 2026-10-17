import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'forgot'>('login');
    const [resetSent, setResetSent] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            navigate("/");
        } catch (error) {
            toast.error((error instanceof Error && error.message) || "Erro ao fazer login");
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth`,
                },
            });

            if (error) throw error;

            toast.success("Cadastro realizado! Verifique seu email.");
        } catch (error) {
            toast.error((error instanceof Error && error.message) || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/redefinir-senha`,
            });

            if (error) throw error;

            setResetSent(true);
        } catch (error) {
            const details = typeof error === 'object' && error !== null ? (error as { status?: number; code?: string }) : {};
            if (details.code === 'over_email_send_rate_limit') {
                // Project-wide cap on emails per hour (low on Supabase's built-in email service)
                toast.error('O limite de envio de e-mails foi atingido. Tente de novo em até uma hora.');
            } else if (details.status === 429) {
                toast.error('Muitas tentativas. Aguarde um minuto e tente de novo.');
            } else {
                toast.error((error instanceof Error && error.message) || 'Erro ao enviar o link');
            }
        } finally {
            setLoading(false);
        }
    };

    const showLogin = () => {
        setMode('login');
        setResetSent(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Portfolio Tracker</CardTitle>
                    <CardDescription>Entre para gerenciar seus investimentos</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="login">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="login">Login</TabsTrigger>
                            <TabsTrigger value="signup">Cadastro</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            {mode === 'forgot' ? (
                                resetSent ? (
                                    <div className="space-y-4 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Se houver uma conta com o e-mail <strong className="text-foreground">{email}</strong>, enviamos um
                                            link para redefinir a senha. Confira também a caixa de spam.
                                        </p>
                                        <Button type="button" variant="outline" className="w-full" onClick={showLogin}>
                                            Voltar para o login
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleForgotPassword} className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                                        </p>
                                        <div className="space-y-2">
                                            <Label htmlFor="forgot-email">Email</Label>
                                            <Input
                                                id="forgot-email"
                                                type="email"
                                                placeholder="seu@email.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={loading}>
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enviar link
                                        </Button>
                                        <Button type="button" variant="ghost" className="w-full" onClick={showLogin}>
                                            Voltar para o login
                                        </Button>
                                    </form>
                                )
                            ) : (
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password">Senha</Label>
                                            <button
                                                type="button"
                                                className="text-sm text-primary hover:underline"
                                                onClick={() => setMode('forgot')}
                                            >
                                                Esqueci minha senha
                                            </button>
                                        </div>
                                        <Input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Entrar
                                    </Button>
                                </form>
                            )}
                        </TabsContent>

                        <TabsContent value="signup">
                            <form onSubmit={handleSignUp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="signup-email">Email</Label>
                                    <Input
                                        id="signup-email"
                                        type="email"
                                        placeholder="seu@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-password">Senha</Label>
                                    <Input
                                        id="signup-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Criar Conta
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
