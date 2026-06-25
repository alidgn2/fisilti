import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, ArrowLeft } from "lucide-react";

export default function WhisperDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [whisper, setWhisper] = useState(null);
    const [comments, setComments] = useState([]);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: w }, { data: cs }] = await Promise.all([
                api.get(`/whispers/${id}`),
                api.get(`/whispers/${id}/comments`),
            ]);
            setWhisper(w);
            setComments(cs);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const submitComment = async (e) => {
        e.preventDefault();
        if (!user) {
            navigate("/giris");
            return;
        }
        if (!text.trim()) return;
        setBusy(true);
        try {
            const { data } = await api.post(`/whispers/${id}/comments`, { content: text.trim() });
            setComments((prev) => [...prev, data]);
            setText("");
            if (whisper) setWhisper({ ...whisper, comment_count: (whisper.comment_count || 0) + 1 });
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const removeWhisper = async () => {
        if (!confirm("Bu fısıltıyı silmek istediğinizden emin misiniz?")) return;
        try {
            await api.delete(`/whispers/${id}`);
            toast.success("Fısıltı arşivden silindi");
            navigate("/");
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    if (loading) {
        return <div className="py-20 text-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="detail-loading">Sayfa açılıyor...</div>;
    }
    if (!whisper) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center" data-testid="detail-notfound">
                <p className="font-masthead text-4xl font-black">Sayfa kayıp</p>
                <p className="font-serif italic mt-2 text-inkmuted">Aradığın fısıltı sansürlenmiş olabilir.</p>
                <Link to="/" className="btn-outline-ink mt-6 inline-block">Manşete Dön</Link>
            </div>
        );
    }

    const isOwner = user && (user.user_id === whisper.author_id || user.role === "admin");

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 relative z-10">
            <div className="flex items-center justify-between mb-4 font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-ink" data-testid="detail-back-btn">
                    <ArrowLeft size={12} /> Geri
                </button>
                {isOwner && (
                    <button onClick={removeWhisper} className="flex items-center gap-1 text-stamp hover:underline" data-testid="detail-delete-btn">
                        <Trash2 size={12} /> Sil
                    </button>
                )}
            </div>

            <div className="border-2 border-ink p-6 sm:p-8 mb-10 bg-paper/60">
                <WhisperCard whisper={whisper} />
            </div>

            <h3 className="font-masthead text-2xl font-black mb-3 border-b-2 border-double border-ink pb-2">
                Okur Mektupları <span className="font-mono text-sm text-inkmuted">({comments.length})</span>
            </h3>

            <form onSubmit={submitComment} className="my-6 border-2 border-dashed border-ink/50 p-4" data-testid="comment-form">
                <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Bir okur mektubu yaz</label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="telegram-input min-h-[80px] resize-none mt-1"
                    placeholder={user ? "Sen de buna ekleyecek bir şey var mı?" : "Yorum yapmak için giriş yapmalısın..."}
                    maxLength={400}
                    disabled={!user}
                    data-testid="comment-input"
                />
                <div className="flex justify-end mt-2">
                    <button type="submit" disabled={busy || !user} className="btn-ink" data-testid="comment-submit-btn">
                        {busy ? "Gönderiliyor..." : "Gönder"}
                    </button>
                </div>
            </form>

            <ul className="space-y-5" data-testid="comments-list">
                {comments.map((c) => (
                    <li key={c.comment_id} className="border-b border-dashed border-ink/30 pb-4" data-testid={`comment-${c.comment_id}`}>
                        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-inkmuted mb-1">
                            <span>— {c.author_name}</span>
                            <span>{new Date(c.created_at).toLocaleString("tr-TR")}</span>
                        </div>
                        <p className="font-serif text-lg leading-relaxed">{c.content}</p>
                    </li>
                ))}
                {comments.length === 0 && (
                    <li className="font-serif italic text-inkmuted text-center py-6" data-testid="no-comments">
                        Henüz mektup yok. İlk mektubu sen yaz.
                    </li>
                )}
            </ul>
        </div>
    );
}
