import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { queryPersister } from "@/lib/queryPersistence";
import { useDrainUploadOutbox } from "@/hooks/useDrainUploadOutbox";
import { useAuth } from "@/stores/auth";
import { useTheme } from "@/stores/theme";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AppPage } from "@/pages/AppPage";
import { TodosPage } from "@/pages/TodosPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    // Default 'online' networkMode: mutations queue (fetchStatus 'paused')
    // instead of erroring while offline, then auto-replay on reconnect.
    mutations: { networkMode: "online" },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const initialized = useAuth((s) => s.initialized);
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <span className="font-display text-[20px] italic text-ink-muted">
          Scalene
        </span>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const initialized = useAuth((s) => s.initialized);
  if (initialized && user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Needs the query client from PersistQueryClientProvider, so it's mounted
// inside that tree rather than called directly in App().
function OutboxDrainer() {
  useDrainUploadOutbox();
  return null;
}

export default function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  const initTheme = useTheme((s) => s.init);
  useEffect(() => {
    initTheme();
    bootstrap();
  }, [bootstrap, initTheme]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
      onSuccess={() => {
        // Rehydration only restores state; explicitly kick off a retry for
        // any mutations that were queued offline in a previous session.
        queryClient.resumePausedMutations();
      }}
    >
      <TooltipProvider delayDuration={300}>
        <OfflineBanner />
        <OutboxDrainer />
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <LoginPage />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed>
                  <RegisterPage />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppPage />
                </RequireAuth>
              }
            />
            <Route
              path="/b/:boardId"
              element={
                <RequireAuth>
                  <AppPage />
                </RequireAuth>
              }
            />
            <Route
              path="/b/:boardId/item/:itemId"
              element={
                <RequireAuth>
                  <AppPage />
                </RequireAuth>
              }
            />
            <Route
              path="/todos"
              element={
                <RequireAuth>
                  <TodosPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
