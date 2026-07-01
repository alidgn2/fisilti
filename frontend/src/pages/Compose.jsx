import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Trash2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { CATEGORIES } from "@/constants/categories";
import { toast } from "sonner";

function imageToWhisperDataUrl(file) {
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
                const maxSide = 1280;
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

export default function Compose() {
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("kahvehane");
    const [overheardFrom, setOverheardFrom] = useState("");
    const [location, setLocation] = useState("");
    const [image, setImage] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        document.title = "Yeni Fısıltı | Fısıltı Gazetesi";
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        if (content.trim().length < 10) {
            toast.error("Fısıltı en az 10 karakter olmalı");
            return;
        }
        setBusy(true);
        try {
            const { data } = await api.post("/whispers", {
                content: content.trim(),
                image,
                category,
                location: location.trim() || null,
                overheard_from: overheardFrom.trim() || null,
            });
            toast.success("Fısıltı baskıya gönderildi!");
            navigate(`/fisilti/${data.whisper_id}`);
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setBusy(false);
        }
    };

    const chooseImage = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await imageToWhisperDataUrl(file);
            setImage(dataUrl);
        } catch (err) {
            toast.error(err.message);
        } finally {
            event.target.value = "";
        }
    };

    const remaining = 600 - content.length;

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 relative z-10">
            <div className="border-2 border-ink p-8 bg-paper/60">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Sahaya Çık</p>
                <h2 className="font-masthead text-4xl font-black leading-tight mt-1">Yeni Fısıltı</h2>
                <p className="font-serif text-lg italic text-inkmuted mt-1">
                    Kahvehanede, berberde, taksicide kulağına çalınan dünya gündemine dair bir şey mi var? Yaz, halk bilsin.
                </p>

                <div className="divider-dashed my-6" />

                <form onSubmit={submit} className="space-y-6" data-testid="compose-form">
                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Fısıltının Metni</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="telegram-input min-h-[180px] resize-none mt-1"
                            placeholder="Bugün berber Cemal abi diyor ki, dolar şu hafta sonra falanca olacakmış çünkü..."
                            maxLength={600}
                            required
                            data-testid="compose-content-input"
                        />
                        <div className="text-right font-mono text-[11px] text-inkmuted">{remaining} karakter kaldı</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Nereden duyduğun</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="telegram-input no-arrow"
                                data-testid="compose-category-select"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Kimden? (ops.)</label>
                            <input
                                type="text"
                                value={overheardFrom}
                                onChange={(e) => setOverheardFrom(e.target.value)}
                                className="telegram-input"
                                placeholder="Berber Cemal Abi"
                                maxLength={80}
                                data-testid="compose-overheard-input"
                            />
                        </div>
                        <div>
                            <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Mevki (ops.)</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="telegram-input"
                                placeholder="Kadıköy / İstanbul"
                                maxLength={80}
                                data-testid="compose-location-input"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Fotoğraf (ops.)</label>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={chooseImage}
                            data-testid="compose-image-input"
                        />
                        {image ? (
                            <div className="mt-2 border-2 border-ink bg-paper">
                                <img src={image} alt="Fısıltı görseli" className="w-full max-h-[420px] object-cover grayscale" data-testid="compose-image-preview" />
                                <div className="flex justify-end gap-2 p-3 border-t-2 border-ink">
                                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline-ink inline-flex items-center gap-2">
                                        <Camera size={14} /> Değiştir
                                    </button>
                                    <button type="button" onClick={() => setImage(null)} className="btn-outline-ink inline-flex items-center gap-2" data-testid="compose-image-remove-btn">
                                        <Trash2 size={14} /> Sil
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="mt-2 w-full border-2 border-dashed border-ink px-4 py-8 font-mono text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors inline-flex items-center justify-center gap-2"
                                data-testid="compose-image-btn"
                            >
                                <Camera size={16} /> Fotoğraf Ekle
                            </button>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => navigate(-1)} className="btn-outline-ink" data-testid="compose-cancel-btn">
                            İptal
                        </button>
                        <button type="submit" disabled={busy} className="btn-ink" data-testid="compose-submit-btn">
                            {busy ? "Baskıya gönderiliyor..." : "Yayınla"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
