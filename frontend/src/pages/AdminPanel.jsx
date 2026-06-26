import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { CATEGORIES } from "@/constants/categories";
import { toast } from "sonner";
import { ShieldCheck, Megaphone, AlertOctagon } from "lucide-react";

export default function AdminPanel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState("reports");
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role !== "admin") {
            navigate("/");
        }
    }, [user, navigate]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/admin/reports", { params: { status: "open" } });
            setReports(data);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === "admin" && tab === "reports") loadReports();
    }, [user, tab]);

    const moderate = async (whisperId, action) => {
        try {
            await api.post(`/admin/whispers/${whisperId}/moderate`, { action });
            toast.success(action === "hide" ? "Gizlendi" : action === "approve" ? "Onaylandı" : "Silindi");
            setReports((rs) => rs.filter((r) => r.whisper_id !== whisperId));
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    if (!user || user.role !== "admin") return null;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 relative z-10" data-testid="admin-panel-page">
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp flex items-center gap-2"><ShieldCheck size={12} /> Editör</p>
            <h2 className="font-masthead text-4xl font-black mt-1 mb-2">Editör Locası</h2>
            <p className="font-serif italic text-inkmuted">Şikayetleri incele, sponsorlu fısıltı yayınla.</p>

            <div className="flex gap-2 mt-6 mb-6">
                <button onClick={() => setTab("reports")} className={`flex items-center gap-2 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest ${tab === "reports" ? "bg-ink text-paper" : ""}`} data-testid="admin-tab-reports">
                    <AlertOctagon size={12} /> Şikayetler
                </button>
                <button onClick={() => setTab("sponsored")} className={`flex items-center gap-2 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest ${tab === "sponsored" ? "bg-ink text-paper" : ""}`} data-testid="admin-tab-sponsored">
                    <Megaphone size={12} /> Sponsorlu Fısıltı
                </button>
            </div>

            <div className="divider-double mb-6" />

            {tab === "reports" && (
                <div data-testid="admin-reports-list">
                    {loading ? (
                        <p className="font-mono uppercase tracking-widest text-xs text-inkmuted">Yükleniyor...</p>
                    ) : reports.length === 0 ? (
                        <p className="font-serif italic text-inkmuted">Açık şikayet yok. Sessiz bir gün.</p>
                    ) : (
                        <ul className="space-y-6">
                            {reports.map((r) => (
                                <li key={r.report_id} className="border-2 border-ink p-4 bg-paper/60" data-testid={`report-row-${r.report_id}`}>
                                    <div className="flex items-center justify-between mb-2 font-mono text-[10px] uppercase tracking-widest text-inkmuted">
                                        <span><strong className="text-stamp">{r.reason}</strong> • muhabir <Link to={`/muhabir/${r.reporter_id}`} className="underline">{r.reporter_name}</Link></span>
                                        <span>{new Date(r.created_at).toLocaleString("tr-TR")}</span>
                                    </div>
                                    {r.whisper ? (
                                        <Link to={`/fisilti/${r.whisper_id}`} className="block font-mono text-sm leading-snug border-l-4 border-ink pl-3 my-3 hover:text-stamp">
                                            <p className="text-[10px] uppercase tracking-widest text-inkmuted">[{r.whisper.category}] — {r.whisper.author_name}</p>
                                            {r.whisper.content?.slice(0, 220)}{r.whisper.content?.length > 220 ? "..." : ""}
                                            {r.whisper.moderation_status === "hidden" && (
                                                <span className="ml-2 stamp" style={{ fontSize: 10 }}>GİZLİ</span>
                                            )}
                                        </Link>
                                    ) : (
                                        <p className="font-serif italic text-inkmuted">[Fısıltı silinmiş]</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button onClick={() => moderate(r.whisper_id, "hide")} className="btn-outline-ink" data-testid={`moderate-hide-${r.report_id}`}>Gizle</button>
                                        <button onClick={() => moderate(r.whisper_id, "approve")} className="btn-outline-ink" data-testid={`moderate-approve-${r.report_id}`}>Onayla</button>
                                        <button onClick={() => moderate(r.whisper_id, "delete")} className="btn-ink" data-testid={`moderate-delete-${r.report_id}`}>Sil</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {tab === "sponsored" && <SponsoredForm />}
        </div>
    );
}

function SponsoredForm() {
    const [form, setForm] = useState({
        sponsor_name: "",
        sponsor_url: "",
        content: "",
        category: "kahvehane",
        overheard_from: "",
        location: "",
    });
    const [busy, setBusy] = useState(false);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const { data } = await api.post("/admin/whispers/sponsored", form);
            toast.success("Sponsorlu fısıltı yayınlandı");
            setForm({ sponsor_name: "", sponsor_url: "", content: "", category: "kahvehane", overheard_from: "", location: "" });
            window.location.href = `/fisilti/${data.whisper_id}`;
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="border-2 border-ink p-6 bg-paper/60 space-y-4" data-testid="sponsored-form">
            <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Yeni Sponsorlu Fısıltı</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Sponsor Adı</label>
                    <input className="telegram-input" value={form.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} required minLength={2} data-testid="sponsored-name-input" />
                </div>
                <div>
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Sponsor URL (ops.)</label>
                    <input className="telegram-input" value={form.sponsor_url} onChange={(e) => set("sponsor_url", e.target.value)} placeholder="https://..." data-testid="sponsored-url-input" />
                </div>
            </div>
            <div>
                <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Fısıltı Metni</label>
                <textarea className="telegram-input min-h-[120px] resize-none" maxLength={600} value={form.content} onChange={(e) => set("content", e.target.value)} required minLength={10} data-testid="sponsored-content-input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kategori</label>
                    <select className="telegram-input no-arrow" value={form.category} onChange={(e) => set("category", e.target.value)} data-testid="sponsored-category-select">
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Mevki (ops.)</label>
                    <input className="telegram-input" value={form.location} onChange={(e) => set("location", e.target.value)} data-testid="sponsored-location-input" />
                </div>
                <div>
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Duyulan (ops.)</label>
                    <input className="telegram-input" value={form.overheard_from} onChange={(e) => set("overheard_from", e.target.value)} data-testid="sponsored-overheard-input" />
                </div>
            </div>
            <div className="flex justify-end">
                <button type="submit" disabled={busy} className="btn-ink" data-testid="sponsored-submit-btn">
                    {busy ? "Yayınlanıyor..." : "Yayınla"}
                </button>
            </div>
        </form>
    );
}
