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

`npm test` iki kontrol çalıştırır:

1. `tests/ghosts-check.cjs`, `tests/helpers/game-harness.mjs` üzerinden gerçek ESM sınıflarını yükleyerek 143 davranış kontrolünü çalıştırır. DOM/Canvas taklitleri yalnızca testlerde bulunur.
2. `tests/project-check.mjs` import yollarını, 12 görsel dosyasını, CSS bağlantılarını, HTML kimliklerini, sunucu MIME türlerini, eski adresleri ve HTTP hata davranışlarını sınar.

`index-ghosts.html` yalnızca `index.html` yönlendirmesidir. Yerel sunucu eski `/Maze Chase Example/` URL önekini de tanır. Tarayıcı origin'i ve kayıt anahtarları korunur. `archive/index-before-modular.html` önceki girişin arşividir; modüler oyun tarafından yüklenmez.
