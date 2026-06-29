# Fısıltı Gazetesi Mobile

Expo tabanlı native mobil uygulama başlangıcı. WebView kullanmaz; doğrudan canlı backend API'sine bağlanır.

## Expo Go ile Hızlı Deneme

```powershell
cd mobile
npm install
npm run start
```

Sonra telefona Expo Go kurup terminalde çıkan QR kodu okut.

## Ayrı Android Uygulaması Alma

Expo Go sadece deneme içindir. Telefona ayrı APK kurmak için:

```powershell
cd mobile
npm install
npx eas login
npx eas build -p android --profile preview
```

Build bitince Expo sana `.apk` indirme linki verir. O APK telefona kurulur.

## Notlar

- Backend: `https://sea-lion-app-jcnrp.ondigitalocean.app`
- Giriş/kayıt, fısıltı listeleme ve fısıltı bırakma native ekrandan çalışır.
- Sonraki native adımlar: kalıcı güvenli oturum, profil, arama, mesajlar, push bildirimleri, Play Store / App Store build.
