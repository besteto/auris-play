/* The single source of truth for what the game deals. Adding a collection is a
   row here plus its art — no code changes. Consumed by src/manifest.js, and
   never by src/rules.js, which is kept ignorant of names on purpose. */
window.Collections = [
  {
    id: 'cassiopea',
    name: { ru: 'Кассиопея', en: 'Cassiopea' },
    accent: '#8e1f22',
    hero: 'assets/plates/cassiopea.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Кольца и хеликсы глубокого красного. Гранат, сталь, ручная посадка камня.' },
      en: { body: 'Rings and helixes in deep red. Garnet, steel, hand-set stones.' }
    },
    sets: [
      { id: 'rings', tiers: 3,
        name: { ru: 'Кольца', en: 'Rings' },
        plate: {
          ru: { ref: 'REF. 01', body: 'Сегментное кольцо, три размера.',
                specs: { 'материал': 'сталь 316L', 'камень': 'гранат' } },
          en: { ref: 'REF. 01', body: 'Segment ring, three sizes.',
                specs: { 'material': '316L steel', 'stone': 'garnet' } }
        } }
    ]
  },
  {
    id: 'marchesa',
    name: { ru: 'Маркеза', en: 'Marchesa' },
    accent: '#2c4470',
    hero: 'assets/plates/marchesa.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Сапфировая линия. Холодный синий, огранка маркиз.' },
      en: { body: 'The sapphire line. Cold blue, marquise cut.' }
    },
    sets: [
      { id: 'sapphire', tiers: 3,
        name: { ru: 'Сапфир', en: 'Sapphire' },
        plate: {
          ru: { ref: 'REF. 02', body: 'Сапфировая подвеска, три размера.',
                specs: { 'материал': 'титан', 'камень': 'сапфир' } },
          en: { ref: 'REF. 02', body: 'Sapphire pendant, three sizes.',
                specs: { 'material': 'titanium', 'stone': 'sapphire' } }
        } }
    ]
  },
  {
    id: 'farfalla',
    name: { ru: 'Фарфалла', en: 'Farfalla' },
    accent: '#b9705e',
    hero: 'assets/plates/farfalla.jpg',
    url: 'https://aurisjewellery.com/',
    plate: {
      ru: { body: 'Бабочки на коже. От монохрома к пастели и к самоцвету.' },
      en: { body: 'Butterflies on skin. Mono to pastel to jewel.' }
    },
    sets: [
      { id: 'butterflies', tiers: 3,
        name: { ru: 'Бабочки', en: 'Butterflies' },
        plate: {
          ru: { ref: 'REF. 03', body: 'Бабочка, три размера.',
                specs: { 'материал': 'титан', 'покрытие': 'анодирование' } },
          en: { ref: 'REF. 03', body: 'Butterfly, three sizes.',
                specs: { 'material': 'titanium', 'finish': 'anodised' } }
        } }
    ]
  }
];
