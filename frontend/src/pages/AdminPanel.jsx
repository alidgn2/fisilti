import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { CATEGORIES } from "@/constants/categories";
import { toast } from "sonner";

function dateText(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("tr-TR");
}

export default function AdminPanel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState("reports");
    const [reports, setReports] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role !== "admin") navigate("/");
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

    const loadLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/admin/logs");
            setLogs(data);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role !== "admin") return;
        if (tab === "reports") loadReports();
        if (tab === "logs") loadLogs();
    }, [user, tab]);

    const moderate = async (whisperId, action) => {
        try {
            await api.post(`/admin/whispers/${whisperId}/moderate`, { action });
            toast.success(action === "hide" ? "İçerik gizlendi" : action === "approve" ? "İçerik onaylandı" : "İçerik silindi");
            setReports((rows) => rows.filter((r) => r.whisper_id !== whisperId));
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const userAction = async (targetUserId, action) => {
        const defaults = {
            warn: "Şikayet edilen içerik nedeniyle uyarı",
            silence: "Şikayet edilen içerik nedeniyle geçici susturma",
            ban: "Tekrarlanan veya ağır kural ihlali",
        };
        const reason = window.prompt("Sebep yaz:", defaults[action]);
        if (!reason) return;
        try {
            await api.post(`/admin/users/${targetUserId}/action`, {
                action,
                reason,
                duration_hours: action === "silence" ? 24 : undefined,
            });
            toast.success(action === "warn" ? "Kullanıcı uyarıldı" : action === "silence" ? "Kullanıcı 24 saat susturuldu" : "Kullanıcı banlandı");
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    if (!user || user.role !== "admin") return null;

    return (
        <div className="min-h-[70vh] bg-[#f7f7f7] text-[#111] -mt-6 py-8" data-testid="admin-panel-page">
            <div className="max-w-7xl mx-auto px-4">
                <header className="flex flex-col gap-4 border-b border-[#d0d0d0] pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#666]">Role-based Admin</p>
                        <h1 className="text-3xl font-bold tracking-tight">Moderasyon Paneli</h1>
                        <p className="text-sm text-[#666]">Şikayet kuyruğu, kullanıcı aksiyonları ve işlem kayıtları.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setTab("reports")} className={`px-4 py-2 border text-sm font-semibold ${tab === "reports" ? "bg-[#111] text-white" : "bg-white"}`}>
                            Şikayet Kuyruğu
                        </button>
                        <button onClick={() => setTab("logs")} className={`px-4 py-2 border text-sm font-semibold ${tab === "logs" ? "bg-[#111] text-white" : "bg-white"}`}>
                            Loglar
                        </button>
                        <button onClick={() => setTab("sponsored")} className={`px-4 py-2 border text-sm font-semibold ${tab === "sponsored" ? "bg-[#111] text-white" : "bg-white"}`}>
                            Sponsorlu İçerik
                        </button>
                    </div>
                </header>

                {tab === "reports" && (
                    <section className="mt-6 bg-white border border-[#d0d0d0]" data-testid="admin-reports-list">
                        <div className="flex items-center justify-between border-b border-[#d0d0d0] px-4 py-3">
                            <h2 className="font-bold">Açık Şikayetler</h2>
                            <button onClick={loadReports} className="px-3 py-1 border text-sm">Yenile</button>
                        </div>
                        {loading ? (
                            <p className="p-4 text-sm text-[#666]">Yükleniyor...</p>
                        ) : reports.length === 0 ? (
                            <p className="p-4 text-sm text-[#666]">Açık şikayet yok.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1050px] text-sm">
                                    <thead className="bg-[#efefef] text-left">
                                        <tr>
                                            <th className="p-3">İçerik</th>
                                            <th className="p-3">Şikayet</th>
                                            <th className="p-3">Şikayet Edenler</th>
                                            <th className="p-3">Durum</th>
                                            <th className="p-3">İçerik Aksiyonu</th>
                                            <th className="p-3">Kullanıcı Aksiyonu</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((row) => (
                                            <tr key={row.queue_id} className="border-t align-top" data-testid={`report-row-${row.queue_id}`}>
                                                <td className="p-3 max-w-[360px]">
                                                    {row.whisper ? (
                                                        <>
                                                            <div className="font-semibold">
                                                                <Link to={`/fisilti/${row.whisper_id}`} className="underline">
                                                                    {row.whisper.content?.slice(0, 180)}
                                                                </Link>
                                                            </div>
                                                            <div className="mt-1 text-xs text-[#666]">
                                                                {row.whisper.category} · {row.whisper.author_name} · {dateText(row.whisper.created_at)}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-[#666]">İçerik silinmiş</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold">{row.report_count} kişi</div>
                                                    <div className="text-xs text-[#666]">İlk: {dateText(row.first_reported_at)}</div>
                                                    <div className="text-xs text-[#666]">Son: {dateText(row.last_reported_at)}</div>
                                                    <div className="mt-2 text-xs">{row.reasons?.join(", ")}</div>
                                                </td>
                                                <td className="p-3">
                                                    <ul className="space-y-1">
                                                        {row.reporters?.slice(0, 5).map((r) => (
                                                            <li key={`${r.user_id}-${r.created_at}`}>
                                                                <Link to={`/muhabir/${r.user_id}`} className="underline">{r.name}</Link>
                                                                <span className="text-xs text-[#666]"> · {r.reason}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                                <td className="p-3">
                                                    <span className="inline-block border px-2 py-1 text-xs font-bold uppercase">
                                                        {row.whisper?.moderation_status || "deleted"}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-2">
                                                        <button onClick={() => moderate(row.whisper_id, "approve")} className="border px-3 py-1 text-left">Onayla</button>
                                                        <button onClick={() => moderate(row.whisper_id, "hide")} className="border px-3 py-1 text-left">Gizle</button>
                                                        <button onClick={() => moderate(row.whisper_id, "delete")} className="border border-red-700 bg-red-50 px-3 py-1 text-left text-red-800">İçeriği Sil</button>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {row.whisper?.user_id ? (
                                                        <div className="flex flex-col gap-2">
                                                            <button onClick={() => userAction(row.whisper.user_id, "warn")} className="border px-3 py-1 text-left">Kullanıcıyı Uyar</button>
                                                            <button onClick={() => userAction(row.whisper.user_id, "silence")} className="border px-3 py-1 text-left">24 Saat Sustur</button>
                                                            <button onClick={() => userAction(row.whisper.user_id, "ban")} className="border border-red-700 bg-red-50 px-3 py-1 text-left text-red-800">Kullanıcıyı Banla</button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-[#666]">Kullanıcı yok</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {tab === "logs" && <AdminLogs loading={loading} logs={logs} onRefresh={loadLogs} />}
                {tab === "sponsored" && <SponsoredForm />}
            </div>
        </div>
    );
}

function AdminLogs({ loading, logs, onRefresh }) {
    return (
        <section className="mt-6 bg-white border border-[#d0d0d0]">
            <div className="flex items-center justify-between border-b border-[#d0d0d0] px-4 py-3">
                <h2 className="font-bold">Moderasyon Logları</h2>
                <button onClick={onRefresh} className="px-3 py-1 border text-sm">Yenile</button>
            </div>
            {loading ? (
                <p className="p-4 text-sm text-[#666]">Yükleniyor...</p>
            ) : logs.length === 0 ? (
                <p className="p-4 text-sm text-[#666]">Log yok.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
                        <thead className="bg-[#efefef] text-left">
                            <tr>
                                <th className="p-3">Tarih</th>
                                <th className="p-3">Admin</th>
                                <th className="p-3">Aksiyon</th>
                                <th className="p-3">Hedef</th>
                                <th className="p-3">Sebep</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.log_id} className="border-t">
                                    <td className="p-3">{dateText(log.created_at)}</td>
                                    <td className="p-3">{log.admin_name}</td>
                                    <td className="p-3 font-semibold">{log.action}</td>
                                    <td className="p-3">{log.target_type}: {log.target_id}</td>
                                    <td className="p-3">{log.reason || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
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

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

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
        <form onSubmit={submit} className="mt-6 bg-white border border-[#d0d0d0] p-5 space-y-4" data-testid="sponsored-form">
            <h2 className="font-bold">Sponsorlu İçerik Yayınla</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="telegram-input bg-white" value={form.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} placeholder="Sponsor adı" required minLength={2} />
                <input className="telegram-input bg-white" value={form.sponsor_url} onChange={(e) => set("sponsor_url", e.target.value)} placeholder="https://..." />
            </div>
            <textarea className="telegram-input bg-white min-h-[120px]" maxLength={600} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="Sponsorlu fısıltı metni" required minLength={10} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select className="telegram-input bg-white no-arrow" value={form.category} onChange={(e) => set("category", e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input className="telegram-input bg-white" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Mevki" />
                <input className="telegram-input bg-white" value={form.overheard_from} onChange={(e) => set("overheard_from", e.target.value)} placeholder="Duyulan yer" />
            </div>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[#111] text-white font-semibold">
                {busy ? "Yayınlanıyor..." : "Yayınla"}
            </button>
        </form>
    );
}
