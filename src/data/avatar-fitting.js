// Kafa dairesi: [merkez X / görsel genişliği, merkez Y / yükseklik, yarıçap / genişlik].
// Omuz, pelerin ve şapka süsleri görüntünün merkezini değiştirebildiğinden ayrı ölçülür.
export const BODY_HEAD_ANCHORS = {
  normal: [0.525, 0.54, 0.442],
  royal_cloak: [0.53, 0.37, 0.34],
  plate_armor: [0.49, 0.34, 0.36],
  sports_singlet: [0.5, 0.4, 0.46],
  kimono: [0.55, 0.39, 0.36],
  tuxedo: [0.52, 0.38, 0.43],
  pirate_coat: [0.53, 0.37, 0.38],
  western_vest: [0.54, 0.38, 0.43],
  wizard_robe: [0.52, 0.4, 0.38],
  hawaiian_shirt: [0.57, 0.39, 0.42],
  stunt_suit: [0.55, 0.35, 0.4],
  camo_jacket: [0.53, 0.39, 0.43],
  leather_jacket: [0.55, 0.38, 0.42],
  chef_apron: [0.53, 0.4, 0.47],
  fancy_jersey: [0.51, 0.4, 0.47],
  super_hero: [0.56, 0.39, 0.36],
  winter_coat: [0.51, 0.38, 0.38],
};

// Şeffaf başlığın oturduğu kafa dairesi, atlas kırpmasına göre normalize edilir.
// Alt yay kafanın dış çizgisine hafifçe bindirilir; ayrı katmanlar arasında boşluk kalmaz.
// Açık şapkalarda daire merkezi görselin altında kalabilir; bu bilinçli bir bağlantı noktasıdır.
const mount = (x, y, radius, width, height) => [
  x / width,
  y / height,
  radius / width,
];
export const HEAD_MOUNTS = {
  punk_mohawk: mount(139, 208, 98, 249, 219),
  wizard_hat: mount(151, 231, 104, 286, 205),
  baseball_cap: mount(129, 195, 108, 253, 155),
  afro_hair: mount(144, 227, 95, 277, 216),
  crown: mount(131, 226, 100, 250, 183),
  viking_helm: mount(133, 223, 103, 264, 191),
  pirate_hat: mount(152, 238, 117, 310, 194),
  detective: mount(137, 228, 115, 262, 186),
  chef_hat: mount(122, 205, 98, 229, 194),
  party_hat: mount(88, 236, 90, 186, 190),
  top_hat: mount(133, 226, 105, 247, 201),
  cowboy_hat: mount(161, 224, 115, 313, 183),
  sports_band: mount(123, 139, 102, 241, 148),
  samurai_top: mount(147, 185, 95, 258, 201),
  sombrero: mount(165, 217, 119, 331, 178),
  cat_ears: mount(119, 176, 102, 238, 181),
  astronaut: mount(156, 123, 94, 278, 242),
  spooky_horns: mount(116, 158, 93, 234, 173),
  headphones: mount(151, 120, 102, 297, 211),
  royal_feather: mount(147, 221, 104, 249, 220),
};
