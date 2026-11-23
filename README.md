# Kim Milyoner Olamamak İster?

Tarayıcıda oynanan Türkçe ve İngilizce bilgi oyununun ilk prototipi. Her turda 10 özgün soruluk havuzdan beş farklı soru gelir. Seçtiğin şıkkı **Son kararım** ile kilitle. Bir turda bir kez 50:50 jokeri kullanabilir veya o ana kadar kazandığın puanla çekilebilirsin.

## Yerel çalıştırma

Node.js 22.18+ ve npm gerekir.

```sh
npm ci
npm run dev
```

Terminalde verilen yerel adresi aç. `npm test` oyun motorunu, veri modelini ve üretim paketinin DOM akışlarını test eder. `npm run build` statik paketi `dist/` altında oluşturur. Paketi yerelde çalıştırmak için `npm run preview` kullan. Statik kaynak bağlantıları, proje alt dizininden sunulabilecek şekilde göreli üretilir. Kurulum gerektirmeyen tek HTML dosyasını oluşturmak için `npm run standalone` çalıştır ve `dist/oyun.html` dosyasını tarayıcıda aç. Dosya üzerinden oynarken turun kaydedilmesi tarayıcının yerel dosya depolama desteğine bağlıdır.

Tur ve dil/tema seçimi aynı tarayıcıda saklanır. Klavyede Tab ile denetimler arasında ilerle, ok tuşlarıyla şıkkı değiştir ve **Son kararım** düğmesini etkinleştir. Ayarlardan soru dilini arayüz dilinden bağımsız seçebilirsin.

## Prototip puanları

| Soru | Puan |
| --- | ---: |
| 1 | 100 |
| 2 | 250 |
| 3 | 500 |
| 4 | 1.000 |
| 5 | 2.000 |

İkinci doğru cevap 250 puanı garantiler. Yanlış cevapla tur bittiğinde barajın öncesinde 0, sonrasında 250 puan kazanılır. Çekilme anındaki puan korunur. Tur süresizdir.

## Kaynak dosyaları

- `src/game.ts` tur durumu, puanlama, joker ve kayıt doğrulaması.
- `src/questions.ts` sürümlü veri modeli, soru havuzu ve oynanabilirlik filtresi.
- `src/i18n.ts`, `src/main.ts` ve `src/styles.css` arayüz metinleri, ekranlar ve stiller.
- `tests/` motor, veri, kayıt ve üretim çıktısının DOM entegrasyon testleri.

## Arşiv aktarımı için veri sözleşmesi

[Drive soru arşivindeki](https://docs.google.com/spreadsheets/d/1UTRhjVnHaoY2S_bXqF9GRm5Uj2_SOremjh_lpqXsC7U/edit) `Sorular` sekmesinin kayıt kimliği, ülke, dil, sürüm, basamak, şık, cevap ve kaynak sütunları için eşleme noktaları aşağıdadır.

| Arşiv alanı | Uygulama modeli |
| --- | --- |
| Kalıcı soru ve içerik kimliği | `id`, `contentId` |
| Özgün dil, metin ve A–D seçenekleri | `original.language`, `original.text`, `original.revision` |
| Doğru şık | `correctOptionId`, diller arasında değişmeyen seçenek kimliği |
| Kayda bağlı incelenmiş çeviri | `translations[language]`, kaynak revizyonu ve kabul durumu |
| Olay/kayıt kimlikleri, ülke, sürüm, tarihsel basamak, kaynak ve özgün şık sırası/etiketi | `provenance.occurrences`, bilinmeyen basamak için `null` |
| Lisans ve yayımlama kararı | `provenance.license`, `provenance.publication` |
| Medya ve kalite durumu | `playability`, metinle oynanabilen ve incelenen kayıtlar için `text-ready` |

Arşiv aktarımı, gelecekte doğrulama ve yayım kararı verilmiş bir oyun veri çıktısı üretebilir. Arşivdeki özgün satır ve araştırma alanları Drive’da korunur. Bu prototipin bankasındaki on kayıt bu oyun için yazıldı. Banka değiştiğinde `dataVersion` artırılır.

## Run locally in English

Install Node.js 22.18 or later, run `npm ci` and `npm run dev`, then open the local URL and select **English**. Run `npm test` for the game and data checks, or `npm run build` to create the static bundle.
