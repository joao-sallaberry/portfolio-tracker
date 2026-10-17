import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Pages are loaded on demand so heavy dependencies (SheetJS, Recharts) only ship with the pages that use them
const Auth = lazy(() => import("./pages/Auth"));
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
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
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

              {/* Protected Routes */}
              <Route
                path="/*"
                element={
                  session ? (
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
