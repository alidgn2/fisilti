import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { CATEGORIES } from "@/constants/categories";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";
import { Flame, Clock, Trophy, Newspaper } from "lucide-react";

const SORTS = [
    { id: "new", label: "En Yeni", icon: Clock },
    { id: "trending", label: "Yükselen", icon: Flame },
    { id: "top", label: "En Çok Konuşulan", icon: Trophy },
];

export default function Home() {
    const [whispers, setWhispers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState("all");
    const [sort, setSort] = useState("trending");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/whispers", { params: { category, sort, limit: 60 } });
            setWhispers(data);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [category, sort]);

    useEffect(() => { load(); }, [load]);

    // Top whispers for sidebar
    const headline = whispers[0];
    const restWhispers = whispers.slice(1);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp">SON DAKİKA — MAHALLE AJANSI</p>
                    <h2 className="font-masthead text-3xl sm:text-4xl font-black mt-1">Günün Fısıltıları</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                    {SORTS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setSort(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${sort === id ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                            data-testid={`sort-${id}-btn`}
                        >
                            <Icon size={12} /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b-2 border-double border-ink">
                <button
                    onClick={() => setCategory("all")}
                    className={`px-3 py-1 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${category === "all" ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                    data-testid="category-all-btn"
                >
                    Hepsi
                </button>
                {CATEGORIES.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={`px-3 py-1 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${category === c.id ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                        data-testid={`category-${c.id}-btn`}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* Headline + Feed */}
            {loading ? (
                <div className="py-20 text-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="home-loading">
                    Baskı makineleri çalışıyor...
                </div>
            ) : whispers.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* Lead Story */}
                    {headline && (
                        <div className="mb-10 pb-10 border-b-4 border-double border-ink grid grid-cols-1 md:grid-cols-3 gap-8" data-testid="lead-story">
                            <div className="md:col-span-2">
                                <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-stamp mb-2 flex items-center gap-2">
                                    <Newspaper size={12} /> Manşet • {sort === "top" ? "En Çok Konuşulan" : sort === "trending" ? "Yükselen" : "En Taze Fısıltı"}
                                </p>
                                <WhisperCard whisper={headline} />
                            </div>
                            <aside className="md:border-l-2 md:border-dashed md:border-ink/40 md:pl-8">
                                <h3 className="font-masthead text-xl font-black mb-3 border-b-2 border-ink pb-2">Mahalleden Mırıltılar</h3>
                                <ul className="space-y-3">
                                    {restWhispers.slice(0, 5).map((w) => (
                                        <li key={w.whisper_id} className="font-mono text-xs leading-snug">
                                            <a href={`/fisilti/${w.whisper_id}`} className="hover:text-stamp transition-colors block" data-testid={`sidebar-link-${w.whisper_id}`}>
                                                <span className="text-stamp uppercase tracking-widest mr-1">[{w.category}]</span>
                                                {w.content.slice(0, 110)}{w.content.length > 110 ? "..." : ""}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </aside>
                        </div>
                    )}

                    {/* Feed columns */}
                    <div className="newsfeed columns-1 md:columns-2 lg:columns-3" data-testid="whispers-feed">
                        {restWhispers.slice(5).map((w) => (
                            <WhisperCard key={w.whisper_id} whisper={w} />
                        ))}
                    </div>

                    {restWhispers.length <= 5 && (
                        <p className="mt-10 text-center font-mono text-xs uppercase tracking-widest text-inkmuted">
                            Şimdilik bu kadar. Sen de bir fısıltı bırakmak ister misin?
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-20 border-2 border-dashed border-ink/50" data-testid="home-empty-state">
            <p className="font-masthead text-3xl font-black">Sessizlik...</p>
            <p className="font-serif text-lg italic mt-2 text-inkmuted">
                Bu kategoride henüz bir fısıltı kayda geçmedi. İlk muhabir sen ol.
            </p>
        </div>
    );
}
