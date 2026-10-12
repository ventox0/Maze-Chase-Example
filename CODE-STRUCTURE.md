# Kod düzeni

Oyun standart ES modüllerine ayrılmıştır. `index.html` arayüzü, `styles/` görünümü, `assets/` görselleri taşır. `src/main.js` hesap profilini yükler, hesap ekranını ve `Game` örneğini oluşturur. JavaScript veya görseller HTML içinde gömülü değildir. Derleme ve çalışma zamanı kütüphanesi gerekmez.

| Dosya / sınıf                                            | Sorumluluk                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/core/Game.js`                                       | Oyun durumu, skor/can/bölüm, sistemlerin oluşturulması ve sabit zamanlı döngü |
| `src/core/GameComponent.js`, `GridActor.js`, `dom.js`    | Ortak bileşen bağlama, aktör verisi ve DOM bağlantıları                       |
| `src/gameplay/MazeMap.js`                                | Bölüm haritası, yemler, can ödülü ve duvar önbelleği                          |
| `src/gameplay/MovementSystem.js`                         | Hücre hizalama, ortak hareket ve BFS yol bulma                                |
| `src/gameplay/PlayerController.js`                       | Oyuncu hareketi, yön tamponu ve model seçimi                                  |
| `src/gameplay/GhostManager.js`                           | Kadro, AI, korku ve özel yetenekler                                           |
| `src/gameplay/AbilitySystem.js`                          | Q/E seçimi, zıplama, mıknatıs, boost ve zırh                                  |
| `src/rendering/AssetLoader.js`                           | Harici sprite/atlas yükleme ve alpha kırpma                                   |
| `src/rendering/CanvasRenderer.js`                        | Labirent, aktörler ve güç efektlerinin çizimi                                 |
| `src/rendering/ParticleSystem.js`, `CutsceneManager.js`  | Parçacıklar, puan yazıları ve aksiyon sahneleri                               |
| `src/ui/GameUI.js`                                       | HUD, durum ekranları ve erişilebilir bildirimler                              |
| `src/ui/LevelSelection.js`                               | Bölüm kartları, önizlemeler ve kayıt yükleme                                  |
| `src/ui/PointShop.js`                                    | Satın alma, giyim kuralları ve birleşik model önizlemesi                      |
| `src/storage/SaveManager.js`                             | Kayıt doğrulama, checkpoint ve durum yükleme                                  |
| `src/storage/PointWallet.js`                             | Bakiye, toplam gelir, sahiplik ve tekrar puanlama koruması                    |
| `src/i18n/Localization.js`, `tr.js`, `en.js`, `flags.js` | Dil yönetimi, metinler ve bayraklar                                           |
| `src/input/InputController.js`                           | Klavye, dokunma, düğmeler, odak ve görünürlük                                 |
| `src/audio/AudioManager.js`                              | Web Audio efektleri ve ses kontrolü                                           |
| `src/data/`                                              | Ayarlar, haritalar, yetenek/hayalet tanımları, ürünler ve görsel URL’leri     |

## Gardırop hizalaması

`src/data/avatar-fitting.js` kafa ve başlık açıklığı bağlantılarını; `src/rendering/AvatarLayout.js` iki katmanı aynı merkez/yarıçap üzerinden eşleyen yerleşimi tutar. Tek tek başlık küçültülmez, bütün birleşim tuval sınırlarına oranı korunarak sığdırılır. `PointShop.avatar()` bu ortak yerleşimi kartlar, önizleme ve oyuncu modeli için kullanır. `tests/avatar-fitting-check.mjs` bütün 340 geçerli birleşimin bağlantısını ve tuval sınırlarını kontrol eder.

## Arcade sunumu

- `src/rendering/ArcadePresentation.js`: kombo, bölüm girişi, darbe geri bildirimi ve kamera sarsıntısı. `transition` durumunda sadece sunum zamanı ilerler; dünya zamanı durur. Enter veya Atla düğmesi geçişi tamamlar.
- `src/ui/SettingsMenu.js`: tercih doğrulama, kalıcı depolama ve menü. Açılan menü aktif durumun türünü korur; kapanınca oyun, ara sahne veya bölüm girişine döner. Depolama hatası tercihlerin uygulanmasını engellemez.
- `src/data/audio.js`: Web Audio nota dizileri. `AudioManager` ana ses düğümüyle seviyeyi uygular, mute/duraklatma sırasında bekleyen sesleri keser, biten düğümleri temizler ve eşzamanlı ses sayısını sınırlar.
- `styles/arcade.css`: ayarlar, kombo ve bölüm geçişi görünümü. Azaltılmış hareket işletim sistemi ve oyun tercihinden okunur; sarsıntı/parçacıklar kapanır, girişler kısalır.

Kayıt şeması sürümü değişmez. İsteğe bağlı `data.combo` alanı 0–4 arasında doğrulanır; alanı olmayan eski kayıtlar sıfır kombo ile yüklenir. Geçiş sırasında kayıt kapalıdır; ses ve görsel tercihler oyun kaydına dahil edilmez.

## Akıcı karakter animasyonları

`PlayerAnimation` yürüyüş fazını alınan mesafeden üretir: normal hızda yaklaşık 0,6 saniyelik döngü, boost sırasında daha hızlı ritim. Başlama, durma ve dönüş eğimi üstel olarak yumuşar. Poz yalnızca çizimi değiştirir; hız, ızgara hizası ve çarpışma merkezi korunur. Dünya durduğunda animasyon da durur; yeni bölüm ve kayıt yükleme sunum verisini sıfırlar.

`animation.js` ortak eğrileri ve süreleri tutar. `CutsceneManager` 2,4 saniyelik geliş, hazırlık, vuruş, savrulma ve toparlanma fazlarını kesintisiz pozlarla çizer. Oyuncu pozları birbirine karışır; ses ve darbe efekti aynı fazda başlar. Azaltılmış hareket 0,65 saniyelik kısa sahneyi korur. Eski 1,3 saniyelik ara sahne kayıtları da geçerlidir.

## Başlangıç ve güncelleme

`index.html` bir `type="module"` betiğiyle `src/main.js` yükler. ES modülleri HTTP üzerinden servis edilmelidir; `npm run dev` bağımlılıksız sunucuyu başlatır. Modüller gereken sabitleri ve sınıfları açık `import` ifadeleriyle alır; üretim ortamına açık test nesnesi kullanılmaz.

```js
import { Game } from "./core/Game.js";
const game = new Game();
game.start();
```

`Game` sistemleri oluşturur; bileşenler kendi değiştirilebilir verilerini tutar ve diğer sistemlere `game` üzerinden ulaşır. `Game.update(dt)` oyuncu, yetenekler, hayaletler, çarpışmalar ve efektleri ilerletir. `Game.frame(timestamp)` sabit zaman adımlarını uygular ve Canvas/HUD çizimini çağırır.

Güç ve beklemeler `game.gameTime`, ara sahne kendi `elapsed` değerini kullanır. Duraklatma ve dükkân oyun sürelerini tüketmez.

## Bölüm seçimi ve kayıtlar

Bölümler `src/data/config.js` içindeki `MAX_LEVEL = 1000` ile sınırlıdır. İlk bölüm klasik haritadır; sonraki haritalar bölüm numarasına göre deterministik üretilir. Bölüm seçimi 12 kartlık sayfalar halinde sunulur. Her 5 bölüm sonunda bir sonraki bölüm için otomatik kayıt oluşturulur; son bölümde tamamlanma kaydı alınır. Manuel kayıt `K` veya menü düğmesiyle alınabilir.

`SaveManager` kayıtları doğrular; oyun zamanı, oyuncu ve hayaletler, harita, yemler, yetenekler ve skor/can bilgilerini geri yükler. Mevcut localStorage anahtarları ve kayıt biçimi korunur. Misafir kayıtlarında aynı origin kullanılmalıdır; hesap kayıtları `ProfileStorage` üzerinden sunucuya eşitlenir.

## Puan dükkânı

`PointWallet` toplam kazanılan puanı ve harcanabilir bakiyeyi ayrı tutar. Satın alma oyun skorunu ve rekoru değiştirmez. Oyuncu kostüm ve başlıkları beraber veya ayrı takabilir. Cyber Armor, Pumpkin, Space Suit ve Viking Armor tam settir ve başlıkla birleştirilmez.

`src/data/shop.js` ürün tanımlarını ve atlas bölgelerini içerir. `src/data/assets.js` harici atlas URL’lerini tanımlar. `AssetLoader` atlasları kırpar; `PointShop` katmanları birleştirir ve önizlemeyi oluşturur. Güç/yetenek modeli etkin olduğunda geçici olarak kozmetik modelinin yerini alır.

Cüzdan `maze-chaser-wallet-v1` anahtarını kullanır. Her oyun koşusunun kimliği ve en yüksek kredilendirilen skoru, eski kaydı tekrar yüklerken aynı puanın ikinci kez eklenmesini önler. Manuel ve otomatik kayıt kimlikleri korunur.

## Değişiklik yaparken

- Denge ve tuşlar: `src/data/config.js`, `abilities.js`, `ghosts.js`.
- Yeni harita: `src/data/maps.js` ve `src/gameplay/MazeMap.js`.
- Hayalet davranışı: `src/gameplay/GhostManager.js`.
- Yetenek: `src/gameplay/AbilitySystem.js` ve `src/data/abilities.js`.
- Ürün/fiyat: `src/data/shop.js`; giyim kuralı: `src/ui/PointShop.js`.
- Görsel: `assets/` ve `src/data/assets.js`.
- Menü/dil: `index.html`, ilgili `src/ui/` sınıfı ve `src/i18n/tr.js` / `en.js`.
- Stiller: `styles/base.css`, `game.css`, `menus.css`, `ghosts.css`, `cutscenes.css`, `levels.css`, `shop.css`. `main.css` sıralamayı korur.

## Test düzeni

`npm test` aşağıdaki tek oyunculu kontrolleri ve LAN/hesap kontrollerini çalıştırır:

1. `tests/ghosts-check.cjs`, `tests/helpers/game-harness.mjs` üzerinden gerçek ESM sınıflarını yükleyerek 143 davranış kontrolünü çalıştırır. DOM/Canvas taklitleri yalnızca testlerde bulunur.
2. `tests/arcade-check.mjs` 20 sunum, ayar, Web Audio ve kombo/kayıt kontrolünü çalıştırır.
3. `tests/avatar-fitting-check.mjs` 20 başlığı, tüm birleştirilebilir kostümleri ve 340 yerleşimin bağlantı/tuval sınırlarını doğrular.
4. `tests/challenge-check.mjs` 450 üretilen haritanın erişilebilirliğini ve 10 kuralı, süreleri, yeniden denemeyi, ödül ve kayıt/rekor ayrımını sınar.
5. `tests/missions-check.mjs` katalogdaki 100 görevi/ödülü, gerçek oyun olaylarını, kayıt tekrarlarını, eski kayıt uyumluluğunu, ödeme hatalarını, filtreleri ve duraklatmayı sınar.
6. `tests/project-check.mjs` import yollarını, 12 görsel dosyasını, CSS bağlantılarını, HTML kimliklerini, sunucu MIME türlerini, eski adresleri ve HTTP hata davranışlarını sınar.

`index-ghosts.html` yalnızca `index.html` yönlendirmesidir. Yerel sunucu eski `/Maze Chase Example/` URL önekini de tanır. Tarayıcı origin'i ve kayıt anahtarları korunur. `archive/index-before-modular.html` önceki girişin arşividir; modüler oyun tarafından yüklenmez.

## Challenge oluşturma ve kurallar

`src/data/challenges.js` tohumdan deterministik kural/zorluk/kadro seviyesi üretir. `MazeMap.createLevelMap(level, {seed, styleLevel})` mevcut labirent üreticisini rastgele tohumla kullanır; yalnızca bölüm numarası verilmesi labirent geometrisini korur; güç yemi konumları seçilen tohuma göre üretilir. `applyChallengeRule` güç yemsiz dönüşümü uygular. Ortak güç yemi dağıtımı küçük yemlere giden yolları kapatmaz; menü önizlemesi ve oyun aynı tohumla aynı yerleşimi kullanır.

`ChallengeMode` tek denemelik koşuyu, kural ihlalini, süre sınırını, bonusu ve ayrı rekoru yönetir. `ChallengeSelection` önizleme, zorluk, yeniden üretme ve aynı denemeyi tekrarlama akışını yönetir. `Game.mode` etkin oyunu, `menuMode` henüz başlamamış menü tercihini ifade eder. Challenge'da kayıt kapalıdır; ortak cüzdan puan kazanmaya devam eder. Kampanyaya dönüş ve kayıt yükleme, bölüm rekorunu geri getirir. Yeni arayüz `styles/challenge.css` içindedir.

`ChallengeMode.skillsUsed` ve `ghostsCaught` deneme boyunca korunur, yeni denemede sıfırlanır. Başarılı aktivasyon `AbilitySystem` içinde hak tüketir; yön tamponu hak tüketmez. `beforeGhostCaught` yakalama puanı/sahnesinden önce barışçıl koşuyu doğrular ve av sayısını artırır. `beforeBonus` son yemden sonra av hedefine ulaşılmadıysa can yemi aşamasını açmaz. Güç süresi ve normal hayalet hız çarpanı üretilen Challenge tanımından okunur; bölüm modundaki değerler değişmez.

## 100 görev ve ödül akışı

`src/data/missions.js` 10 türde yükselen hedefleri ve 10 özel Challenge kuralı hedefini üretir; `MISSIONS` tam 100 benzersiz, sabit kimlik içerir. Hedefler ilk sayfadan itibaren farklı türleri gösteren 10'lu gruplar halinde sıralanır. `MissionProgress` kalıcı toplamları ve koşu başına sayaç eşiklerini tutar. `MazeMap`, `AbilitySystem`, `Game` ve `ChallengeMode` yalnızca gerçekleşmiş olayları bildirir: iptal edilen zıplama, başarısız Challenge veya barışçıl koşuda yasak hayalet teması sayılmaz.

`SaveManager` isteğe bağlı `missionCursor` alanını doğrular ve geri yükler; eski kayıtlar bu alan olmadan geçerlidir. Koşu geçmişi en fazla 128 kayıt tutar; etkin ve iki kayıt yuvasındaki koşular budanmaz. Ödül kimliği ve cüzdan ödemesi `PointWallet.claimMission` ile aynı localStorage yazısında saklanır. Görev ödülü `Game.addScore` kullanmaz ve kazanılmış oyun puanı hedefinden çıkarılır. Cüzdanın sürümü ve eski verinin geçerliliği korunur.

`MissionMenu` ayrı dialog, filtreler, sayfalar, toplu ödül ve üst çubuk rozeti sunar. Diğer menülerle birlikte açılamaz; oyun, giriş ve ara sahne durumunu kapatınca geri yükler. Görünüm `styles/missions.css` içinde, bütün metinler Türkçe/İngilizce çevirilerde bulunur.

## Alpha LAN

`server/LanWorld.js` yetkili çok oyunculu simülasyondur. İstemciler konum, can veya skor yazamaz; yalnızca yön ve yetenek niyeti gönderir. `MovementSystem`, `GhostManager`, harita/yetenek sabitleri ve saf `map-generation.js` hem LAN hem tek oyunculu tarafından kullanılır. Her hayalet en yakın bağlı, yaşayan oyuncuyu hedefler. Ortak grid yemlerin ve hayalet ödüllerinin iki kez verilmesini engeller. Takım ve kişisel puanlar ayrı tutulur.

`server/LanService.js` oda kodları, dört kişilik limit, oda sahipliği, hazır kontrolü, oturum token'ları ve 30 saniyelik yeniden bağlanma rezervini yönetir. `scripts/dev-server.mjs --lan` HTTP API ve statik dosyaları aynı origin'de servis eder; varsayılan `dev` modu yalnızca loopback'tir. `createDevServer(root, {lan:true})` entegrasyon testlerinde sıfır portla çalışır. Servis kapatılınca yayınlar ve tick zamanlayıcısı temizlenir.

`src/lan/LanClient.js` JSON komutları sıralar, Authorization başlıklı fetch/SSE akışını okur ve bağlantıyı tekrar kurar. Token yalnızca sekmeye ait `sessionStorage` içindedir; katılım URL'sine yazılmaz. Yenilenen sayfa sunucunun son sıra numarasından devam eder. `LanRenderer` 20 Hz snapshot'ları 90 ms çizim tamponunda birleştirir; teleport/respawn geçişlerini karıştırmaz. Sunucu fizik adımları 1/120 saniyeyi geçmez. `PlayerAnimation` yürüyüş sunumunda paylaşılır.

`lan.html`, `styles/lan.css`, `src/lan/LanUI.js` ve `strings.js` ayrı LAN arayüzünü oluşturur. Tek oyunculu `Game` başlatılmaz. `LanRewards` sunucunun kişisel ödül makbuzlarını normal cüzdana aktarır; LAN istemcisi oyun kayıtlarına yazmaz. `tests/lan-check.mjs` iki oyunculu gerçek HTTP yayınlarıyla oda açma, hazır kontrolü, yetkisiz istekler, 4 oyuncu limiti, liderlik devri ve geri bağlanmayı doğrular; iki modun mekaniğini ve 4 oyuncu/8 harita simülasyonunu da çalıştırır.

## Tek oyunculu / LAN görsel eşleşmesi

`src/rendering/ArcadeDrawing.js` iki modun ortak Canvas çizimlerini tutar: birleşen neon duvarlar, yem ve can yemi, oyuncu pozları, hayaletler, korku modu ve yetenek efektleri. `MazeMap` ve `LanRenderer` aynı duvar katmanını üretir. LAN önbelleği yemler değiştiğinde korunur; duvar geometrisi veya renk paleti değiştiğinde yenilenir.

Sunucu snapshot’larında atlayış yolu/ilerlemesi, boost durumu ve hayalet yetenek uyarıları da taşınır. Bu alanlar yalnızca çizim içindir; hareket, süreler ve çarpışmalar sunucuda hesaplanır. LAN oyuncu halkaları ve isimleri ortak çizime eklenir. `tests/lan-rendering-check.mjs` harita, korku ve özel hayalet çizimlerinin iki modda eşleşmesini ve duvar önbelleğini sınar.

## Büyük LAN sahası

`src/data/lan.js` LAN’a özel 41×35 saha, dört oyuncu doğma noktası, merkez can yemi ve 6 hayalet limitini tutar. `src/gameplay/lan-map.js` boyutları ortak deterministik üreticiye verir ve altı farklı hayalet kadrosunu seçer. Dört temel hayalete iki uzman eşlik eder.

`MovementSystem` yol bulma alanlarını ve `GhostManager` harita hedeflerini etkin grid boyutundan okur. Duvar/yem çizimleri de grid boyutunu kullanır; `LanRenderer` Canvas boyutunu gelen haritaya uyarlar. Tek oyunculu harita ve dört hayalet limiti değişmez.

Yakın görünüm yerel Canvas kamerasını iki kat büyütür; yaşayan oyuncuyu takip eder ve saha sınırlarında durur. Dar ekranda varsayılan olarak açıktır. Haritanın tamamını gösterme düğmesi kamera ölçeğini sıfırlar. Kamera sunucuya komut göndermez ve dünya koordinatlarını değiştirmez.

`tests/lan-map-check.mjs` 43 büyük haritanın erişilebilirliğini, altı hayaletin ayrı doğumlarını, uzak bölgelerde AI/yetenekleri ve yeni merkez ödülünü sınar. `tests/lan-rendering-check.mjs` büyük Canvas boyutunu, uzak yemleri ve kamera sınırlarını da doğrular.

## LAN ödülleri ve izleme

`LanWorld.settleRewards()` iş birliğinde bölüm sonundaki takım toplamının %50’sini her oyuncu için hesaplar; pay oyuncu sayısına bölünmez. Puan yarışında maç sonundaki kişisel skorun %50’sini hesaplar. Makbuz kimliği maç UUID’si ve oyuncu kimliğinden oluşur; iş birliğinde aynı makbuzun toplam hak edişi artar. `LanService.snapshot()` yalnızca alıcı oyuncunun makbuzlarını yayınlar. Önceki makbuzlar yeniden maç başlatılırken korunur.

`src/lan/LanRewards.js` makbuzları sekmeler arası Web Lock ve bir işlem kuyruğuyla uygular. `PointWallet.claimLanReward()` ödülün ödenmemiş farkını, bakiye ve makbuzla tek localStorage yazısında saklar. 512 makbuzluk geçmiş budanırken zaman eşiği tutulur; eski bir makbuz yeniden ödül üretmez. Mevcut envanter, giyim ve görev ödülleri korunur. Depolama hatasında makbuz tüketilmez.

`LanUI.renderSpectator()` yaşayan takım arkadaşlarını ayrı bir seçim çubuğunda gösterir. İzleme uyarısı karartma katmanını açmaz. `LanRenderer.camera()` seçili takım arkadaşını takip eder; oyuncu canla geri döndüğünde normal kamera ve kontroller geri gelir.

## Beş rastgele güç yemi

`src/gameplay/power-pellets.js` yerleşimleri dağıtır; güç yemleri çıkarıldığında kalan yolların bağlılığını kontrol ederek en sona bırakma kuralını mümkün kılar. `map-generation.js` geometri tohumundan ayrı bir `powerSeed` kabul eder. Bölüm ve LAN başlangıcı yeni güç yemi tohumu üretir; Challenge kodu deterministik kalır. `SaveManager` geometriyi, boş alanları ve en fazla beş güç yemini doğrular; eski köşe yerleşimlerini de kabul eder.

## LAN lobisi, denge ve ağ dayanıklılığı

`src/data/lan-options.js` harita seçeneklerini, kadroya göre dengeyi, oturum sürelerini ve güvenli kozmetik kimlik normalleştirmesini paylaşır. `server/LanLobby.js` oyları oyuncu kimliğiyle tutar; yalnızca bağlı oyuncuları sayar, eşitlikte bağlı liderin oyunu kullanır. `LanService` başlangıçta kazanan mod/haritayı uygular ve yalnızca lobi sırasında önizleme üretir. `createLanMap(..., { mode, map })` yarışta simetrik geometri, dört simetrik güç yemi ve merkez alanında rastgele beşinci güç yemi kurar. Her LAN bölümünde altı hayalet kalır; bölümün oyuncu sayısı hız/çıkış/özel yetenek beklemelerini belirler. Hedef yükü yakınlık hesabına eklenir.

`LanWorld` başarılı toplama, hayalet teması ve yetenek kullanımından maç istatistiklerini üretir. `LanPanels` oylama, görünüm seçimi, sonuç tablosu ve bağlantı şeridini sunar. `LanAppearance`, tek oyunculu `AssetLoader` atlas kırpmasını ve `AvatarLayout` yerleşimini kullanır; 64 girişli Canvas/kaynak önbellekleri oyun içinde ve lobide aynı modeli gösterir. `ArcadeDrawing.drawPlayer` hem Image hem kompoze Canvas kaynaklarını kabul eder.

`LanClient` ping ölçer; ilk geçerli snapshot öncesi bağlı sayılmaz. Akış watchdog'u, 30 saniyelik geri dönüş, artan snapshot sürümleri, aynı seq ile komut tekrarları ve son yönü saklayan kuyruk ağ gecikmesini yönetir. Ağ testleri `tests/lan-readiness-check.mjs` içinde gerçek HTTP/SSE üzerinde çalışır. Oyuncu oturumu aynı Bearer token ile döner; kozmetik kimlikleri sunucu kataloğundan doğrulanır, istemci kaynak URL'si kabul edilmez. Hesap kalıcılığı ayrı `AccountStore` deposunda tutulur; misafir cüzdanı yerel kalır.

## Hesap profili ve oda yetkileri

- `server/AccountStore.js`: atomik JSON kayıtları, hesap/session özeti, kullanıcı başına seri profil işlemleri ve revision kontrolü. Public okumalar bekleyen yazıları bitirir. Özel solo/görev/LAN ödeme eşikleri tekrar krediyi engeller; alışveriş katalog fiyatından hesaplanır. Kısmen tamamlanmış yazı mevcut profilin üstüne yazılmaz.
- `server/Password.js`: native scrypt ve sabit zamanlı karşılaştırma; hesap/oda şifresini hash olarak saklar. Şifre karmaşıklığı veya uzunluk kuralı uygulamaz. Pahalı scrypt işlemleri bellek kullanımını sınırlamak için sırayla yürür.
- `server/AccountService.js`, `http.js`: register/login/me/profile/import/logout API, JSON/body limitleri, origin kontrolü, HttpOnly oturum cookie'si ve giriş/katılım hız sınırı. Çıkış yalnızca ilgili hesap oturumunun odadaki üyeliğini kaldırır.
- `src/account/ProfileStorage.js`: mevcut senkron `getItem/setItem` yüzeyi üzerinden misafir localStorage ve hesap profilini ayırır. Hesap değişiklikleri debounce/CAS retry ile sunucuya gider, yalnızca sahibine ait pending cache tutulur. BroadcastChannel aynı origin sekmelerini günceller; hesap değişimi eski sekmeleri yeniler.
- `src/account/AccountUI.js`, `messages.js`, `styles/account.css`: iki alanlı hesap dialog'u, kayıt/giriş/çıkış, profil durumu, tekrar deneme ve boş hesaba açıkça seçilen tek seferlik misafir aktarımı. Tek oyunculu oyunda dialog açıkken oyun durur ve yazılan tuşlar oyun girdisine gitmez.
- `src/data/account-profile.js`: hesapta eşitlenen anahtarların beyaz listesi. `PointWallet`, `MissionProgress`, `SaveManager`, `Game` ve `ChallengeMode` ortak adaptörü kullanır. Dil/ses/görüntü cihaz tercihi olarak kalır.

`LanService` üyeleri `player` ve `spectator` rolleriyle ayırır. İzleyici simülasyonda aktör değildir; en fazla 8 izleyici izleme/ping/ayrılma dışında komut gönderemez. Şifre kontrolü ve ban hem oyuncuya hem izleyiciye uygulanır. Oda listesi gizli odaları dışarıda tutar, şifreli odayı yalnızca locked bayrağıyla tanımlar. Host kick SSE `removed` olayı gönderir ve üyeliği siler; ban hesap kimliği veya misafir cookie'sine bağlanır. Hesaplı üyede Bearer oda token'ına ek olarak doğru hesap cookie'si gerekir.

LAN ödülleri `queueReward()` ile **istemci talebinden bağımsız** disk cüzdanına işlenir. `/api/lan/rewards` yalnızca mevcut oyuncunun sunucuda üretilen makbuzlarının kaydını bekler ve güncel profil döndürür; miktar istemciden alınmaz. `LanRewards` hesaplı oyuncuda bu profili yeniler, misafirde önceki yerel ödeme yolunu kullanır. Solo skor/görev bildirimleri ve ilk misafir aktarımı istemciye güvenmeye devam eder; bu, LAN simülasyonunun sunucu yetkisinden ayrı bir sınırdır.

`ACCOUNT_DATA_DIR` statik dosya servisi dışında tutulur; varsayılan `.data/`, Docker'da `/app/.data` ve kalıcı volume. Dosya deposu tek sunucu süreci içindir. Hesap/cüzdan kayıtları kalıcı, oda/world/oda banları RAM'dedir. `tests/accounts-check.mjs` izole geçici dizinle çalışır ve gerçek oyuncu bakiyelerini değiştirmez.
