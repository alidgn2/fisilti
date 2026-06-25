import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, MessageSquare, MapPin, Ear } from "lucide-react";
import StampBadge from "@/components/StampBadge";
import { api, formatApiError } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

function timeAgoTr(iso) {
    const then = new Date(iso);
    const diff = Math.floor((Date.now() - then.getTime()) / 1000);
    if (diff < 60) return "az önce";
    if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} gün önce`;
    return then.toLocaleDateString("tr-TR");
}

export default function WhisperCard({ whisper, onChange, compact = false }) {
    const [w, setW] = useState(whisper);
    const [busy, setBusy] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const vote = async (value) => {
        if (!user) {
            navigate("/giris");
            return;
        }
        if (busy) return;
        setBusy(true);
        try {
            const { data } = await api.post(`/whispers/${w.whisper_id}/vote`, { value });
            setW(data);
            if (onChange) onChange(data);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    const score = (w.upvotes || 0) - (w.downvotes || 0);

    return (
        <article
            className="break-inside-avoid mb-10 pb-6 border-b border-dashed border-ink/40 animate-paper-in"
            data-testid={`whisper-card-${w.whisper_id}`}
        >
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <StampBadge categoryId={w.category} />
                <span className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                    {timeAgoTr(w.created_at)}
                </span>
            </div>

            <Link to={`/fisilti/${w.whisper_id}`} className="block group" data-testid={`whisper-link-${w.whisper_id}`}>
                <p className={`font-mono leading-relaxed text-[15px] text-ink ${compact ? "" : "dropcap"}`}>
                    {w.content}
                </p>
            </Link>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-[12px] font-mono uppercase tracking-wider text-inkmuted">
                <div className="flex items-center gap-3 flex-wrap">
                    <span>— {w.author_name}</span>
                    {w.overheard_from && (
                        <span className="flex items-center gap-1">
                            <Ear size={12} /> {w.overheard_from}
                        </span>
                    )}
                    {w.location && (
                        <span className="flex items-center gap-1">
                            <MapPin size={12} /> {w.location}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => vote(1)}
                        disabled={busy}
                        className={`px-2 py-1 border-2 border-ink hover:bg-ink hover:text-paper transition-colors ${w.my_vote === 1 ? "bg-ink text-paper" : ""}`}
                        data-testid={`whisper-upvote-${w.whisper_id}`}
                        aria-label="Doğru"
                    >
                        <ArrowUp size={14} />
                    </button>
                    <span className="px-2 font-bold text-ink min-w-[2ch] text-center" data-testid={`whisper-score-${w.whisper_id}`}>{score}</span>
                    <button
                        onClick={() => vote(-1)}
                        disabled={busy}
                        className={`px-2 py-1 border-2 border-ink hover:bg-ink hover:text-paper transition-colors ${w.my_vote === -1 ? "bg-ink text-paper" : ""}`}
                        data-testid={`whisper-downvote-${w.whisper_id}`}
                        aria-label="Yalan"
                    >
                        <ArrowDown size={14} />
                    </button>
                    <Link
                        to={`/fisilti/${w.whisper_id}`}
                        className="ml-2 flex items-center gap-1 px-2 py-1 border-2 border-ink hover:bg-ink hover:text-paper"
                        data-testid={`whisper-comments-link-${w.whisper_id}`}
                    >
                        <MessageSquare size={13} /> {w.comment_count}
                    </Link>
                </div>
            </div>
        </article>
    );
}
