/**
 * The demo shop's products: a few dozen real-sounding best sellers and a long tail
 * that hardly sells (like a real catalogue, where most products never earn anything).
 * Shopping and Performance Max traffic in the demo account is split over them.
 */
import { hash } from './simulate';

export interface DemoProduct {
  id: string;
  title: string;
  brand: string;
  category: string;
  price: number;
  /** Share of the campaign's traffic (before normalising). */
  weight: number;
  /** How well it converts compared to the campaign average. */
  cvr: number;
  /** Merchant Center findings, like the real Content API gives them. */
  issue: { status: 'warning' | 'disapproved'; issues: string[] } | null;
  availability: 'in stock' | 'out of stock';
}

const NAMED: [string, string, string, number][] = [
  ['Ergonomisk kontorstol Flex Pro – sort', 'Nordlys', 'Kontorstole', 3499],
  ['Hæve-sænkebord 160x80 cm – hvid', 'Nordlys', 'Hæve-sænkeborde', 4299],
  ['Hæve-sænkebord 120x60 cm Basis – antracit', 'Nordlys', 'Hæve-sænkeborde', 2836],
  ['Kontorstol Comfort med nakkestøtte', 'Ergoline', 'Kontorstole', 2799],
  ['Gamingstol Racer X – rød/sort', 'Ergoline', 'Gamingstole', 1999],
  ['Mødebord Oval 240 cm – eg', 'Nordlys', 'Mødeborde', 6995],
  ['Arkivskab med 4 skuffer – grå', 'Stålværk', 'Opbevaring', 2495],
  ['Stålskab 195x100 cm med 4 hylder', 'Stålværk', 'Opbevaring', 3499],
  ['Kantinestol stabelbar – 10 stk.', 'Nordlys', 'Kantinemøbler', 4987],
  ['Klapbord 180x75 cm – hvid', 'Nordlys', 'Kantinemøbler', 536],
  ['Skrivebordslampe LED Arc', 'Lumen', 'Belysning', 649],
  ['Monitorarm dobbelt – sort', 'Ergoline', 'Tilbehør', 899],
  ['Fodstøtte ergonomisk', 'Ergoline', 'Tilbehør', 349],
  ['Reol 5 hylder 200x90 cm – birk', 'Nordlys', 'Opbevaring', 1295],
  ['Lagerreol galvaniseret 180x90 cm', 'Stålværk', 'Lager', 1149],
  ['Værkstedsskab med værktøjstavle', 'Stålværk', 'Værksted', 4995],
  ['Arbejdsbænk 150 cm med skuffe', 'Stålværk', 'Værksted', 3895],
  ['Loungestol Nova – grå uld', 'Nordlys', 'Lounge', 5495],
  ['Akustikskærm 160x120 cm – grøn', 'Silens', 'Akustik', 2195],
  ['Whiteboard magnetisk 120x90 cm', 'Nordlys', 'Mødeudstyr', 799],
  ['Garderobeskab 2 rum – hvid', 'Stålværk', 'Garderobe', 2295],
  ['Barstol Loop – sort', 'Nordlys', 'Kantinemøbler', 899],
  ['Kontorstol Basic – blå', 'Ergoline', 'Kontorstole', 1299],
  ['Hjørneskrivebord 160x160 cm – eg', 'Nordlys', 'Skriveborde', 3195],
];

const ISSUES: string[][] = [
  ['Billedet er for lille (under 100×100 pixels)'],
  ['Prisen på landingssiden passer ikke med feedet'],
  ['GTIN mangler'],
  ['Produktet er udsolgt på landingssiden', 'Leveringstid mangler'],
];

export function demoProducts(): DemoProduct[] {
  const out: DemoProduct[] = [];
  const issue = (id: string, i: number): DemoProduct['issue'] => {
    if (i % 17 === 5) return { status: 'disapproved', issues: ISSUES[i % ISSUES.length]! };
    if (hash(`status|${id}`) < 0.12) return { status: 'warning', issues: ISSUES[i % ISSUES.length]!.slice(0, 1) };
    return null;
  };
  const availability = (id: string): DemoProduct['availability'] => (hash(`stock|${id}`) < 0.05 ? 'out of stock' : 'in stock');
  NAMED.forEach(([title, brand, category, price], i) => {
    const id = String(2900000000 + Math.round(hash(title) * 99_999_999));
    out.push({ id, title, brand, category, price, weight: 1 / (i + 1.6), cvr: 0.6 + hash(`cvr|${title}`) * 1.1, issue: issue(id, i), availability: availability(id) });
  });
  // The long tail: plenty of impressions now and then, almost never a sale.
  for (let i = 0; i < 260; i++) {
    const id = `c0${String(60000000 + i * 7919).slice(0, 8)}`;
    const cat = NAMED[i % NAMED.length]!;
    out.push({
      id,
      title: `${cat[2]} – variant ${i + 1}`,
      brand: cat[1],
      category: cat[2],
      price: Math.round(200 + hash(`p|${id}`) * 4000),
      weight: 0.004 + hash(`w|${id}`) * 0.012,
      cvr: i % 9 === 0 ? 0.4 : 0,
      issue: issue(id, i + NAMED.length),
      availability: availability(id),
    });
  }
  return out;
}
