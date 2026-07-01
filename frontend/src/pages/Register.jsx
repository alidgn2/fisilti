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

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [ageConfirmed, setAgeConfirmed] = useState(false);
    const [privacyNoticeRead, setPrivacyNoticeRead] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!ageConfirmed || !privacyNoticeRead || !termsAccepted) {
            toast.error("Devam etmek için 18+ beyanını, gizlilik metnini ve kullanım şartlarını tamamlamalısın.");
            return;
        }
        setBusy(true);
        try {
            await register(email, password, name, {
                age_confirmed: ageConfirmed,
                privacy_notice_read: privacyNoticeRead,
                terms_accepted: termsAccepted,
            });
            toast.success("Muhabir kartın hazır!");
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
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Yeni Muhabir</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Kayıt Ol</h2>
                <p className="font-serif text-lg italic text-inkmuted mt-1">Kalemini al, sahaya in.</p>

                <div className="divider-dashed my-6" />

                <form onSubmit={submit} className="space-y-5" data-testid="register-form">
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Muhabir Adı</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="telegram-input"
                            placeholder="Mahalleli Muhabir"
                            required
                            minLength={2}
                            data-testid="register-name-input"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="telegram-input"
                            placeholder="muhabir@fisilti.com"
                            required
                            data-testid="register-email-input"
                        />
                    </div>
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Şifre (en az 6 hane)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="telegram-input"
                            placeholder="••••••"
                            minLength={6}
                            required
                            data-testid="register-password-input"
                        />
                    </div>
                    <label className="flex items-start gap-3 border-2 border-ink p-3 font-serif text-sm leading-snug">
                        <input
                            type="checkbox"
                            checked={ageConfirmed}
                            onChange={(e) => setAgeConfirmed(e.target.checked)}
                            className="mt-1"
                            required
                            data-testid="register-age-checkbox"
                        />
                        <span>18 yaşından büyük olduğumu ve platformun anonim/söylenti niteliğini anladığımı beyan ederim.</span>
                    </label>
                    <label className="flex items-start gap-3 border-2 border-ink p-3 font-serif text-sm leading-snug">
                        <input
                            type="checkbox"
                            checked={privacyNoticeRead}
                            onChange={(e) => setPrivacyNoticeRead(e.target.checked)}
                            className="mt-1"
                            required
                            data-testid="register-privacy-checkbox"
                        />
                        <span>
                            <Link to="/gizlilik" className="underline">Gizlilik Politikası</Link> kapsamındaki aydınlatma metnini okudum.
                        </span>
                    </label>
                    <label className="flex items-start gap-3 border-2 border-ink p-3 font-serif text-sm leading-snug">
                        <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-1"
                            required
                            data-testid="register-terms-checkbox"
                        />
                        <span>
                            <Link to="/kullanim-sartlari" className="underline">Kullanım Şartları</Link> metnini kabul ediyorum.
                        </span>
                    </label>
                    <button type="submit" disabled={busy} className="btn-ink w-full" data-testid="register-submit-btn">
                        {busy ? "Kayıt ediliyor..." : "Muhabir Ol"}
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
                    data-testid="register-google-btn"
                >
                    <span className="inline-block w-4 h-4 border-2 border-ink rounded-full" />
                    Google ile Devam Et
                </button>

                <p className="mt-6 text-center font-mono text-xs uppercase tracking-widest text-inkmuted">
                    Zaten muhabir misin?{" "}
                    <Link to="/giris" className="underline text-ink" data-testid="register-login-link">Giriş yap</Link>
                </p>
            </div>
        </div>
    );
}
