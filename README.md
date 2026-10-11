# Maze Chaser · Kasaba Games

HTML5 Canvas ve Vanilla JavaScript ile yazılmış, Türkçe/İngilizce destekli arcade labirent oyunu. Sürüm: **pre.alpha.0.0.5**. 1.000 bölüm, sekiz hayalet türü, Q/E yetenekleri, aksiyon sahneleri, bölüm seçimi, kayıt sistemi, puan dükkânı ve 100 görev içerir. Bu pre-alpha güncellemesi kombo göstergesi, olaylara özel arcade sesleri, bölüm girişleri ve kalıcı efekt ayarlarını ekler.

## Çalıştırma

Node.js 20 veya üstü ile, bu klasörde:

```sh
npm run dev
```

Tarayıcıda **http://127.0.0.1:8765** adresini aç. Paket kurulumu ve derleme gerekmez. ES modülleri nedeniyle HTML dosyasını çift tıklamak yerine HTTP sunucusu kullanılır. Dosyaları düzenledikten sonra sayfayı yenile.

Farklı port için `PORT=8766 npm run dev` kullanılabilir.

## Arcade ayarları

Üst çubuktaki **Ayarlar** düğmesi ses açma/kapama, ses seviyesi, ses denemesi, ekran sarsıntısı, parçacıklar, bölüm girişleri ve azaltılmış hareket seçeneklerini açar. Tercihler `maze-chaser-settings-v1` anahtarıyla bu tarayıcıda saklanır; oyun kayıtlarından bağımsızdır. Sesler varsayılan olarak kapalıdır. Ses bağlamı kullanıcı etkileşimiyle açılır.

Bölüm başında kısa bir giriş gösterilir. **Atla / Enter** ile atlanabilir; giriş boyunca dünya, hayaletler ve güç süreleri ilerlemez. Ayarlar veya dükkân açıkken süreler durur. Sistem azaltılmış hareket istiyorsa bu tercih otomatik uygulanır.

Aynı güç döneminde yakalanan hayaletler kombo göstergesinde sayılır. Her hayalet hâlâ **+200** puandır; gösterilen toplam puan çarpan değildir. Yeni güç yemi, güç süresinin bitişi, can kaybı veya yeni bölüm seriyi sıfırlar. Kombo bilgisi yeni kayıtlarda korunur; eski kayıtlar açılmaya devam eder.

## Challenge modu

Ana menüden **Challenge → Challenge üret** yolunu seç. Kolay, normal veya zor seçimi yeni bir rastgele tohum, labirent, hayalet kadrosu ve tek kural üretir. Önizlemede harita, kural, canlar ve ödül görünür. **Yeni challenge üret** ile değiştirebilirsin.

- **Yeteneksiz koşu:** Q/E kapalı; güç yemleri kullanılabilir.
- **Güç yemleri en sona:** bütün küçük yemlerden önce güç yemi alınırsa deneme biter. Köşelerdeki ek bağlantılar küçük yemlere güç yemini almadan ulaşılmasını sağlar.
- **Güç yemsiz:** güç yemleri küçük yemlere dönüşür; Q/E kullanılabilir.
- **Tek can:** ilk ölüm denemeyi bitirir.
- **Zamana karşı:** kolayda 240, normalde 210, zorda 180 saniye. Duraklatma, açık menüler, giriş ve aksiyon sahnelerinde süre durur.

- **Kısa güç:** güç yemleri 4 saniye etkili.
- **Hızlı hayaletler:** normal hızları %20 artar, korku hızları korunur.
- **Yetenek bütçesi:** Q/E toplam kolayda 8, normalde 6, zorda 4 başarılı kullanım. Geçersiz zıplama, yön tamponu ve bekleme süresindeki basışlar hak tüketmez. Haklar bitince yeteneksiz devam edilir; can kaybı hakları yenilemez.
- **Hayalet avı:** son yemden önce kolayda 2, normalde 3, zorda 4 hayalet yenmeli. Hedef eksikken son yem denemeyi bitirir. Avlanan sayı HUD'da görünür.
- **Barışçıl koşu:** korkmuş hayalet yemek denemeyi bitirir; normal hayalet teması olağan şekilde can azaltır.

Havuzdaki 10 kural aynı rastgele üreticiyle seçilir. Yetenek hakları ve av hedefi her yeni denemede sıfırlanır.

Tüm yemlerden sonra merkezdeki can yemini alarak tamamla. Kolay/normal/zor için **+300 / +500 / +800** tamamlama bonusu bir kez ödenir. Normal yem ve hayalet puanları ile bonuslar ortak cüzdana eklenir. Challenge rekoru `maze-chaser-challenge-high-v1` altında tutulur; bölüm rekorunu değiştirmez. Challenge manuel/otomatik kayıt almaz ve mevcut bölüm kayıtlarını değiştirmez. **Ana menü** denemeyi bırakır. Sonuç ekranında aynı tohum ve zorlukla yeniden dene veya yeni challenge üret.

## Görevler

Üst çubuktaki **Görevler** düğmesi ayrı hedef ekranını açar. Toplam **100 kalıcı görev** birlikte ilerler; bir görev seçmek gerekmez. Puan biriktirme, tek oyunda skor, küçük/güç yemi, mıknatısla yem çekme, hayalet yeme, bölüm bitirme, başarılı Q/E kullanımı ve Challenge başarıları vardır. Her 10 Challenge kuralıyla bir kez bitirme görevleri de bulunur.

Altı kategori ve tümü/devam eden/ödülü hazır/ödülü alınan filtreleri, 10 görevlik sayfalar ve ilerleme çubukları bulunur. Başarı ödülü **Ödülü al** veya **Hazır ödülleri topla** ile harcanabilir cüzdana eklenir. Her görev bir kez ödül verir; ödüller oyun skorunu ve rekorunu değiştirmez, puan biriktirme hedeflerine dahil edilmez.

İlerleme `maze-chaser-missions-v1`, alınan ödüller mevcut cüzdandaki `missionRewards` listesinde saklanır. Daha önceki toplam kazanılan puan ve rekor içeri alınır; bilinmeyen eski yem/hayalet sayıları tahmin edilmez. Görev ekranı açıkken oyun ve süreler durur. Sayfayı yenilemek veya oyun kaydını yüklemek görev ilerlemesini geri almaz.

Yeni oyun kayıtları koşu başına görev sayaçlarını da taşır; aynı eski noktayı tekrar oynarken sayılmış olaylar iki kez ilerleme yazmaz. Sayaçsız eski kayıtlar açılmaya devam eder; bu kayıtlarda önceki kredilendirilmiş skor aşıldıktan sonraki olaylar sayılır. İlerleme/ödüller aynı tarayıcı ve origin'e bağlıdır.

## Proje yapısı

```text
index.html                  HTML arayüzü ve ana giriş
index-ghosts.html            Eski adres için yönlendirme
src/
  main.js                   Oyun örneğini oluşturup başlatır
  core/                     Game, ortak bileşenler ve DOM bağlantıları
  gameplay/                 Labirent, hareket, oyuncu, hayaletler, yetenekler
  rendering/                Canvas, sprite yükleme, efektler ve ara sahneler
  ui/                       HUD, bölüm seçimi ve puan dükkânı
  storage/                  Oyun kayıtları ve kalıcı cüzdan
  input/                    Klavye, dokunma ve odak olayları
  audio/                    Web Audio sesleri
  i18n/                     Türkçe/İngilizce metinler ve dil yönetimi
  data/                     Ayarlar, haritalar, hayaletler, ürünler, görsel URL’leri
styles/                     Ortak, oyun, menü ve ekran stilleri
assets/                     Oyuncu, hayalet, ikon, aksiyon ve dükkân görselleri
scripts/dev-server.mjs       Bağımlılıksız yerel sunucu
tests/                      Mekanik, kayıt, dükkân ve proje bütünlüğü kontrolleri
archive/                    Önceki index.html; aktif oyunda kullanılmaz
```

Ayrıntılı sistem açıklamaları ve değişiklik noktaları [CODE-STRUCTURE.md](./CODE-STRUCTURE.md) içinde bulunur.

## Kontroller

```sh
npm test
```

143 davranış kontrolü, ilk 1.000 haritanın erişilebilirliği ve farklılığı, dil, AI, yetenekler, kayıt yükleme, cüzdan ve giyim kurallarını sınar. Ek proje kontrolleri modül/görsel/stil yollarını ve sunucu MIME türlerini doğrular. 24 ek arcade kontrolü geçişlerin dünyayı dondurmasını, menü duraklatmasını, tercihlerin kalıcılığını, eski kayıt/kombo uyumluluğunu, azaltılmış hareketi ve Web Audio zamanlamasını sınar. Testler gerçek ES modüllerini yükler; üretim koduna test kancası eklemez.

## Kayıtlar ve puanlar

Kayıtlar, dil tercihi, rekor, cüzdan ve koleksiyon `localStorage` içinde tutulur. Modüler yapıya geçişte mevcut anahtarlar ve kayıt biçimi korunmuştur. Aynı tarayıcı ve aynı site adresindeki kayıtlar kullanılmaya devam eder; farklı port veya başka tarayıcı ayrı depolama alanıdır.

- `K` / **Kaydet**: mevcut oyunu kaydet.
- **Kaydet ve menü**: kaydet ve başlangıç ekranına dön.
- Her 5 bölümün sonunda otomatik checkpoint alınır; 1000. bölümde tamamlanma kaydı oluşturulur.
- Alışveriş bölüm skorunu, rekoru veya toplam kazanılan puanı azaltmaz.
- Cyber Armor, Pumpkin, Space Suit ve Viking Armor tam settir. Diğer kostüm ve başlıklar birlikte veya ayrı takılabilir.

## Yayınlama

Bu klasörün `index.html`, `src/`, `styles/` ve `assets/` içeriğini statik bir HTTP sunucusuna yüklemek yeterlidir. `scripts/`, `tests/`, `archive/` ve belgeler oyun için zorunlu değildir. Görsel URL’leri modül konumundan çözüldüğü için proje bir alt dizinde de çalışır.
