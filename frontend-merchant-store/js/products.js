export const products = [
  {
    id: 'travel-trunk',
    name: 'Monogram Travel Trunk',
    description: 'Heritage trunk crafted in signature monogram canvas with brass hardware and hand-stitched leather trims.',
    price: 6200,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'atelier-tote',
    name: 'Atelier Cabas Tote',
    description: 'Supple grained leather tote with gold-toned accents and microfiber lining.',
    price: 2850,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'silk-scarf',
    name: 'Soie Silk Scarf',
    description: 'Hand-rolled silk scarf featuring archival Maison patterns.',
    price: 690,
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'evening-loafer',
    name: 'Nocturne Evening Loafer',
    description: 'Polished calf leather loafers with subtle LV signature hardware.',
    price: 1250,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'capucine-mini',
    name: 'Capucine Mini',
    description: 'Compact crossbody bag in Taurillon leather with removable chain strap.',
    price: 3450,
    image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'voyage-coat',
    name: 'Voyage Cashmere Coat',
    description: 'Double-faced cashmere coat with hand-stitched seams and silk lining.',
    price: 4800,
    image: 'https://images.unsplash.com/photo-1525171254930-643fc658b64e?auto=format&fit=crop&w=1000&q=80',
  },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
