# Kod düzeni

Oyun standart ES modüllerine ayrılmıştır. `index.html` arayüzü, `styles/` görünümü, `assets/` görselleri taşır. `src/main.js` yalnızca `Game` örneğini oluşturur. JavaScript veya görseller HTML içinde gömülü değildir. Derleme ve çalışma zamanı kütüphanesi gerekmez.

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

`SaveManager` kayıtları doğrular; oyun zamanı, oyuncu ve hayaletler, harita, yemler, yetenekler ve skor/can bilgilerini geri yükler. Mevcut localStorage anahtarları ve kayıt biçimi korunur. Aynı origin kullanılmalıdır; port değişimi ayrı kayıt alanı oluşturur.

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

`npm test` altı kontrol çalıştırır:

1. `tests/ghosts-check.cjs`, `tests/helpers/game-harness.mjs` üzerinden gerçek ESM sınıflarını yükleyerek 143 davranış kontrolünü çalıştırır. DOM/Canvas taklitleri yalnızca testlerde bulunur.
2. `tests/arcade-check.mjs` 20 sunum, ayar, Web Audio ve kombo/kayıt kontrolünü çalıştırır.
3. `tests/avatar-fitting-check.mjs` 20 başlığı, tüm birleştirilebilir kostümleri ve 340 yerleşimin bağlantı/tuval sınırlarını doğrular.
4. `tests/challenge-check.mjs` 450 üretilen haritanın erişilebilirliğini ve 10 kuralı, süreleri, yeniden denemeyi, ödül ve kayıt/rekor ayrımını sınar.
5. `tests/missions-check.mjs` katalogdaki 100 görevi/ödülü, gerçek oyun olaylarını, kayıt tekrarlarını, eski kayıt uyumluluğunu, ödeme hatalarını, filtreleri ve duraklatmayı sınar.
6. `tests/project-check.mjs` import yollarını, 12 görsel dosyasını, CSS bağlantılarını, HTML kimliklerini, sunucu MIME türlerini, eski adresleri ve HTTP hata davranışlarını sınar.

`index-ghosts.html` yalnızca `index.html` yönlendirmesidir. Yerel sunucu eski `/Maze Chase Example/` URL önekini de tanır. Tarayıcı origin'i ve kayıt anahtarları korunur. `archive/index-before-modular.html` önceki girişin arşividir; modüler oyun tarafından yüklenmez.

## Challenge oluşturma ve kurallar

`src/data/challenges.js` tohumdan deterministik kural/zorluk/kadro seviyesi üretir. `MazeMap.createLevelMap(level, {seed, styleLevel})` mevcut labirent üreticisini rastgele tohumla kullanır; yalnızca bölüm numarası verilmesi önceki bölüm haritalarını korur. `applyChallengeRule` güç yemsiz dönüşümü ve köşe yemlerine dokunmadan dolaşmayı sağlayan bağlantıları uygular; menü önizlemesi ve oyun aynı işlemi kullanır.

`ChallengeMode` tek denemelik koşuyu, kural ihlalini, süre sınırını, bonusu ve ayrı rekoru yönetir. `ChallengeSelection` önizleme, zorluk, yeniden üretme ve aynı denemeyi tekrarlama akışını yönetir. `Game.mode` etkin oyunu, `menuMode` henüz başlamamış menü tercihini ifade eder. Challenge'da kayıt kapalıdır; ortak cüzdan puan kazanmaya devam eder. Kampanyaya dönüş ve kayıt yükleme, bölüm rekorunu geri getirir. Yeni arayüz `styles/challenge.css` içindedir.

`ChallengeMode.skillsUsed` ve `ghostsCaught` deneme boyunca korunur, yeni denemede sıfırlanır. Başarılı aktivasyon `AbilitySystem` içinde hak tüketir; yön tamponu hak tüketmez. `beforeGhostCaught` yakalama puanı/sahnesinden önce barışçıl koşuyu doğrular ve av sayısını artırır. `beforeBonus` son yemden sonra av hedefine ulaşılmadıysa can yemi aşamasını açmaz. Güç süresi ve normal hayalet hız çarpanı üretilen Challenge tanımından okunur; bölüm modundaki değerler değişmez.

## 100 görev ve ödül akışı

`src/data/missions.js` 10 türde yükselen hedefleri ve 10 özel Challenge kuralı hedefini üretir; `MISSIONS` tam 100 benzersiz, sabit kimlik içerir. Hedefler ilk sayfadan itibaren farklı türleri gösteren 10'lu gruplar halinde sıralanır. `MissionProgress` kalıcı toplamları ve koşu başına sayaç eşiklerini tutar. `MazeMap`, `AbilitySystem`, `Game` ve `ChallengeMode` yalnızca gerçekleşmiş olayları bildirir: iptal edilen zıplama, başarısız Challenge veya barışçıl koşuda yasak hayalet teması sayılmaz.

`SaveManager` isteğe bağlı `missionCursor` alanını doğrular ve geri yükler; eski kayıtlar bu alan olmadan geçerlidir. Koşu geçmişi en fazla 128 kayıt tutar; etkin ve iki kayıt yuvasındaki koşular budanmaz. Ödül kimliği ve cüzdan ödemesi `PointWallet.claimMission` ile aynı localStorage yazısında saklanır. Görev ödülü `Game.addScore` kullanmaz ve kazanılmış oyun puanı hedefinden çıkarılır. Cüzdanın sürümü ve eski verinin geçerliliği korunur.

`MissionMenu` ayrı dialog, filtreler, sayfalar, toplu ödül ve üst çubuk rozeti sunar. Diğer menülerle birlikte açılamaz; oyun, giriş ve ara sahne durumunu kapatınca geri yükler. Görünüm `styles/missions.css` içinde, bütün metinler Türkçe/İngilizce çevirilerde bulunur.
