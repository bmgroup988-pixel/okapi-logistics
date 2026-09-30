import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './lib/auth';
import { App } from './App';
import './index.css';

// Installable sur mobile (agent en agence) — app shell mis à jour
// automatiquement en tâche de fond, jamais les appels /api (voir vite.config.ts).
registerSW({ immediate: true });

const queryClient = new QueryClient({
  // refetchOnWindowFocus: revient sur l'onglet/l'appli → données à jour
  // immédiatement (ex. DAF qui reprend l'appli après avoir enregistré un
  // colis ailleurs). Les écrans "à suivre en direct" (tableau de bord,
  // liste des colis, groupages) ajoutent en plus un refetchInterval court —
  // voir ces pages — pour une mise à jour même sans changer d'onglet.
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
