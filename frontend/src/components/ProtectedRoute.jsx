import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="protected-loading">
                Mürekkep kuruyor...
            </div>
        );
    }
    if (!user) return <Navigate to="/giris" replace />;
    return children;
}
