import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Import from "./pages/Import";
import Negociacoes from "./pages/Negociacoes";
import Proventos from "./pages/Proventos";
import Posicao from "./pages/Posicao";
import ImpostoRenda from "./pages/ImpostoRenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/importar" element={<Import />} />
            <Route path="/negociacoes" element={<Negociacoes />} />
            <Route path="/proventos" element={<Proventos />} />
            <Route path="/posicao" element={<Posicao />} />
            <Route path="/imposto-renda" element={<ImpostoRenda />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
