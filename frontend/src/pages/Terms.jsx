import { Link } from "react-router-dom";

export default function Terms() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-10 relative z-10" data-testid="terms-page">
            <article className="border-2 border-ink bg-paper/70 p-6 sm:p-8">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">Platform Kuralları</p>
                <h2 className="font-masthead text-4xl font-black mt-1">Kullanım Şartları</h2>
                <p className="font-serif italic text-inkmuted mt-2">Son güncelleme: 1 Temmuz 2026</p>

                <div className="divider-dashed my-6" />

                <LegalSection title="18+ Kullanım">
                    Fısıltı Gazetesi yalnızca 18 yaş ve üzeri kullanıcılar içindir. Kayıt olarak 18 yaşından büyük olduğunu beyan edersin.
                </LegalSection>

                <LegalSection title="Söylenti Niteliği">
                    Platformdaki içerikler kullanıcı paylaşımlarıdır; haber, yatırım tavsiyesi, kesin bilgi veya resmi açıklama değildir. İçerikleri doğrulamak kullanıcının sorumluluğundadır.
                </LegalSection>

                <LegalSection title="Yasak İçerikler">
                    Hakaret, tehdit, hedef gösterme, özel hayatın gizliliğini ihlal, kişisel veri ifşası, nefret söylemi, yasa dışı faaliyet, spam, taciz ve yanıltıcı manipülasyon yasaktır.
                </LegalSection>

                <LegalSection title="Kullanıcı Sorumluluğu">
                    Paylaştığın fısıltı, yorum, mesaj ve görsellerden sen sorumlusun. Başkalarına ait kişisel verileri, izinsiz fotoğrafları veya özel bilgileri paylaşmamalısın.
                </LegalSection>

                <LegalSection title="Moderasyon">
                    Fısıltı Gazetesi; şikayet edilen, riskli görülen veya kuralları ihlal eden içerikleri gizleyebilir, silebilir, hesabı kısıtlayabilir veya kapatabilir.
                </LegalSection>

                <LegalSection title="Hesap ve Veri Talepleri">
                    Hesabını <Link to="/ayarlar" className="underline">Ayarlar</Link> sayfasından silebilirsin. Veri talepleri için <a className="underline" href="mailto:destek@fisiltigazetesi.app">destek@fisiltigazetesi.app</a> adresine yazabilirsin.
                </LegalSection>
            </article>
        </div>
    );
}

function LegalSection({ title, children }) {
    return (
        <section className="mb-6">
            <h3 className="font-masthead text-2xl font-black mb-2">{title}</h3>
            <p className="font-serif text-lg leading-relaxed text-ink/85">{children}</p>
        </section>
    );
}
