import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 8;

export default function PaymentSuccess() {
    const [params] = useSearchParams();
    const sessionId = params.get("session_id");
    const navigate = useNavigate();
    const [status, setStatus] = useState("checking"); // checking | paid | expired | failed
    const [info, setInfo] = useState(null);
    const attemptsRef = useRef(0);

    useEffect(() => {
        if (!sessionId) {
            setStatus("failed");
            return;
        }
        let cancelled = false;

        const poll = async () => {
            try {
                const { data } = await api.get(`/boost/status/${sessionId}`);
                if (cancelled) return;
                setInfo(data);
                if (data.payment_status === "paid") {
                    setStatus("paid");
                    return;
                }
                if (data.status === "expired") {
                    setStatus("expired");
                    return;
                }
                attemptsRef.current += 1;
                if (attemptsRef.current >= MAX_ATTEMPTS) {
                    setStatus("failed");
                    return;
                }
                setTimeout(poll, POLL_INTERVAL);
            } catch (e) {
                if (cancelled) return;
                setStatus("failed");
                setInfo({ error: formatApiError(e) });
            }
        };

        poll();
        return () => { cancelled = true; };
    }, [sessionId]);

    return (
        <div className="max-w-2xl mx-auto px-4 py-16 relative z-10" data-testid="payment-success-page">
            <div className="border-2 border-ink p-8 bg-paper/60 text-center">
                {status === "checking" && (
                    <>
                        <Clock size={48} className="mx-auto text-inkmuted" />
                        <h2 className="font-masthead text-4xl font-black mt-4">Mühür kontrol ediliyor...</h2>
                        <p className="font-serif italic mt-2 text-inkmuted">Ödemen onaylanıyor, lütfen bekle.</p>
                    </>
                )}
                {status === "paid" && (
                    <>
                        <CheckCircle2 size={48} className="mx-auto text-stamp" />
                        <h2 className="font-masthead text-4xl font-black mt-4">Manşete Çıktın!</h2>
                        <p className="font-serif text-lg italic mt-2 text-inkmuted">
                            Fısıltın 24 saat boyunca manşette sabit kalacak.
                        </p>
                        <div className="mt-6 flex gap-2 justify-center">
                            {info?.whisper_id && (
                                <Link to={`/fisilti/${info.whisper_id}`} className="btn-ink" data-testid="payment-view-whisper-btn">
                                    Fısıltıyı Gör
                                </Link>
                            )}
                            <button onClick={() => navigate("/")} className="btn-outline-ink" data-testid="payment-home-btn">
                                Manşete Dön
                            </button>
                        </div>
                    </>
                )}
                {status === "expired" && (
                    <>
                        <XCircle size={48} className="mx-auto text-stamp" />
                        <h2 className="font-masthead text-4xl font-black mt-4">Süresi Doldu</h2>
                        <p className="font-serif italic mt-2 text-inkmuted">Bu ödeme oturumu zaman aşımına uğradı.</p>
                        <button onClick={() => navigate(-1)} className="btn-outline-ink mt-6" data-testid="payment-back-btn">Geri</button>
                    </>
                )}
                {status === "failed" && (
                    <>
                        <XCircle size={48} className="mx-auto text-stamp" />
                        <h2 className="font-masthead text-4xl font-black mt-4">Hata</h2>
                        <p className="font-serif italic mt-2 text-inkmuted">{info?.error || "Ödeme durumu alınamadı."}</p>
                        <button onClick={() => navigate("/")} className="btn-outline-ink mt-6" data-testid="payment-home-btn">Manşete Dön</button>
                    </>
                )}
            </div>
        </div>
    );
}
