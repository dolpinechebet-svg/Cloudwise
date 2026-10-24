import { useEffect, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

interface ProtectedRouteProps {
  loading: boolean;
  authenticated: boolean;
  onUnauthenticated: () => void;
  children: ReactNode;
}

export default function ProtectedRoute({
  loading, authenticated, onUnauthenticated, children
}: ProtectedRouteProps) {
  useEffect(() => {
    if (!loading && !authenticated) onUnauthenticated();
  }, [authenticated, loading, onUnauthenticated]);

  if (loading) {
    return <div className="loading-page" role="status"><LoaderCircle size={26} className="spin" /><span>{"Checking your session…"}</span></div>;
  }
  if (!authenticated) return null;
  return children;
}
