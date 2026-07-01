import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await api.post("/auth/password/forgot", { email });
            setSent(true);
            toast.success("Eğer hesap varsa sıfırlama bağlantısı gönderildi.");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-md mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Şifre Masası</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Şifremi Unuttum</h2>
                <p className="font-serif text-lg italic text-inkmuted mt-1">Email adresine tek kullanımlık bağlantı yollarız.</p>

                <div className="divider-dashed my-6" />

                {sent ? (
                    <div className="space-y-5">
                        <p className="font-serif text-inkmuted">
                            Eğer bu email ile kayıtlı hesap varsa sıfırlama bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.
                        </p>
                        <Link to="/giris" className="btn-ink w-full text-center">Girişe Dön</Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="telegram-input"
                                placeholder="muhabir@fisilti.com"
                                required
                                data-testid="forgot-email-input"
                            />
                        </div>
                        <button type="submit" disabled={busy} className="btn-ink w-full" data-testid="forgot-submit-btn">
                            {busy ? "Gönderiliyor..." : "Bağlantı Gönder"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
