# Uçuş Planı

Pilotların aylık uçuş programı PDF'ini (Ekip Planlama Sistemi – "AYLIK UCUS PROGRAMI")
okunur bir takvime ve istatistiklere çeviren PWA.

- Takvim: hangi gün uçuşta / evde, evden çıkış saati (kalkıştan X saat önce), kalkış, dönüş
- İstatistik: uçuş ve görev saati, yurt dışı / Türkiye süresi, dinlenme, gidilen şehirler, yasal limitler
- Eşle paylaşım linki, telefon takvimine (.ics) aktarma
- Çevrimdışı çalışır

**Gizlilik:** PDF tarayıcıda (pdf.js) okunur, hiçbir sunucuya gönderilmez. Veriler yalnızca cihazın
`localStorage`'ında tutulur. Pasaport vb. kişisel belge bilgileri okunmaz.

## Geliştirme

```bash
npm install            # sadece testler için (pdfjs-dist)
python3 -m http.server 8765
node test/parse.test.mjs ~/Downloads/program.pdf   # PDF ayrıştırma çıktısı
node test/stats.test.mjs ~/Downloads/program.pdf   # aylık istatistikler
```

Kod yapısı: `js/parser.js` (PDF → veri), `js/model.js` (günler, seferler, istatistik, .ics),
`js/app.js` (arayüz), `sw.js` (çevrimdışı önbellek). Dosya değiştiğinde `sw.js` içindeki `VERSION`'ı artırın.

PDF dosyalarını repoya eklemeyin (`.gitignore` engeller) — kişisel bilgi içerirler.
