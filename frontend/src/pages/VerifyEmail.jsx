import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";

export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = useMemo(() => params.get("token") || "", [params]);
    const [status, setStatus] = useState("loading");
    const [message, setMessage] = useState("Email doğrulanıyor...");

    useEffect(() => {
        async function verify() {
            if (!token) {
                setStatus("error");
                setMessage("Doğrulama bağlantısı eksik.");
                return;
            }
            try {
                await api.post("/auth/email/verify", { token });
                setStatus("ok");
                setMessage("Email adresin doğrulandı.");
            } catch (err) {
                setStatus("error");
                setMessage(formatApiError(err));
            }
        }
        verify();
    }, [token]);

    return (
        <div className="max-w-md mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Muhabir Kimliği</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Email Doğrulama</h2>
                <div className="divider-dashed my-6" />
                <p className={`font-serif text-lg ${status === "error" ? "text-stamp" : "text-inkmuted"}`}>{message}</p>
                <Link to="/giris" className="btn-ink w-full text-center mt-6">Girişe Git</Link>
            </div>
        </div>
    );
}
