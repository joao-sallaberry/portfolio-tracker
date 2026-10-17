import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, lazy, Suspense } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { openedFromRecoveryLink } from "@/lib/auth-recovery";
import { Skeleton } from "@/components/ui/skeleton";

// Pages are loaded on demand so heavy dependencies (SheetJS, Recharts) only ship with the pages that use them
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Index = lazy(() => import("./pages/Index"));
const Import = lazy(() => import("./pages/Import"));
const Negociacoes = lazy(() => import("./pages/Negociacoes"));
const Proventos = lazy(() => import("./pages/Proventos"));
const Posicao = lazy(() => import("./pages/Posicao"));
const ImpostoRenda = lazy(() => import("./pages/ImpostoRenda"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const queryClient = new QueryClient();

const App = () => {
  // Check for session to protect routes
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the user arrives through a password reset link, until the new password is saved
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromRecoveryLink);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" replace />} />
              {/* Reached from the reset email (which signs the user in), with or without a session */}
              <Route
                path="/redefinir-senha"
                element={<ResetPassword session={session} onPasswordUpdated={() => setPasswordRecovery(false)} />}
              />

              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  passwordRecovery ? (
                    <Navigate to="/redefinir-senha" replace />
                  ) : session ? (
                    <AppLayout>
                      <Suspense fallback={<PageFallback />}>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/importar" element={<Import />} />
                          <Route path="/negociacoes" element={<Negociacoes />} />
                          <Route path="/proventos" element={<Proventos />} />
                          <Route path="/posicao" element={<Posicao />} />
                          <Route path="/imposto-renda" element={<ImpostoRenda />} />
                          <Route path="/configuracoes" element={<Configuracoes />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </AppLayout>
                  ) : (
                    <Navigate to="/auth" replace />
                  )
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
