export const products = [
  {
    id: 'travel-trunk',
    name: 'Heritage Monogram Trunk',
    description: 'Iconic travel companion featuring monogram canvas, Italian brass hardware, and vegetable-tanned leather accents. A masterpiece of Parisian craftsmanship.',
    price: 8500,
    image: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'atelier-tote',
    name: 'Signature Leather Handbag',
    description: 'Exquisite full-grain calfskin handbag with hand-burnished edges, 18-karat gold hardware, and suede interior. The epitome of refined elegance.',
    price: 4200,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'silk-scarf',
    name: 'Couture Silk Carré',
    description: 'Museum-quality pure silk twill scarf hand-finished with rolled edges. Each piece features hand-illustrated motifs inspired by Maison archives.',
    price: 850,
    image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'evening-loafer',
    name: 'Prestige Leather Loafer',
    description: 'Blake-stitched Italian calfskin loafers with hand-applied patina finish. Featuring signature gold embellishments and leather sole construction.',
    price: 1650,
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'capucine-mini',
    name: 'Première Evening Bag',
    description: 'Exceptional Taurillon leather clutch with detachable 18K gold-plated chain. Interior lined in Alcantara with multiple card compartments.',
    price: 5200,
    image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'voyage-coat',
    name: 'Imperial Cashmere Overcoat',
    description: 'Double-faced 100% Mongolian cashmere with hand-stitched lapels and pure silk Charmeuse lining. Tailored in our Parisian atelier to perfection.',
    price: 7800,
    image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1000&q=80',
  },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
