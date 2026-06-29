import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function FollowList({ type }) {
    const { userId } = useParams();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const title = type === "followers" ? "Takipçiler" : "Takip Edilenler";

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/users/${userId}/${type}`);
                setPeople(data);
            } catch (e) {
                toast.error(formatApiError(e));
            } finally {
                setLoading(false);
            }
        })();
    }, [type, userId]);

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 relative z-10" data-testid={`follow-list-${type}`}>
            <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-stamp">MUHABİR DEFTERİ</p>
            <h2 className="font-masthead text-4xl sm:text-5xl font-black mt-1">{title}</h2>

            <div className="mt-8 border-2 border-ink bg-paper/60 divide-y-2 divide-ink/20">
                {loading ? (
                    <p className="p-6 font-mono text-xs uppercase tracking-widest text-inkmuted">Yükleniyor...</p>
                ) : people.length === 0 ? (
                    <p className="p-6 font-serif italic text-inkmuted">Liste şimdilik boş.</p>
                ) : people.map((person) => (
                    <Link key={person.user_id} to={`/muhabir/${person.user_id}`} className="p-4 flex items-center gap-4 hover:bg-ink/5">
                        {person.picture ? (
                            <img src={person.picture} alt={person.name} className="w-12 h-12 border-2 border-ink object-cover grayscale" />
                        ) : (
                            <div className="w-12 h-12 border-2 border-ink flex items-center justify-center font-masthead text-xl font-black">
                                {person.name?.[0]?.toUpperCase() || "M"}
                            </div>
                        )}
                        <div>
                            <p className="font-masthead text-2xl font-black">{person.name}</p>
                            {person.username && <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">@{person.username}</p>}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
