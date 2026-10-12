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
3. Oda kodunu veya katılım bağlantısını paylaşın. Diğer oyuncular adlarını girip katılsın. Lobide **mod ve harita için oy verin**; üç seçenek Neon Sokaklar, Kavşaklar ve Çevre Yolu. Bağlı oyuncuların oyları sayılır; eşitlikte bağlı oda sahibinin oyu, sonra seçenek sırası belirler. Oda sahibinin maçı başlatması bu sonucu uygular. Seçilen harita lobide açıkça önizlenir.
4. En az iki, en fazla dört oyuncu **Hazırım** dediğinde oda sahibi **Oyunu başlat** düğmesine basar. Oy veya görünüm değiştirmek hazır durumunu kaldırır; hazırken seçimleri değiştirmek için önce hazır durumundan çıkın.

- **İş birliği:** kişisel üç can ve skor, ortak takım toplamı. Yemleri temizleyip merkez can yemini alın; hayaletler son yemle kalkar. Can yemi yaşayan oyuncuların her birine +1 can veya üç canı varsa +500 puan verir. Oda sahibi sonraki haritayı açar; elenen takım arkadaşları bir canla geri döner. Takımın bütün canları biterse maç sona erer.
- **Puan yarışı:** aynı labirentte üç dakika. Küçük yem +10, güç yemi +50, hayalet +200; puan ilk toplayana yazılır. Süre bitince, bir oyuncu kalınca veya merkez can yemi toplanınca en yüksek toplam puan kazanır; eşitlikte ortak kazananlar gösterilir. Merkez can yemi ödülü onu alan oyuncuya verilir.
- Oyuncu kartları dükkânda seçilmiş kostüm ve başlığı gösterir; aynı görünüm normal oyun halinde haritada da kullanılır. Güç/yetenek etkileri kendi modellerini gösterir. **Dükkânda görünüm seç** ayrı sekmede normal dükkânı açar; ardından **Dükkândaki görünümümü kullan** seçimi odaya aktarır. Özel tam kostümler başlıkla birleştirilmez.
- Bölüm/maç sonunda **Maç istatistikleri** kişisel skor, küçük yem, güç yemi, yenilen hayalet, can kaybı ve başarılı yetenek kullanımını gösterir. Bunlar maç boyunca birikir ve yeni maç başlatılınca sıfırlanır. Görünüm mobilde yatay kaydırılabilir.
- Kadro 6 hayalet olarak kalır. İki/üç/dört oyuncu için hayalet hızı sırasıyla **%90 / %100 / %110**, başlangıç çıkış aralığı **1,25 / 1 / 0,75 saniye**, özel yetenek bekleme çarpanı **1,15 / 1 / 0,85** olur. Kadro bölüm başında kilitlenir; can kaybı zorluğu düşürmez. Hayaletlerin yakınlık seçimi mevcut hedef baskısını da hesaba katar.
- Yarış haritaları yatay ve dikey simetriktir: başlangıç çevresindeki yem fırsatları ve merkeze yol uzaklığı eşittir. Dört güç yemi simetrik dörtlü, beşinci güç yemi ortak merkez alanında rastgele olarak, her maç farklı konumlarda yerleşir; hayalet çıkışları karşılıklı çiftler halindedir. İş birliği haritaları serbest prosedürel üretimi kullanır.
- **Ping** ve bağlantı kalitesi maç alanının üstünde gösterilir. 120 ms üzeri orta, 250 ms üzeri veya 1,2 saniyeden eski veri yüksek gecikme olarak işaretlenir. Bağlantı kaybında harita son alınan konumları gösterir; yeniden bağlanma şeridinde 30 saniyelik oturum süresi ve **Şimdi yeniden dene** düğmesi görünür. Altı saniye snapshot gelmeyen sessiz bağlantı da yeniden açılır. Dönüşte oyuncu kimliği, skor ve canlar korunur.
- **Yakın görünüm** düğmesi haritayı iki kat büyütür ve karakterini takip eder; **Haritanın tamamı** bütün alanı gösterir. Dar ekranlarda yakın görünüm varsayılandır.
- İki LAN modu da **41×35 hücrelik büyük haritada** oynanır; tek oyunculu 21×23 harita korunur. Her LAN bölümünde **6 farklı hayalet** bulunur. İlk kadro Blaze, Pinky, Glitch, Cinder, Rush ve Moss’tur; ilerleyen bölümlerde Dozer ve Shade uzman kadrosuna girer. Dört oyuncu sahanın dört tarafında, hayaletler merkez odasında doğar.
- İş birliğinde bölüm sonundaki takım toplamının **%50’si her oyuncunun normal dükkân bakiyesine** aktarılır; oyuncu sayısına bölünmez. Puan yarışında maç sonundaki kişisel skorun %50’si ödenir. Yeni bölüm ve maç sonu yalnızca ödenmemiş farkı ekler; yenileme/geri bağlanma aynı ödülü tekrar vermez. Hesapla oynarken ödül sunucudaki cüzdana kaydedilir ve başka cihazda aynı hesapla açılır; misafir bakiyesi aynı tarayıcı ve site adresindeki normal dükkândadır. Depolama hatası olursa ödül yazılmaz; ekrandaki **Tekrar dene** ile yeniden alınabilir.
- Canları biten oyuncu haritayı karartmadan takımını izler. **İzlenen oyuncu** listesinden yaşayan, bağlı bir arkadaş seçilebilir; yakın kamera seçilen kişiyi takip eder.
- Güç yemi bütün oyuncular için 10 saniyelik korku modu başlatır. Her oyuncunun yetenekleri ve beklemeleri ayrıdır. Zıplama, mıknatıs, boost ve hasar görmezlik desteklenir. LAN'da hayalet yeme geri bildirimi diğer oyuncuların oyununu durdurmaz.
- Bağlantı kesilince karakter hareket etmez ve yeni hedef olmaz. Aynı sekmeyi yenileyince 30 saniye içinde aynı oyuncu/puan/canla geri bağlanılır. Oda sahibi ayrılırsa liderlik bağlı oyuncuya geçer. Bütün bağlantılar kesilince simülasyon bekler; odalar boş kalınca kapanır.
- Oda ve maçlar sunucunun RAM'inde tutulur; sunucu kapanırsa maçlar sona erer. Hesap profilleri disk üzerinde kalır; misafir görev ve kayıtları tarayıcıda korunur. Tek oyunculu oyunun menü duraklatması LAN maçını durdurmaz.

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

Yeni oyun kayıtları koşu başına görev sayaçlarını da taşır; aynı eski noktayı tekrar oynarken sayılmış olaylar iki kez ilerleme yazmaz. Sayaçsız eski kayıtlar açılmaya devam eder; bu kayıtlarda önceki kredilendirilmiş skor aşıldıktan sonraki olaylar sayılır. Misafir ilerleme/ödülleri tarayıcı ve origin’e bağlıdır; hesapla oynarken sunucuya eşitlenir.

## Proje yapısı

```text
index.html                  Tek oyunculu HTML arayüzü ve ana giriş
lan.html                    LAN oda/lobi ve maç ekranı
server/                     Yetkili simülasyon ve HTTP/SSE oda servisi
index-ghosts.html            Eski adres için yönlendirme
src/
  main.js                   Oyun örneğini oluşturup başlatır
  account/                  Hesap ekranı ve bulut profil depolama adaptörü
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

Misafir kayıtları, rekor, cüzdan ve koleksiyon mevcut `localStorage` anahtarlarında korunur. Hesapla giriş yapınca bakiye, toplam gelir, envanter/giyim, görevler, rekorlar ve iki kayıt yuvası sunucu profilinden yüklenir. Dil, ses ve görüntü tercihleri cihazda kalır. Misafir verisi hesaba otomatik eklenmez; **Hesabım → Bu cihazdaki kayıtlarımı aktar** boş hesaba bir kez aktarır ve misafir kopyasını silmez.

- `K` / **Kaydet**: mevcut oyunu kaydet.
- **Kaydet ve menü**: kaydet ve başlangıç ekranına dön.
- Her 5 bölümün sonunda otomatik checkpoint alınır; 1000. bölümde tamamlanma kaydı oluşturulur.
- Alışveriş bölüm skorunu, rekoru veya toplam kazanılan puanı azaltmaz.
- Cyber Armor, Pumpkin, Space Suit ve Viking Armor tam settir. Diğer kostüm ve başlıklar birlikte veya ayrı takılabilir.

## Yayınlama

Yalnızca misafir tek oyunculu oyun için `index.html`, `src/`, `styles/` ve `assets/` içeriğini statik bir HTTP sunucusuna yüklemek yeterlidir. Hesaplar ve multiplayer için aşağıdaki Node sunucusu gerekir. `scripts/`, `tests/`, `archive/` ve belgeler oyun için zorunlu değildir. Görsel URL’leri modül konumundan çözüldüğü için proje bir alt dizinde de çalışır.

## Güç yemi dağılımı

Bölüm, Challenge ve iki LAN modunda **5 güç yemi** rastgele, birbirinden uzak yol hücrelerine yerleştirilir. Normal ve LAN oyununda her yeni bölüm/maç yeni konumlar üretir; Challenge aynı kodla tekrarlandığında aynı yerleşimi korur. Güç yemsiz Challenge kuralı bu beş yemi küçük yeme çevirir. Oyuncu doğma hücreleri ve merkez can yemi alanına güç yemi konmaz.

Kaydedilen harita konumları aynen geri yüklenir. Eski dört köşe güç yemli kayıtlar da açılır. `tests/lan-update-check.mjs` rastgele yerleşim, kural erişilebilirliği, ödül makbuzları, depolama hatası/yeniden deneme ve izleme ekranını sınar.

## Online geçiş hazırlığı

LAN skorları, maç istatistikleri ve %50 ödül makbuzları yetkili sunucuda hesaplanır; istemci sunucuya skor, bakiye veya konum göndermez. Kendi oyuncusunun çizimi ortak grid hareketiyle en fazla 250 ms tahmin edilir ve sunucu durumuyla uzlaştırılır. Diğer oyuncular ve hayaletler 90 ms interpolasyon tamponunu kullanır. Yön komutları bağımsız sıra numarasıyla önceki HTTP yanıtını beklemeden gönderilir; ters sırada ulaşan eski yönler yok sayılır. Hareket ve yetenekler bakiye senkronizasyonunu beklemez. Lobi komutları sıralı kalır, yeniden denemeler aynı numarayı kullanır ve eski yetenek girişleri atılır. Snapshot sürümleri gecikmiş veya tekrarlanan durumları ayıklar. Gerçek HTTP testleri gecikme/jitter, atlanan snapshot, kaybolan komut yanıtı ve aynı oturuma geri bağlantıyı doğrular; bu testler gerçek internet paket kaybının bir ölçümü değildir. `tests/lan-latency-check.mjs` geciken yanıtlar, ters sıralı yönler, ilk karede tepki, duvar/köşe hizası ve tahmin sınırını kontrol eder.

Hesapla katılan oyuncunun kimliği ve kozmetikleri sunucu profilinden doğrulanır. LAN ödülleri sunucuda hesaplanır ve disk üzerindeki cüzdana yalnızca bir kez işlenir. Solo oyun ve görev olayları istemciden bildirilir; tek oyunculu hile denetimi bu sürümün kapsamına dahil değildir. Misafir ilerlemesinin ilk aktarımı da yerel veriye güvenir. Oda oturumları RAM'dedir; sunucu yeniden başladığında maçlar sona erer, kaydedilmiş hesap bakiyesi ve profiller kalır.

## Hesap ve özel odalar

**Hesabım** düğmesi hem ana oyunda hem LAN sayfasında vardır. Kayıt ve giriş yalnızca kullanıcı adı ve şifre ister; e-posta ve şifre tekrarı yoktur. Kullanıcı adı 1–24 karakter, büyük/küçük harf duyarsızdır. Şifre boş olamaz; uzunluk, rakam, sembol veya karakter türü şartı yoktur. Şifreler salt içeren scrypt özetiyle saklanır (`N=131072, r=8, p=1`; [OWASP kaynağı](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). Hesap oturumu 30 günlük HttpOnly/SameSite cookie kullanır; HTTPS üzerinde Secure eklenir.

Profil yazımı yarım saniyelik aralıkla birleştirilir. Hesap düğmesindeki ⟳ kaydın sürdüğünü, ! hata olduğunu gösterir. Kaydedilemeyen değişiklikler yalnızca o hesabın cihaz önbelleğinde korunur ve bağlantı gelince tekrar gönderilir. Cihaz değiştirmeden **Hesabım** ekranında “Profil sunucuda kayıtlı” durumunu kontrol et. **Profili yenile** sunucudaki son durumu getirir. Bir hesap başka cihazlarda kullanılabilir; aynı odada aynı hesapla ikinci oyuncu/izleyici oluşturulamaz.

- Oda oluştururken isteğe bağlı **oda şifresi** koyabilir ve **Odayı listeden gizle** seçebilirsin. Gizli oda kod/link ile açılır; şifre bağlantıya yazılmaz, ayrı paylaşılır. Şifreli odalarda oyuncu ve izleyici aynı doğrulamadan geçer.
- Oda listesi **mod** ve **durum** filtrelerine sahiptir. Başlamış ve dolu odalar izleme için listede kalır.
- **Katılım şekli → İzleyici** ile devam eden maça da girilebilir. Oda başına en fazla 4 oyuncu ve 8 izleyici vardır. İzleyici kadroya, dengeye ve hazır kontrolüne dahil edilmez; komut/oy gönderemez, maç ödülü alamaz. Kamera yaşayan oyuncular arasında değiştirilebilir.
- Oda sahibi oyuncu/izleyici satırındaki **Çıkar** düğmesiyle üyeyi kaldırabilir. Çıkarılan hesap aynı odaya geri dönemez. Misafir kontrolü cihaz cookie’sine dayanır. Oda sahibinin değişmesi yetkiyi yeni sahibine geçirir.

## Node / Dokploy yayını

`Dockerfile` bağımlılıksız Node 22 sunucusunu `3000` portunda başlatır. Dokploy'da Dockerfile build seç, domain/proxy'yi container'ın **3000** portuna yönlendir ve **HTTPS** aç. SSE için proxy buffering kapalı ve uzun süreli HTTP bağlantıları açık olmalı (`X-Accel-Buffering: no` sunucuda gönderilir).

`.env.example` ayarları:

| Değişken                               | Anlamı                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `PORT=3000`                            | Container portu; yerelde varsayılan 8765                                             |
| `ACCOUNT_DATA_DIR=/app/.data`          | Hesap/profil dizini; **kalıcı volume'u buraya bağla**                                |
| `REQUIRE_LOGIN=true`                   | Multiplayer oyuncu/izleyici katılımında hesap zorunluluğu; yerelde varsayılan kapalı |
| `TRUST_PROXY=true`                     | Yalnızca güvenilir proxy arkasında forwarded HTTPS/IP bilgisine güven                |
| `PUBLIC_ORIGIN=https://senin-domainin` | Gerçek oyun domain'i; yerel geliştirmede tanımlama                                   |

`.env.example` örnektir; sunucu `.env` dosyasını otomatik okumaz. Değişkenleri Dokploy ortam ayarlarında veya shell üzerinden tanımla. `/health` hesap dizini hazırsa 200, okunamıyorsa 503 döner. Hesap dosyaları statik HTTP erişimine ve Git'e kapalıdır; `.data/` yedeklenmelidir. Volume olmadan container yenilenince hesap verisi kaybolabilir. Mevcut dosya deposu **tek Node süreci / tek replica** içindir; yatay ölçeklemeden önce ortak veritabanı ve oda altyapısı gerekir.

`tests/accounts-check.mjs` tek karakterli/uzun Unicode şifreyi, yanlış giriş/çapraz origin reddini, profil izolasyonunu, diskten tekrar yüklemeyi, çakışan yazıları, tek seferlik aktarım/ödülleri, özel odaları, canlı izleyiciyi, çıkarma yetkisini ve offline yeniden denemeyi gerçek HTTP/SSE ile doğrular. Docker yayını bu değişiklikle hazırlanır; otomatik olarak deploy edilmez.
