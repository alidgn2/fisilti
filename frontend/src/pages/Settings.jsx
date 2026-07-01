import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Camera, Lock, Save, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

function initial(name) {
    return name?.[0]?.toUpperCase() || "M";
}

function imageToAvatarDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            reject(new Error("Lütfen bir görsel seç"));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Görsel okunamadı"));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error("Görsel hazırlanamadı"));
            img.onload = () => {
                const size = 320;
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                const scale = Math.max(size / img.width, size / img.height);
                const width = img.width * scale;
                const height = img.height * scale;
                ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

export default function Settings() {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [name, setName] = useState(user?.name || "");
    const [username, setUsername] = useState(user?.username || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [neighborhood, setNeighborhood] = useState(user?.neighborhood || "");
    const [picture, setPicture] = useState(user?.picture || null);
    const [profileVisibility, setProfileVisibility] = useState(user?.profile_visibility || "public");
    const [allowMessages, setAllowMessages] = useState(user?.allow_messages || "everyone");
    const prefs = user?.notification_preferences || {};
    const [notifyMessages, setNotifyMessages] = useState(prefs.messages !== false);
    const [notifyFollows, setNotifyFollows] = useState(prefs.follows !== false);
    const [notifyComments, setNotifyComments] = useState(prefs.comments !== false);
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(false);

    if (!user) return null;

    const chooseFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await imageToAvatarDataUrl(file);
            setPicture(dataUrl);
        } catch (err) {
            toast.error(err.message);
        } finally {
            event.target.value = "";
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            const { data } = await api.put("/users/me", {
                name,
                username,
                bio,
                neighborhood,
                picture,
                profile_visibility: profileVisibility,
                allow_messages: allowMessages,
                notify_messages: notifyMessages,
                notify_follows: notifyFollows,
                notify_comments: notifyComments,
            });
            setUser(data);
            toast.success("Profil güncellendi");
            navigate("/profil");
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    const deleteAccount = async () => {
        const text = window.prompt("Hesabı silmek için HESABIMI SIL yaz.");
        if (text !== "HESABIMI SIL") return;
        setDeleting(true);
        try {
            await api.delete("/users/me", { data: { confirm: "HESABIMI SIL" } });
            toast.success("Hesap silindi");
            window.location.href = "/";
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 relative z-10" data-testid="settings-page">
            <form onSubmit={submit} className="border-2 border-ink bg-paper/60 p-6 sm:p-8">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Muhabir Masası</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Profil Ayarları</h2>
                <p className="font-serif italic text-inkmuted mt-1">Kimliğini düzenle; fısıltıların yazı olarak kalır.</p>

                <div className="divider-dashed my-6" />

                <div className="flex flex-col sm:flex-row gap-6">
                    <div className="shrink-0">
                        {picture ? (
                            <img src={picture} alt={name} className="w-32 h-32 border-2 border-ink object-cover grayscale" data-testid="settings-avatar-preview" />
                        ) : (
                            <div className="w-32 h-32 border-2 border-ink flex items-center justify-center font-masthead text-5xl font-black" data-testid="settings-avatar-preview">
                                {initial(name)}
                            </div>
                        )}
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={chooseFile} data-testid="settings-avatar-input" />
                        <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline-ink flex items-center gap-2" data-testid="settings-avatar-btn">
                                <Camera size={14} /> Seç
                            </button>
                            {picture && (
                                <button type="button" onClick={() => setPicture(null)} className="btn-outline-ink flex items-center gap-2" data-testid="settings-avatar-remove-btn">
                                    <Trash2 size={14} /> Sil
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 space-y-5">
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Muhabir Adı</label>
                            <input
                                className="telegram-input"
                                value={name}
                                minLength={2}
                                maxLength={60}
                                required
                                onChange={(e) => setName(e.target.value)}
                                data-testid="settings-name-input"
                            />
                        </div>

                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kullanıcı Adı</label>
                            <input
                                className="telegram-input"
                                value={username}
                                minLength={3}
                                maxLength={24}
                                placeholder="ornek_muhabir"
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                data-testid="settings-username-input"
                            />
                        </div>

                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Mahalle</label>
                            <input
                                className="telegram-input"
                                value={neighborhood}
                                maxLength={60}
                                placeholder="Kadıköy, Beşiktaş..."
                                onChange={(e) => setNeighborhood(e.target.value)}
                                data-testid="settings-neighborhood-input"
                            />
                        </div>

                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kısa Bio</label>
                            <textarea
                                className="telegram-input min-h-[92px] resize-y"
                                value={bio}
                                maxLength={160}
                                placeholder="Mahallenin sessiz tanığı..."
                                onChange={(e) => setBio(e.target.value)}
                                data-testid="settings-bio-input"
                            />
                        </div>

                        <button type="submit" disabled={busy} className="btn-ink flex items-center gap-2" data-testid="settings-save-btn">
                            <Save size={14} /> {busy ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>

                <div className="divider-dashed my-8" />

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-2 border-ink p-4 bg-paper/50">
                        <h3 className="font-masthead text-2xl font-black flex items-center gap-2">
                            <Bell size={18} /> Bildirimler
                        </h3>
                        <div className="mt-4 space-y-3 font-mono text-xs uppercase tracking-widest">
                            <Toggle checked={notifyMessages} onChange={setNotifyMessages} label="Yeni mesajlar" />
                            <Toggle checked={notifyFollows} onChange={setNotifyFollows} label="Yeni takipçiler" />
                            <Toggle checked={notifyComments} onChange={setNotifyComments} label="Yorumlar" />
                        </div>
                    </div>

                    <div className="border-2 border-ink p-4 bg-paper/50">
                        <h3 className="font-masthead text-2xl font-black flex items-center gap-2">
                            <Shield size={18} /> Gizlilik
                        </h3>
                        <label className="block mt-4">
                            <span className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Profil görünürlüğü</span>
                            <select value={profileVisibility} onChange={(e) => setProfileVisibility(e.target.value)} className="telegram-input no-arrow">
                                <option value="public">Herkese açık</option>
                                <option value="followers">Sadece takipçiler</option>
                            </select>
                        </label>
                        <label className="block mt-4">
                            <span className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kim mesaj atabilir?</span>
                            <select value={allowMessages} onChange={(e) => setAllowMessages(e.target.value)} className="telegram-input no-arrow">
                                <option value="everyone">Herkes</option>
                                <option value="followers">Sadece takipçiler</option>
                            </select>
                        </label>
                    </div>
                </section>

                <div className="divider-dashed my-8" />

                <section className="border-2 border-stamp p-4 bg-paper/50">
                    <h3 className="font-masthead text-2xl font-black flex items-center gap-2 text-stamp">
                        <Lock size={18} /> Tehlikeli Alan
                    </h3>
                    <p className="font-serif italic text-inkmuted mt-2">
                        Hesabını silersen oturumun kapanır, mesajların ve takiplerin temizlenir. Yazdığın fısıltılar silinmiş muhabir adıyla kalır.
                    </p>
                    <p className="font-serif text-inkmuted mt-2">
                        KVKK kapsamındaki veri talepleri için hesabındaki e-posta adresinden{" "}
                        <a className="underline" href="mailto:destek@fisiltigazetesi.app">destek@fisiltigazetesi.app</a> adresine yazabilirsin.
                    </p>
                    <button type="button" onClick={deleteAccount} disabled={deleting} className="btn-outline-ink mt-4 flex items-center gap-2" data-testid="settings-delete-account-btn">
                        <Trash2 size={14} /> {deleting ? "Siliniyor..." : "Hesabı Sil"}
                    </button>
                </section>
            </form>
        </div>
    );
}

function Toggle({ checked, onChange, label }) {
    return (
        <label className="flex items-center justify-between gap-4 border-b border-dashed border-ink/30 pb-3">
            <span>{label}</span>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`min-w-[58px] border-2 border-ink px-2 py-1 ${checked ? "bg-ink text-paper" : "bg-paper text-ink"}`}
            >
                {checked ? "Açık" : "Kapalı"}
            </button>
        </label>
    );
}
