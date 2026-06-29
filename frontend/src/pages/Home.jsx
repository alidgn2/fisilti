import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { CATEGORIES } from "@/constants/categories";
import WhisperCard from "@/components/WhisperCard";
import { toast } from "sonner";
import { Flame, Clock, Trophy, Newspaper, Users, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const SORTS = [
    { id: "new", label: "En Yeni", icon: Clock },
    { id: "trending", label: "Yükselen", icon: Flame },
    { id: "top", label: "En Çok Konuşulan", icon: Trophy },
    { id: "following", label: "Takip Ettiklerim", icon: Users, requiresAuth: true },
];

export default function Home() {
    const [whispers, setWhispers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState("all");
    const [sort, setSort] = useState("trending");
    const { user } = useAuth();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (!user) {
                setWhispers([]);
                return;
            }
            if (sort === "following") {
                const { data } = await api.get("/whispers/following", { params: { limit: 60 } });
                setWhispers(data);
            } else {
                const { data } = await api.get("/whispers", { params: { category, sort, limit: 60 } });
                setWhispers(data);
            }
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [category, sort, user]);

    useEffect(() => { load(); }, [load]);

    // Top whispers for sidebar
    const headline = whispers[0];
    const restWhispers = whispers.slice(1);

    if (!user) {
        return <WelcomeLanding />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp">SON DAKİKA — MAHALLE AJANSI</p>
                    <h2 className="font-masthead text-3xl sm:text-4xl font-black mt-1">Günün Fısıltıları</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                    {SORTS.map(({ id, label, icon: Icon, requiresAuth }) => {
                        if (requiresAuth && !user) return null;
                        return (
                            <button
                                key={id}
                                onClick={() => setSort(id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${sort === id ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                                data-testid={`sort-${id}-btn`}
                            >
                                <Icon size={12} /> {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Category chips - hidden when viewing following feed */}
            {sort !== "following" && (
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
            )}
            {sort === "following" && <div className="mb-8 pb-6 border-b-2 border-double border-ink" />}

            {/* Headline + Feed */}
            {loading ? (
                <div className="py-20 text-center font-mono uppercase tracking-widest text-inkmuted text-sm" data-testid="home-loading">
                    Baskı makineleri çalışıyor...
                </div>
            ) : whispers.length === 0 ? (
                <EmptyState following={sort === "following"} />
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
                                            <Link to={`/fisilti/${w.whisper_id}`} className="hover:text-stamp transition-colors block" data-testid={`sidebar-link-${w.whisper_id}`}>
                                                <span className="text-stamp uppercase tracking-widest mr-1">[{w.category}]</span>
                                                {w.content.slice(0, 110)}{w.content.length > 110 ? "..." : ""}
                                            </Link>
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

function WelcomeLanding() {
    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10" data-testid="welcome-landing">
            <section className="min-h-[64vh] border-y-4 border-double border-ink py-10 sm:py-14">
                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-center">
                    <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.45em] text-stamp mb-4">
                            MAHALLE AJANSI - SADECE SÖYLENTİ
                        </p>
                        <h1 className="font-masthead text-5xl sm:text-7xl lg:text-8xl font-black leading-none">
                            Fısıltı Gazetesi
                        </h1>
                        <p className="mt-5 max-w-2xl font-serif text-xl sm:text-2xl italic text-ink/80">
                            Kahvehaneden, berberden, taksiden halkın kulağına çalınanlar burada toplanır.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/kayit" className="btn-ink inline-flex items-center gap-2" data-testid="welcome-register-link">
                                <Newspaper size={16} /> Muhabir Ol
                            </Link>
                            <Link to="/giris" className="btn-outline-ink inline-flex items-center gap-2" data-testid="welcome-login-link">
                                <LogIn size={16} /> Giriş Yap
                            </Link>
                        </div>
                    </div>

                    <div className="border-l-0 lg:border-l-2 lg:border-dashed border-ink/40 lg:pl-10">
                        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-stamp mb-3">Bugünün Manşetleri</p>
                        <div className="space-y-5">
                            <LandingHeadline category="Kahvehane" title="Masadaki sessizlik bile haber olur." />
                            <LandingHeadline category="Taksi" title="Yol kısa, dedikodu uzun." />
                            <LandingHeadline category="Berber" title="Makas çalışır, mahalle konuşur." />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

function LandingHeadline({ category, title }) {
    return (
        <article className="border-b-2 border-ink pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-stamp">{category}</p>
            <h2 className="font-masthead text-2xl sm:text-3xl font-black mt-1">{title}</h2>
        </article>
    );
}

function EmptyState({ following = false }) {
    return (
        <div className="text-center py-20 border-2 border-dashed border-ink/50" data-testid="home-empty-state">
            <p className="font-masthead text-3xl font-black">Sessizlik...</p>
            <p className="font-serif text-lg italic mt-2 text-inkmuted">
                {following
                    ? "Henüz takip ettiğin muhabir yok ya da onlardan yeni bir fısıltı çıkmamış. Bir muhabir profili açıp 'Takip Et'e bas."
                    : "Bu kategoride henüz bir fısıltı kayda geçmedi. İlk muhabir sen ol."}
            </p>
        </div>
    );
}
