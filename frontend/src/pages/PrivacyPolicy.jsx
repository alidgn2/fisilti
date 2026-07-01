import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-10 relative z-10" data-testid="privacy-page">
            <article className="border-2 border-ink bg-paper/70 p-6 sm:p-8">
                <p className="font-mono text-[11px] uppercase tracking-widest text-stamp">KVKK Aydınlatma Metni</p>
                <h2 className="font-masthead text-4xl font-black mt-1">Gizlilik Politikası</h2>
                <p className="font-serif italic text-inkmuted mt-2">Son güncelleme: 1 Temmuz 2026</p>

                <div className="divider-dashed my-6" />

                <LegalSection title="Veri Sorumlusu">
                    Fısıltı Gazetesi, kullanıcı hesabı oluşturma, içerik paylaşma, mesajlaşma ve platform güvenliği süreçlerinde işlenen kişisel veriler bakımından veri sorumlusu olarak hareket eder.
                </LegalSection>

                <LegalSection title="İşlenen Veriler">
                    Hesap bilgileri (ad, kullanıcı adı, e-posta), profil bilgileri (bio, mahalle, profil fotoğrafı), paylaştığın fısıltılar, isteğe bağlı konum/mahalle ifadeleri, mesajlaşma içerikleri, bildirim kayıtları, güvenlik/oturum kayıtları ve ödeme/boost işlemleri için gerekli teknik kayıtlar işlenebilir.
                </LegalSection>

                <LegalSection title="İşleme Amaçları">
                    Hesap açmak, oturum güvenliği sağlamak, fısıltı ve yorum yayınlamak, mesajlaşmayı çalıştırmak, kötüye kullanımı önlemek, şikayet/moderasyon süreçlerini yürütmek, yasal talepleri karşılamak ve hizmeti iyileştirmek.
                </LegalSection>

                <LegalSection title="Hukuki Sebep ve Toplama Yöntemi">
                    Veriler; kayıt, profil düzenleme, fısıltı yazma, mesaj gönderme ve siteyi kullanma sırasında elektronik ortamda toplanır. İşleme faaliyetleri sözleşmenin kurulması/ifası, hukuki yükümlülük, meşru menfaat ve gerekli olduğu durumlarda açık rıza temellerine dayanabilir.
                </LegalSection>

                <LegalSection title="Aktarım">
                    Veriler; barındırma, veritabanı, ödeme, güvenlik ve analitik gibi altyapı hizmet sağlayıcılarıyla yalnızca hizmetin çalışması için gerekli ölçüde paylaşılabilir. Yasal zorunluluk halinde yetkili kurumlarla paylaşım yapılabilir.
                </LegalSection>

                <LegalSection title="Saklama ve Silme">
                    Hesabını <Link to="/ayarlar" className="underline">Ayarlar</Link> sayfasından silebilirsin. Hesap silindiğinde oturum, takip, mesaj ve bildirim kayıtların temizlenir; daha önce yazılmış fısıltılar platform bütünlüğü için “Silinmiş Muhabir” adıyla anonimleştirilmiş şekilde kalabilir.
                </LegalSection>

                <LegalSection title="KVKK Madde 11 Hakların">
                    Kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, eksik/yanlış verinin düzeltilmesini isteme, şartları varsa silinmesini veya yok edilmesini isteme, aktarıldığı üçüncü kişilerin bildirilmesini isteme, otomatik işlemlerle aleyhine sonuç çıkmasına itiraz etme ve zararın giderilmesini talep etme haklarına sahipsin.
                </LegalSection>

                <LegalSection title="Başvuru">
                    KVKK talepleri için hesabındaki e-posta adresinden <a className="underline" href="mailto:destek@fisiltigazetesi.app">destek@fisiltigazetesi.app</a> adresine yazabilir veya hesap silme işlemini Ayarlar sayfasından başlatabilirsin.
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
