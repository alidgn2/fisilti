import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";

function startGoogleLogin() {
    const googleAuthUrl = process.env.REACT_APP_GOOGLE_AUTH_URL;
    if (!googleAuthUrl) return;
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `${googleAuthUrl}?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await login(email, password);
            toast.success("Hoş geldin muhabir!");
            navigate("/");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-md mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Editör Kapısı</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Giriş Yap</h2>
                <p className="font-serif text-lg italic text-inkmuted mt-1">Muhabir kartını ibraz et.</p>

                <div className="divider-dashed my-6" />

                <form onSubmit={submit} className="space-y-5" data-testid="login-form">
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="telegram-input"
                            placeholder="muhabir@fisilti.com"
                            required
                            data-testid="login-email-input"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Şifre</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="telegram-input"
                            placeholder="••••••"
                            required
                            data-testid="login-password-input"
                        />
                    </div>
                    <button type="submit" disabled={busy} className="btn-ink w-full" data-testid="login-submit-btn">
                        {busy ? "Mühür vuruluyor..." : "Giriş Yap"}
                    </button>
                </form>

                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 divider-dashed" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-inkmuted">ya da</span>
                    <div className="flex-1 divider-dashed" />
                </div>

                <button
                    type="button"
                    onClick={startGoogleLogin}
                    disabled={!process.env.REACT_APP_GOOGLE_AUTH_URL}
                    className="btn-outline-ink w-full flex items-center justify-center gap-2"
                    data-testid="login-google-btn"
                >
                    {/* simple G mark */}
                    <span className="inline-block w-4 h-4 border-2 border-ink rounded-full" />
                    Google ile Giriş Yap
                </button>

                <p className="mt-6 text-center font-mono text-xs uppercase tracking-widest text-inkmuted">
                    Henüz muhabir değil misin?{" "}
                    <Link to="/kayit" className="underline text-ink" data-testid="login-register-link">Muhabir Ol</Link>
                </p>
            </div>
        </div>
    );
}
