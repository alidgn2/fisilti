import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = useMemo(() => params.get("token") || "", [params]);
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post("/auth/password/reset", { token, password });
            toast.success("Şifren yenilendi. Şimdi giriş yapabilirsin.");
            navigate("/giris");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-md mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni Mühür</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Şifre Sıfırla</h2>

                <div className="divider-dashed my-6" />

                {!token ? (
                    <div className="space-y-5">
                        <p className="font-serif text-inkmuted">Sıfırlama bağlantısı eksik veya bozuk görünüyor.</p>
                        <Link to="/sifremi-unuttum" className="btn-ink w-full text-center">Yeni Bağlantı İste</Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Yeni Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="telegram-input"
                                placeholder="••••••"
                                minLength={6}
                                required
                                data-testid="reset-password-input"
                            />
                        </div>
                        <button type="submit" disabled={busy} className="btn-ink w-full" data-testid="reset-submit-btn">
                            {busy ? "Kaydediliyor..." : "Şifreyi Yenile"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
