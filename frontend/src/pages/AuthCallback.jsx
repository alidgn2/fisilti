import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const hash = window.location.hash;
        const match = hash.match(/session_id=([^&]+)/);
        if (!match) {
            navigate("/giris", { replace: true });
            return;
        }
        const sessionId = match[1];

        (async () => {
            try {
                const { data } = await api.post("/auth/google-session", { session_id: sessionId });
                setUser(data.user);
                // Clean hash and go home
                window.history.replaceState(null, "", "/");
                navigate("/", { replace: true });
            } catch {
                navigate("/giris?error=oauth", { replace: true });
            }
        })();
    }, [navigate, setUser]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center" data-testid="auth-callback-loading">
            <div className="text-center">
                <p className="font-masthead text-3xl">Yetki Mührü Vuruluyor...</p>
                <p className="mt-2 font-mono uppercase tracking-widest text-inkmuted text-xs">Lütfen bekleyin</p>
            </div>
        </div>
    );
}
