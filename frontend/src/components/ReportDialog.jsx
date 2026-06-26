import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Flag } from "lucide-react";

const REASONS = [
    "Yalan/uydurma haber",
    "Hakaret/küfür",
    "Kişisel bilgi (telefon/adres)",
    "Spam/reklam",
    "Şiddet/tehdit",
    "Diğer",
];

export default function ReportDialog({ open, onOpenChange, whisperId }) {
    const [reason, setReason] = useState(REASONS[0]);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!whisperId) return;
        setBusy(true);
        try {
            const { data } = await api.post(`/whispers/${whisperId}/report`, { reason });
            if (data.duplicate) {
                toast.message("Bu fısıltıyı zaten raporlamıştın");
            } else {
                toast.success("Editöre bildirildi, teşekkürler");
            }
            onOpenChange(false);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-paper border-2 border-ink rounded-none p-0" data-testid="report-dialog">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle className="font-masthead text-3xl font-black flex items-center gap-2">
                        <Flag size={22} className="text-stamp" /> Fısıltıyı Bildir
                    </DialogTitle>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">
                        Editör incelemesine gönderilecek
                    </p>
                </DialogHeader>
                <div className="px-6 pb-6">
                    <div className="divider-double my-4" />
                    <label className="font-mono text-[11px] uppercase tracking-widest text-inkmuted">Sebep</label>
                    <div className="grid gap-2 mt-2">
                        {REASONS.map((r) => (
                            <label key={r} className="flex items-center gap-3 cursor-pointer font-serif text-base" data-testid={`report-reason-${r}`}>
                                <input
                                    type="radio"
                                    name="report-reason"
                                    value={r}
                                    checked={reason === r}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="accent-stamp"
                                />
                                {r}
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={() => onOpenChange(false)} className="btn-outline-ink" data-testid="report-cancel-btn">İptal</button>
                        <button type="button" onClick={submit} disabled={busy} className="btn-ink" data-testid="report-submit-btn">
                            {busy ? "Gönderiliyor..." : "Editöre Bildir"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
