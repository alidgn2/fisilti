import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";
import { Hash, TrendingUp } from "lucide-react";

export default function HashtagFeed() {
    const { tag } = useParams();
    const [whispers, setWhispers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [trending, setTrending] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: ws }, { data: tr }] = await Promise.all([
                api.get("/whispers", { params: { hashtag: tag, limit: 60, sort: "new" } }),
                api.get("/hashtags/trending"),
            ]);
            setWhispers(ws);
            setTrending(tr);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [tag]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10" data-testid="hashtag-feed-page">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp flex items-center gap-2"><Hash size={12} /> Etiket</p>
                    <h2 className="font-masthead text-4xl sm:text-5xl font-black mt-1">#{tag}</h2>
                </div>
                <Link to="/" className="btn-outline-ink" data-testid="hashtag-back-btn">Manşete Dön</Link>
            </div>

            <div className="border-b-2 border-double border-ink mb-8" />

            {trending.length > 0 && (
                <div className="mb-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-inkmuted mb-2 flex items-center gap-2"><TrendingUp size={12} /> Trend Etiketler</p>
                    <div className="flex flex-wrap gap-2" data-testid="trending-hashtags">
                        {trending.map((t) => (
                            <Link
                                key={t.hashtag}
                                to={`/etiket/${t.hashtag}`}
                                className={`px-3 py-1 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${t.hashtag === tag ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                                data-testid={`trending-tag-${t.hashtag}`}
                            >
                                #{t.hashtag} <span className="ml-1 opacity-70">({t.count})</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="py-20 text-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="hashtag-loading">Aranıyor...</div>
            ) : whispers.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-ink/50" data-testid="hashtag-empty">
                    <p className="font-masthead text-3xl font-black">Boş Kupür</p>
                    <p className="font-serif italic mt-2 text-inkmuted">Bu etiketle henüz fısıltı yok.</p>
                </div>
            ) : (
                <div className="newsfeed columns-1 md:columns-2 lg:columns-3" data-testid="hashtag-whispers">
                    {whispers.map((w) => <WhisperCard key={w.whisper_id} whisper={w} />)}
                </div>
            )}
        </div>
    );
}
