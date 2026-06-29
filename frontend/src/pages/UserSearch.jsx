import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Search, UserMinus, UserPlus } from "lucide-react";

export default function UserSearch() {
    const [query, setQuery] = useState("");
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        const term = query.trim();
        if (term.length < 2) {
            setUsers([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const { data } = await api.get("/users/search", { params: { q: term } });
                setUsers(data);
            } catch (e) {
                toast.error(formatApiError(e));
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const toggleFollow = async (userId) => {
        if (busyId) return;
        setBusyId(userId);
        try {
            const { data } = await api.post(`/users/${userId}/follow`);
            setUsers((items) => items.map((item) => (
                item.user_id === userId
                    ? {
                        ...item,
                        is_following: data.is_following,
                        stats: { ...item.stats, follower_count: data.follower_count },
                    }
                    : item
            )));
            toast.success(data.is_following ? "Takip ediliyor" : "Takipten çıkıldı");
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 relative z-10" data-testid="user-search-page">
            <div className="mb-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp">MUHABİR REHBERİ</p>
                <h2 className="font-masthead text-4xl sm:text-5xl font-black mt-1">Muhabir Bul</h2>
            </div>

            <label className="flex items-center gap-3 border-2 border-ink bg-paper/60 px-4 py-3">
                <Search size={18} />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent outline-none font-serif text-xl"
                    placeholder="Kullanıcı adı yaz..."
                    data-testid="user-search-input"
                />
            </label>

            <div className="mt-8 space-y-4" data-testid="user-search-results">
                {loading && (
                    <p className="font-mono text-xs uppercase tracking-widest text-inkmuted">Rehber karıştırılıyor...</p>
                )}

                {!loading && query.trim().length > 1 && users.length === 0 && (
                    <div className="border-2 border-dashed border-ink/50 py-12 text-center">
                        <p className="font-masthead text-3xl font-black">Muhabir bulunamadı</p>
                        <p className="font-serif italic text-inkmuted mt-2">Başka bir isim dene.</p>
                    </div>
                )}

                {users.map((person) => (
                    <article key={person.user_id} className="border-2 border-ink bg-paper/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Link to={`/muhabir/${person.user_id}`} className="flex items-center gap-4 min-w-0" data-testid={`user-search-profile-${person.user_id}`}>
                            {person.picture ? (
                                <img src={person.picture} alt={person.name} className="w-14 h-14 border-2 border-ink object-cover grayscale" />
                            ) : (
                                <div className="w-14 h-14 border-2 border-ink flex items-center justify-center font-masthead text-2xl font-black">
                                    {person.name?.[0]?.toUpperCase() || "M"}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-masthead text-2xl font-black truncate">{person.name}</h3>
                                {person.username && <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">@{person.username}</p>}
                                <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                                    {person.stats?.whisper_count ?? 0} fısıltı - {person.stats?.follower_count ?? 0} takipçi
                                </p>
                            </div>
                        </Link>

                        <button
                            onClick={() => toggleFollow(person.user_id)}
                            disabled={busyId === person.user_id}
                            className={person.is_following ? "btn-outline-ink inline-flex items-center gap-2 justify-center" : "btn-ink inline-flex items-center gap-2 justify-center"}
                            data-testid={`user-search-follow-${person.user_id}`}
                        >
                            {person.is_following ? <><UserMinus size={14} /> Takipten Çık</> : <><UserPlus size={14} /> Takip Et</>}
                        </button>
                    </article>
                ))}
            </div>
        </div>
    );
}
