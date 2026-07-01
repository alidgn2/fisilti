import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, MessageSquare, MapPin, Ear, Share2, Flag, Megaphone, Sparkles } from "lucide-react";
import StampBadge from "@/components/StampBadge";
import ShareModal from "@/components/ShareModal";
import ReportDialog from "@/components/ReportDialog";
import HashtagText from "@/components/HashtagText";
import { api, formatApiError } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
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
    const [shareOpen, setShareOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
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
            trackEvent(value === 1 ? "upvote_whisper" : "downvote_whisper", { category: w.category });
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
                <div className="flex items-center gap-2 flex-wrap">
                    <StampBadge categoryId={w.category} />
                    {w.is_boosted && (
                        <span className="stamp stamp-ink flex items-center gap-1" data-testid={`boosted-stamp-${w.whisper_id}`}>
                            <Sparkles size={10} /> Manşet
                        </span>
                    )}
                    {w.is_sponsored && (
                        <span className="stamp stamp-blue flex items-center gap-1" data-testid={`sponsored-stamp-${w.whisper_id}`}>
                            <Megaphone size={10} /> Sponsorlu
                        </span>
                    )}
                </div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                    {timeAgoTr(w.created_at)}
                </span>
            </div>

            <div
                role="link"
                tabIndex={0}
                onClick={(e) => {
                    // Don't navigate when clicking inside a hashtag link
                    if (e.target.closest("a")) return;
                    navigate(`/fisilti/${w.whisper_id}`);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        navigate(`/fisilti/${w.whisper_id}`);
                    }
                }}
                className="block group cursor-pointer"
                data-testid={`whisper-link-${w.whisper_id}`}
            >
                <p className={`font-mono leading-relaxed text-[15px] text-ink ${compact ? "" : "dropcap"}`}>
                    <HashtagText>{w.content}</HashtagText>
                </p>
                {w.image && (
                    <figure className="mt-5 border-2 border-ink bg-paper overflow-hidden">
                        <img
                            src={w.image}
                            alt="Fısıltı görseli"
                            className="w-full max-h-[520px] object-cover grayscale group-hover:grayscale-0 transition duration-300"
                            loading="lazy"
                            data-testid={`whisper-image-${w.whisper_id}`}
                        />
                    </figure>
                )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap text-[12px] font-mono uppercase tracking-wider text-inkmuted">
                <div className="flex items-center gap-3 flex-wrap">
                    <Link
                        to={`/muhabir/${w.author_id}`}
                        className="hover:text-ink hover:underline transition-colors"
                        data-testid={`whisper-author-link-${w.whisper_id}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        — {w.author_name}
                    </Link>
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
                    <button
                        onClick={() => {
                            trackEvent("share_open", { category: w.category });
                            setShareOpen(true);
                        }}
                        className="ml-1 flex items-center gap-1 px-2 py-1 border-2 border-ink hover:bg-ink hover:text-paper"
                        data-testid={`whisper-share-btn-${w.whisper_id}`}
                        aria-label="Paylaş"
                    >
                        <Share2 size={13} />
                    </button>
                    {user && user.user_id !== w.author_id && (
                        <button
                            onClick={() => {
                                trackEvent("report_open", { category: w.category });
                                setReportOpen(true);
                            }}
                            className="ml-1 flex items-center gap-1 px-2 py-1 border-2 border-ink hover:bg-stamp hover:text-paper hover:border-stamp"
                            data-testid={`whisper-report-btn-${w.whisper_id}`}
                            aria-label="Bildir"
                            title="Bildir"
                        >
                            <Flag size={13} />
                        </button>
                    )}
                </div>
            </div>

            <ShareModal open={shareOpen} onOpenChange={setShareOpen} whisper={w} />
            <ReportDialog open={reportOpen} onOpenChange={setReportOpen} whisperId={w.whisper_id} />
        </article>
    );
}
