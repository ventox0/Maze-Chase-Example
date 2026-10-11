# Dükkân atlasları

Bu PNG dosyaları `src/data/assets.js` üzerinden yüklenir. Yayınlanan projede `assets/shop/` klasörünü koru.

- `outfits-open-mouth-v1.png`: ana karakterin ağzı görünen kostümler.
- `head-accessories-v1.png`: başlıklar.
- `special-outfits-v2.png`: Cyber Armor ve Pumpkin için özel kapalı tasarımlar.

Kırpma bölgeleri `src/data/shop.js` içindeki `SHOP_ATLAS_REGIONS` verisinde tutulur. Ürün adı, fiyatı ve tam set kuralı aynı dosyada yer alır. Çizim ve katman birleştirme `src/ui/PointShop.js` tarafından yönetilir.

## Başlık hizalaması

`src/data/avatar-fitting.js`, normal karakterin ve birleştirilebilir kostümlerin kafa dairelerini, 20 başlığın kafa açıklığı bağlantılarını tanımlar. `src/rendering/AvatarLayout.js` bu iki bağlantıyı eşler. Yüksek veya geniş başlıklar tuvale sığmadığında tüm birleşime aynı ölçek uygulanır; aksesuar tek başına küçültülmez. Bu yerleşim önizleme, ürün kartı, oyuncu portresi ve oyun modeli için ortaktır.

Yeni başlık veya kostüm eklendiğinde fiyat ve atlas bölgesi yanında kafa bağlantısı da tanımlanmalıdır. Atlas kırpması değişirse hizalama ölçüleri görsel olarak yeniden doğrulanmalıdır.
