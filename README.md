# Maze Chaser · Kasaba Games

HTML5 Canvas ve Vanilla JavaScript ile yazılmış, Türkçe/İngilizce destekli arcade labirent oyunu. Sürüm: **alpha.0.1.0**. Tek oyunculu oyun 1.000 bölüm, sekiz hayalet türü, Q/E yetenekleri, aksiyon sahneleri, bölüm seçimi, kayıt sistemi, puan dükkânı ve 100 görev içerir. Alpha güncellemesi **2–4 oyunculu LAN iş birliği ve puan yarışı** modlarını ekler. Harici paket veya derleme gerekmez.

## Çalıştırma

Node.js 20 veya üstü ile, bu klasörde:

```sh
npm run dev
```

Tarayıcıda **http://127.0.0.1:8765** adresini aç. Paket kurulumu ve derleme gerekmez. ES modülleri nedeniyle HTML dosyasını çift tıklamak yerine HTTP sunucusu kullanılır. Dosyaları düzenledikten sonra sayfayı yenile.

Farklı port için `PORT=8766 npm run dev` kullanılabilir.

## LAN multiplayer

Barındıran bilgisayarda **Node.js 20+** olmalı. Proje klasöründe:

```sh
npm run lan
```

Sunucu `0.0.0.0:8765` üzerinde açılır; terminal yerel IPv4 katılım adreslerini yazar. Oda sahibi `http://127.0.0.1:8765/lan.html` adresini, arkadaşları terminaldeki `http://192.168.x.x:8765/lan.html` adresini kullanır. Normal oyunun başlangıç menüsündeki **LAN Multiplayer** bağlantısı da bu ekrana gider. Diğer bilgisayarlarda Node.js veya proje dosyaları gerekmez; modern tarayıcı yeterlidir.

1. Aynı Wi-Fi/Ethernet ağına bağlanın. Bir bilgisayar sunucuyu çalıştırsın.
2. Oyuncu adını, iki farklı Q/E yeteneğini ve **İş birliği / Puan yarışı** modunu seçip oda oluşturun.
3. Oda kodunu veya katılım bağlantısını paylaşın. Diğer oyuncular adlarını girip katılsın.
4. En az iki, en fazla dört oyuncu **Hazırım** dediğinde oda sahibi **Oyunu başlat** düğmesine basar.

- **İş birliği:** kişisel üç can ve skor, ortak takım toplamı. Yemleri temizleyip merkez can yemini alın; hayaletler son yemle kalkar. Can yemi yaşayan oyuncuların her birine +1 can veya üç canı varsa +500 puan verir. Oda sahibi sonraki haritayı açar; elenen takım arkadaşları bir canla geri döner. Takımın bütün canları biterse maç sona erer.
- **Puan yarışı:** aynı labirentte üç dakika. Küçük yem +10, güç yemi +50, hayalet +200; puan ilk toplayana yazılır. Süre bitince, bir oyuncu kalınca veya merkez can yemi toplanınca en yüksek toplam puan kazanır; eşitlikte ortak kazananlar gösterilir. Merkez can yemi ödülü onu alan oyuncuya verilir.
- **Yakın görünüm** düğmesi haritayı iki kat büyütür ve karakterini takip eder; **Haritanın tamamı** bütün alanı gösterir. Dar ekranlarda yakın görünüm varsayılandır.
- İki LAN modu da **41×35 hücrelik büyük haritada** oynanır; tek oyunculu 21×23 harita korunur. Her LAN bölümünde **6 farklı hayalet** bulunur. İlk kadro Blaze, Pinky, Glitch, Cinder, Rush ve Moss’tur; ilerleyen bölümlerde Dozer ve Shade uzman kadrosuna girer. Dört oyuncu sahanın dört tarafında, hayaletler merkez odasında doğar.
- İş birliğinde bölüm sonundaki takım toplamının **%50’si her oyuncunun normal dükkân bakiyesine** aktarılır; oyuncu sayısına bölünmez. Puan yarışında maç sonundaki kişisel skorun %50’si ödenir. Yeni bölüm ve maç sonu yalnızca ödenmemiş farkı ekler; yenileme/geri bağlanma aynı ödülü tekrar vermez. Bakiye aynı tarayıcı ve site adresindeki normal dükkândadır. Depolama hatası olursa ödül yazılmaz; ekrandaki **Tekrar dene** ile yeniden alınabilir.
- Canları biten oyuncu haritayı karartmadan takımını izler. **İzlenen oyuncu** listesinden yaşayan, bağlı bir arkadaş seçilebilir; yakın kamera seçilen kişiyi takip eder.
- Güç yemi bütün oyuncular için 10 saniyelik korku modu başlatır. Her oyuncunun yetenekleri ve beklemeleri ayrıdır. Zıplama, mıknatıs, boost ve hasar görmezlik desteklenir. LAN'da hayalet yeme geri bildirimi diğer oyuncuların oyununu durdurmaz.
- Bağlantı kesilince karakter hareket etmez ve yeni hedef olmaz. Aynı sekmeyi yenileyince 30 saniye içinde aynı oyuncu/puan/canla geri bağlanılır. Oda sahibi ayrılırsa liderlik bağlı oyuncuya geçer. Bütün bağlantılar kesilince simülasyon bekler; odalar boş kalınca kapanır.
- Oda ve maçlar sunucunun RAM'inde tutulur; sunucu kapanırsa maçlar sona erer. Tek oyunculu görev ve kayıtlar değişmez. Tek oyunculu oyunun menü duraklatması LAN maçını durdurmaz.

Sadece tek oyunculu oynarken `npm run dev` kullanılır; bu komut loopback üzerinde açılır ve LAN ekranı `npm run lan` gerektiğini gösterir. LAN sunucusu aynı anda tek oyunculu oyunu da servis eder. Statik GitHub Pages bir LAN sunucusu çalıştıramaz; barındıran bilgisayarda bu Node komutu gerekir.

Bağlanamıyorsanız aynı ağda olduğunuzu, doğru IPv4 adresi/portu ve işletim sistemi güvenlik duvarının Node.js'e yerel ağ erişimi verdiğini kontrol edin. Misafir Wi-Fi'nin cihaz yalıtımı bilgisayarların birbirini görmesini engelleyebilir. İnternet port yönlendirmesi gerekmez.

## Arcade ayarları

Üst çubuktaki **Ayarlar** düğmesi ses açma/kapama, ses seviyesi, ses denemesi, ekran sarsıntısı, parçacıklar, bölüm girişleri ve azaltılmış hareket seçeneklerini açar. Tercihler `maze-chaser-settings-v1` anahtarıyla bu tarayıcıda saklanır; oyun kayıtlarından bağımsızdır. Sesler varsayılan olarak kapalıdır. Ses bağlamı kullanıcı etkileşimiyle açılır.

Bölüm başında kısa bir giriş gösterilir. **Atla / Enter** ile atlanabilir; giriş boyunca dünya, hayaletler ve güç süreleri ilerlemez. Ayarlar veya dükkân açıkken süreler durur. Sistem azaltılmış hareket istiyorsa bu tercih otomatik uygulanır.

Aynı güç döneminde yakalanan hayaletler kombo göstergesinde sayılır. Her hayalet hâlâ **+200** puandır; gösterilen toplam puan çarpan değildir. Yeni güç yemi, güç süresinin bitişi, can kaybı veya yeni bölüm seriyi sıfırlar. Kombo bilgisi yeni kayıtlarda korunur; eski kayıtlar açılmaya devam eder.

## Challenge modu

Ana menüden **Challenge → Challenge üret** yolunu seç. Kolay, normal veya zor seçimi yeni bir rastgele tohum, labirent, hayalet kadrosu ve tek kural üretir. Önizlemede harita, kural, canlar ve ödül görünür. **Yeni challenge üret** ile değiştirebilirsin.

- **Yeteneksiz koşu:** Q/E kapalı; güç yemleri kullanılabilir.
- **Güç yemleri en sona:** bütün küçük yemlerden önce güç yemi alınırsa deneme biter. Güç yemleri, küçük yemlere giden yolları kapatmayan konumlara dağıtılır.
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
index.html                  Tek oyunculu HTML arayüzü ve ana giriş
lan.html                    LAN oda/lobi ve maç ekranı
server/                     Yetkili simülasyon ve HTTP/SSE oda servisi
index-ghosts.html            Eski adres için yönlendirme
src/
  main.js                   Oyun örneğini oluşturup başlatır
  lan/                      LAN istemcisi, arayüz, interpolasyon ve iki dil
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

143 davranış kontrolü, ilk 1.000 haritanın erişilebilirliği ve farklılığı, dil, AI, yetenekler, kayıt yükleme, cüzdan ve giyim kurallarını sınar. Ek proje kontrolleri modül/görsel/stil yollarını ve sunucu MIME türlerini doğrular. 24 ek arcade kontrolü geçişlerin dünyayı dondurmasını, menü duraklatmasını, tercihlerin kalıcılığını, eski kayıt/kombo uyumluluğunu, azaltılmış hareketi ve Web Audio zamanlamasını sınar. 18 LAN kontrolü iki modu, dört oyuncu sınırını, yetenekleri, sunucu puanlamasını, gerçek HTTP/SSE bağlantılarını, liderlik devrini ve yeniden bağlanmayı sınar. Testler gerçek ES modüllerini yükler; üretim koduna test kancası eklemez.

## Kayıtlar ve puanlar

Kayıtlar, dil tercihi, rekor, cüzdan ve koleksiyon `localStorage` içinde tutulur. Modüler yapıya geçişte mevcut anahtarlar ve kayıt biçimi korunmuştur. Aynı tarayıcı ve aynı site adresindeki kayıtlar kullanılmaya devam eder; farklı port veya başka tarayıcı ayrı depolama alanıdır.

- `K` / **Kaydet**: mevcut oyunu kaydet.
- **Kaydet ve menü**: kaydet ve başlangıç ekranına dön.
- Her 5 bölümün sonunda otomatik checkpoint alınır; 1000. bölümde tamamlanma kaydı oluşturulur.
- Alışveriş bölüm skorunu, rekoru veya toplam kazanılan puanı azaltmaz.
- Cyber Armor, Pumpkin, Space Suit ve Viking Armor tam settir. Diğer kostüm ve başlıklar birlikte veya ayrı takılabilir.

## Yayınlama

Bu klasörün `index.html`, `src/`, `styles/` ve `assets/` içeriğini statik bir HTTP sunucusuna yüklemek yeterlidir. `scripts/`, `tests/`, `archive/` ve belgeler oyun için zorunlu değildir. Görsel URL’leri modül konumundan çözüldüğü için proje bir alt dizinde de çalışır.

## Güç yemi dağılımı

Bölüm, Challenge ve iki LAN modunda **5 güç yemi** rastgele, birbirinden uzak yol hücrelerine yerleştirilir. Normal ve LAN oyununda her yeni bölüm/maç yeni konumlar üretir; Challenge aynı kodla tekrarlandığında aynı yerleşimi korur. Güç yemsiz Challenge kuralı bu beş yemi küçük yeme çevirir. Oyuncu doğma hücreleri ve merkez can yemi alanına güç yemi konmaz.

Kaydedilen harita konumları aynen geri yüklenir. Eski dört köşe güç yemli kayıtlar da açılır. `tests/lan-update-check.mjs` rastgele yerleşim, kural erişilebilirliği, ödül makbuzları, depolama hatası/yeniden deneme ve izleme ekranını sınar.
