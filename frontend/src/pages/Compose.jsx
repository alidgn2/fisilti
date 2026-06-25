import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { CATEGORIES } from "@/constants/categories";
import { toast } from "sonner";

export default function Compose() {
    const navigate = useNavigate();
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("kahvehane");
    const [overheardFrom, setOverheardFrom] = useState("");
    const [location, setLocation] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        document.title = "Yeni Fısıltı | Fısıltı Gazetesi";
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        if (content.trim().length < 10) {
            toast.error("Fısıltı en az 10 karakter olmalı");
            return;
        }
        setBusy(true);
        try {
            const { data } = await api.post("/whispers", {
                content: content.trim(),
                category,
                location: location.trim() || null,
                overheard_from: overheardFrom.trim() || null,
            });
            toast.success("Fısıltı baskıya gönderildi!");
            navigate(`/fisilti/${data.whisper_id}`);
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    const remaining = 600 - content.length;

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Sahaya Çık</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Yeni Fısıltı</h2>
                <p className="font-serif text-lg italic text-inkmuted mt-1">
                    Kahvehanede, berberde, taksicide kulağına çalınan dünya gündemine dair bir şey mi var? Yaz, halk bilsin.
                </p>

                <div className="divider-dashed my-6" />

                <form onSubmit={submit} className="space-y-6" data-testid="compose-form">
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Fısıltının Metni</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="telegram-input min-h-[180px] resize-none mt-1"
                            placeholder="Bugün berber Cemal abi diyor ki, dolar şu hafta sonra falanca olacakmış çünkü..."
                            maxLength={600}
                            required
                            data-testid="compose-content-input"
                        />
                        <div className="text-right font-mono text-[11px] text-inkmuted">{remaining} karakter kaldı</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Nereden duyduğun</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="telegram-input no-arrow"
                                data-testid="compose-category-select"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kimden? (ops.)</label>
                            <input
                                type="text"
                                value={overheardFrom}
                                onChange={(e) => setOverheardFrom(e.target.value)}
                                className="telegram-input"
                                placeholder="Berber Cemal Abi"
                                maxLength={80}
                                data-testid="compose-overheard-input"
                            />
                        </div>
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Mevki (ops.)</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="telegram-input"
                                placeholder="Kadıköy / İstanbul"
                                maxLength={80}
                                data-testid="compose-location-input"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => navigate(-1)} className="btn-outline-ink" data-testid="compose-cancel-btn">
                            İptal
                        </button>
                        <button type="submit" disabled={busy} className="btn-ink" data-testid="compose-submit-btn">
                            {busy ? "Baskıya gönderiliyor..." : "Yayınla"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
