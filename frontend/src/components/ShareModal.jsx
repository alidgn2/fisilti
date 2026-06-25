import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toPng, toBlob } from "html-to-image";
import { Download, Share2, Copy, Square, Smartphone } from "lucide-react";
import ShareCard from "@/components/ShareCard";
import { toast } from "sonner";

export default function ShareModal({ open, onOpenChange, whisper }) {
    const cardRef = useRef(null);
    const [format, setFormat] = useState("story"); // "story" | "square"
    const [busy, setBusy] = useState(false);

    if (!whisper) return null;

    const filename = `fisilti-${whisper.whisper_id || "kart"}-${format}.png`;

    const generatePngBlob = async () => {
        if (!cardRef.current) throw new Error("Render hazır değil");
        // Wait for fonts so the snapshot uses Playfair/Special Elite, not fallback
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }
        const blob = await toBlob(cardRef.current, {
            cacheBust: true,
            pixelRatio: 1,
            backgroundColor: "#F4EFE6",
        });
        if (!blob) throw new Error("Görsel oluşturulamadı");
        return blob;
    };

    const download = async () => {
        setBusy(true);
        try {
            const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 1, backgroundColor: "#F4EFE6" });
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast.success("Kart indirildi");
        } catch (e) {
            toast.error("İndirilemedi: " + (e?.message || "hata"));
        } finally {
            setBusy(false);
        }
    };

    const share = async () => {
        setBusy(true);
        try {
            const blob = await generatePngBlob();
            const file = new File([blob], filename, { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Fısıltı Gazetesi",
                    text: "Bir fısıltı kayda geçti — Fısıltı Gazetesi'nde",
                });
                toast.success("Paylaşıldı");
            } else {
                // Fallback: download
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.message("Cihazın paylaşım menüsünü desteklemiyor — kart indirildi, sosyal medyaya yükleyebilirsin.");
            }
        } catch (e) {
            if (e?.name !== "AbortError") {
                toast.error("Paylaşılamadı: " + (e?.message || "hata"));
            }
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        setBusy(true);
        try {
            const blob = await generatePngBlob();
            if (!navigator.clipboard || !window.ClipboardItem) {
                throw new Error("Tarayıcın panoya görsel kopyalamayı desteklemiyor");
            }
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            toast.success("Panoya kopyalandı — Instagram/X'e yapıştırabilirsin");
        } catch (e) {
            toast.error(e?.message || "Kopyalanamadı");
        } finally {
            setBusy(false);
        }
    };

    // Scale preview to fit in modal (1080xH actual → scaled down)
    const previewScale = format === "story" ? 0.22 : 0.34;
    const previewW = 1080 * previewScale;
    const previewH = (format === "story" ? 1920 : 1080) * previewScale;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-2xl bg-paper border-2 border-ink rounded-none p-0"
                data-testid="share-modal"
            >
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="font-masthead text-3xl font-black">Manşet Kupürü</DialogTitle>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                        Story, post veya X için indir/paylaş
                    </p>
                </DialogHeader>

                <div className="px-6 pb-6">
                    <div className="divider-double my-4" />

                    {/* Format toggle */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setFormat("story")}
                            className={`flex items-center gap-2 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${format === "story" ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                            data-testid="share-format-story-btn"
                        >
                            <Smartphone size={12} /> Story (9:16)
                        </button>
                        <button
                            onClick={() => setFormat("square")}
                            className={`flex items-center gap-2 px-3 py-1.5 border-2 border-ink font-mono text-[11px] uppercase tracking-widest transition-colors ${format === "square" ? "bg-ink text-paper" : "hover:bg-ink hover:text-paper"}`}
                            data-testid="share-format-square-btn"
                        >
                            <Square size={12} /> Post (1:1)
                        </button>
                    </div>

                    {/* Preview wrapper (scaled-down visible preview of the actual card) */}
                    <div
                        className="border-2 border-dashed border-ink/50 mx-auto"
                        style={{ width: previewW, height: previewH, overflow: "hidden" }}
                        data-testid="share-preview"
                    >
                        <div
                            style={{
                                transform: `scale(${previewScale})`,
                                transformOrigin: "top left",
                                width: 1080,
                            }}
                        >
                            <ShareCard ref={cardRef} whisper={whisper} format={format} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6">
                        <button onClick={share} disabled={busy} className="btn-ink flex items-center justify-center gap-2" data-testid="share-share-btn">
                            <Share2 size={14} /> Paylaş
                        </button>
                        <button onClick={download} disabled={busy} className="btn-outline-ink flex items-center justify-center gap-2" data-testid="share-download-btn">
                            <Download size={14} /> İndir
                        </button>
                        <button onClick={copy} disabled={busy} className="btn-outline-ink flex items-center justify-center gap-2" data-testid="share-copy-btn">
                            <Copy size={14} /> Kopyala
                        </button>
                    </div>

                    <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-inkmuted text-center">
                        İpucu: Instagram / TikTok Story için Paylaş, X / panoya yapıştırmak için Kopyala
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
