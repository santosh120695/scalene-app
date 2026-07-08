import { RegisterPage } from "@/pages/RegisterPage";
import { LoginPage } from "@/pages/LoginPage";
import { ReactElement } from "react";
import { AppPage } from "@/pages/AppPage";
import { Navigate, Route, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/auth";

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
    path: "/#registeer",
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
    element: <AppPage />,
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
