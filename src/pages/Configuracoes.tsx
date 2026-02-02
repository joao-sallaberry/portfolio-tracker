import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Configuracoes() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || 'Email não disponível');
            }
            setLoading(false);
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            navigate('/auth');
        } catch (error: any) {
            toast.error('Erro ao sair: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
                <p className="mt-2 text-muted-foreground">
                    Gerencie sua conta e preferências
                </p>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Perfil</CardTitle>
                        <CardDescription>Informações da sua conta</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 rounded-md border p-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium leading-none">Email</p>
                                <p className="text-sm text-muted-foreground">{userEmail}</p>
                            </div>
                        </div>

                        <Button variant="destructive" onClick={handleLogout} className="w-full sm:w-auto">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair da Conta
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
