// Atlas sırası: soldan sağa, yukarıdan aşağıya. Hepsi puanla alınan tam giysilerdir.
const designs = [
  ["pharaoh_robe", "Firavun Giysisi", "Pharaoh Robe", 18000],
  ["samurai_armor", "Samuray Zırhı", "Samurai Armor", 16000],
  ["scottish_tartan", "İskoç Giysisi", "Scottish Tartan", 6500],
  ["sultan_kaftan", "Sultan Kaftanı", "Sultan Kaftan", 18500],
  ["luchador", "Güreşçi Giysisi", "Luchador", 9500],
  ["roman_toga", "Roma Togası", "Roman Toga", 8500],
  ["clown_suit", "Palyaço Giysisi", "Clown Suit", 6000],
  ["hazmat_suit", "Koruyucu Tulum", "Hazmat Suit", 13000],
  ["gladiator", "Gladyatör Zırhı", "Gladiator", 15000],
  ["mafia_suit", "Mafya Takımı", "Mafia Suit", 11000],
  ["ninja_suit", "Ninja Giysisi", "Ninja Outfit", 14500],
  ["steampunk_suit", "Steampunk Giysisi", "Steampunk Suit", 17000],
  ["police_uniform", "Polis Üniforması", "Police Uniform", 7500],
  ["doctor_scrubs", "Doktor Giysisi", "Doctor Scrubs", 7000],
  ["construction_suit", "İnşaatçı Giysisi", "Construction Worker", 6500],
  ["prisoner_suit", "Mahkum Giysisi", "Prisoner", 5500],
  ["skeleton_suit", "İskelet Giysisi", "Skeleton", 12500],
  ["santa_suit", "Noel Baba Giysisi", "Santa Claus", 10000],
  ["pirate_captain", "Korsan Kaptanı", "Pirate Captain", 15500],
  ["sari_dress", "Sari Giysisi", "Sari Dress", 9000],
  ["matador_suit", "Matador Giysisi", "Matador Suit", 12000],
  ["forest_elf", "Orman Elfi", "Forest Elf", 17500],
  ["cyberpunk_suit", "Siberpunk Giysisi", "Cyberpunk Suit", 22000],
  ["monk_robe", "Keşiş Cübbesi", "Monk Robe", 8000],
];

export const FULL_SUIT_GRID = Object.freeze({ columns: 6, rows: 4 });
// Alpha sınırları ölçülmüştür: atlas çizimleri hücre sınırına taşsa bile kırpılmaz.
export const FULL_SUIT_REGIONS = [
  [35, 30, 238, 238], [292, 26, 234, 242], [547, 52, 205, 212],
  [780, 21, 206, 247], [1008, 44, 232, 224], [1259, 44, 228, 225],
  [40, 278, 237, 229], [300, 273, 220, 232], [545, 261, 217, 244],
  [776, 269, 224, 238], [1003, 278, 245, 227], [1268, 280, 229, 227],
  [33, 501, 223, 250], [287, 510, 228, 245], [542, 508, 217, 247],
  [780, 512, 222, 241], [1024, 513, 228, 242], [1253, 508, 257, 247],
  [31, 741, 240, 259], [287, 754, 234, 247], [535, 747, 237, 252],
  [772, 751, 234, 249], [1020, 757, 235, 243], [1273, 761, 235, 237],
];
export const FULL_SUITS = designs.map(([id, tr, en, price], index) => ({
  id,
  name: { tr, en },
  price,
  index,
  atlas: "suits",
  category: "outfit",
  exclusive: true,
  original: false,
  wrap: false,
}));
