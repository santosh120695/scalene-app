import { RegisterPage } from "@/pages/RegisterPage";
import { LoginPage } from "@/pages/LoginPage";
import { lazy, ReactElement, Suspense } from "react";
import { AppPage } from "@/pages/AppPage";
import { Navigate, Route, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/auth";
import { TodosPage } from "@/pages/TodosPage";

// The journal is lazy-loaded — its editor bundle (Tiptap + journal UI) stays out
// of the initial app chunk until the user opens /journal.
const JournalHomePage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalHomePage })),
);
const JournalTodayPage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalTodayPage })),
);
const JournalDayPage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalDayPage })),
);
const JournalItemPage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalItemPage })),
);
const JournalTagPage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalTagPage })),
);

function LazyRoute({ children }: { children: ReactElement }) {
  return (
    <Suspense fallback={<div className="h-screen bg-page" />}>{children}</Suspense>
  );
}

type IRouteType = {
  path: string;
  need_auth: boolean;
  element: ReactElement;
};

const IRoutes: IRouteType[] = [
  {
    path: "/login",
    need_auth: false,
    element: <LoginPage />,
  },
  {
    path: "/register",
    need_auth: false,
    element: <RegisterPage />,
  },
  {
    path: "/",
    need_auth: true,
    element: <AppPage />,
  },
  {
    path: "/b/:boardId",
    need_auth: true,
    element: <AppPage />,
  },
  {
    path: "/b/:boardId/item/:itemId",
    element: <AppPage />,
    need_auth: true,
  },
  {
    path: "/todos",
    element: <TodosPage />,
    need_auth: true,
  },
  {
    path: "/journal",
    element: (
      <LazyRoute>
        <JournalHomePage />
      </LazyRoute>
    ),
    need_auth: true,
  },
  {
    path: "/journal/today",
    element: (
      <LazyRoute>
        <JournalTodayPage />
      </LazyRoute>
    ),
    need_auth: true,
  },
  {
    path: "/journal/day/:date",
    element: (
      <LazyRoute>
        <JournalDayPage />
      </LazyRoute>
    ),
    need_auth: true,
  },
  {
    path: "/journal/item/:itemId",
    element: (
      <LazyRoute>
        <JournalItemPage />
      </LazyRoute>
    ),
    need_auth: true,
  },
  {
    path: "/journal/tag/:tag",
    element: (
      <LazyRoute>
        <JournalTagPage />
      </LazyRoute>
    ),
    need_auth: true,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
    need_auth: true,
  },
];

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

function MountRoutes() {
  return IRoutes.map((route) => (
    <Route
      key={route.path}
      path={route.path}
      element={
        route.need_auth ? (
          <RequireAuth>{route.element}</RequireAuth>
        ) : (
          <RedirectIfAuthed>{route.element}</RedirectIfAuthed>
        )
      }
    />
  ));
}

export default MountRoutes;
