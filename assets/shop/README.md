# Dükkân atlasları

Bu PNG dosyaları `src/data/assets.js` üzerinden yüklenir. Yayınlanan projede `assets/shop/` klasörünü koru.

- `outfits-open-mouth-v1.png`: ana karakterin ağzı görünen kostümler.
- `head-accessories-v1.png`: başlıklar.
- `special-outfits-v2.png`: Cyber Armor ve Pumpkin için özel kapalı tasarımlar.

Kırpma bölgeleri `src/data/shop.js` içindeki `SHOP_ATLAS_REGIONS` verisinde tutulur. Ürün adı, fiyatı ve tam set kuralı aynı dosyada yer alır. Çizim ve katman birleştirme `src/ui/PointShop.js` tarafından yönetilir.
