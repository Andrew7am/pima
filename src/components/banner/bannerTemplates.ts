import { BannerLayout, PromoBanner } from '../../types';

// Ready-made starting points, so an admin never faces an empty canvas. Each is
// a full layout in the same JSON the designer edits — pick one, then keep
// dragging. Geometry stays percent-based, so every template fits the shipped
// banner box at any width.

export interface BannerTemplate {
  id: string;
  name: string;
  hint: string;
  /** Small visual for the picker: a CSS gradient standing in for the artwork. */
  swatch: string;
  build: (placement: PromoBanner['placement']) => BannerLayout;
}

const el = (o: Partial<BannerLayout['elements'][number]> & { id: string; type: BannerLayout['elements'][number]['type'] }) => ({
  visible: true, locked: false, x: 6, y: 30, opacity: 1, ...o,
}) as BannerLayout['elements'][number];

export const BANNER_TEMPLATES: BannerTemplate[] = [
  {
    id: 'offer',
    name: 'عرض وخصم',
    hint: 'شارة كبيرة + خصم بارز',
    swatch: 'linear-gradient(135deg,#0A2342,#123E75)',
    build: () => ({
      version: 1,
      background: 'linear-gradient(135deg,#0A2342,#123E75)',
      image: { fit: 'cover', scale: 1.1, x: 0, y: 0, opacity: 0.55 },
      overlay: { enabled: true, opacity: 0.5 },
      elements: [
        el({ id: 'badge', type: 'badge', x: 6, y: 12, fontSize: 10, color: '#0A2342', bg: '#C5A059', radius: 20 }),
        el({ id: 'title', type: 'title', x: 6, y: 34, width: 66, fontSize: 20, color: '#FFFFFF', shadow: true, fontWeight: 900 }),
        el({ id: 'subtitle', type: 'subtitle', x: 6, y: 60, width: 66, fontSize: 11, color: '#E5E7EB', shadow: true }),
        el({ id: 'button', type: 'button', x: 6, y: 76, fontSize: 10, color: '#0A2342', bg: '#C5A059', radius: 22 }),
      ],
    }),
  },
  {
    id: 'house',
    name: 'بيت مميز',
    hint: 'الصورة واضحة والنص جانبي',
    swatch: 'linear-gradient(135deg,#5A5A40,#8A8A70)',
    build: () => ({
      version: 1,
      background: 'linear-gradient(135deg,#5A5A40,#8A8A70)',
      image: { fit: 'cover', scale: 1, x: 0, y: 0, opacity: 0.9 },
      overlay: { enabled: true, opacity: 0.35 },
      elements: [
        el({ id: 'badge', type: 'badge', x: 6, y: 10, fontSize: 9, color: '#FFFFFF', bg: '#5A5A40', radius: 8 }),
        el({ id: 'title', type: 'title', x: 6, y: 46, width: 60, fontSize: 16, color: '#FFFFFF', shadow: true, fontWeight: 900 }),
        el({ id: 'subtitle', type: 'subtitle', x: 6, y: 66, width: 60, fontSize: 10, color: '#EFEFEF', shadow: true }),
        el({ id: 'button', type: 'button', x: 70, y: 74, fontSize: 10, color: '#FFFFFF', bg: '#5A5A40', radius: 14 }),
      ],
    }),
  },
  {
    id: 'social',
    name: 'منصّات التواصل',
    hint: 'أيقونات كبيرة في المنتصف',
    swatch: 'linear-gradient(135deg,#C5A059,#E1306C)',
    build: () => ({
      version: 1,
      background: 'linear-gradient(135deg,#C5A059,#E1306C)',
      image: { fit: 'cover', scale: 1.2, x: 0, y: 0, opacity: 0.4 },
      overlay: { enabled: true, opacity: 0.55 },
      elements: [
        el({ id: 'title', type: 'title', x: 6, y: 22, width: 88, fontSize: 17, color: '#FFFFFF', align: 'center', shadow: true, fontWeight: 900 }),
        el({ id: 'subtitle', type: 'subtitle', x: 6, y: 45, width: 88, fontSize: 10, color: '#E5E7EB', align: 'center', shadow: true }),
        el({ id: 'icons', type: 'icons', x: 32, y: 64 }),
      ],
    }),
  },
  {
    id: 'minimal',
    name: 'بسيط وأنيق',
    hint: 'عنوان واحد وزر',
    swatch: 'linear-gradient(135deg,#FAF8F5,#D6D6C2)',
    build: () => ({
      version: 1,
      background: 'linear-gradient(135deg,#3D3D2B,#5A5A40)',
      image: { fit: 'cover', scale: 1, x: 0, y: 0, opacity: 0.75 },
      overlay: { enabled: true, opacity: 0.4 },
      elements: [
        el({ id: 'title', type: 'title', x: 6, y: 38, width: 70, fontSize: 18, color: '#FFFFFF', shadow: true, fontWeight: 700 }),
        el({ id: 'button', type: 'button', x: 6, y: 68, fontSize: 10, color: '#0A2342', bg: '#FFFFFF', radius: 24 }),
      ],
    }),
  },
  {
    id: 'announce',
    name: 'إعلان مهم',
    hint: 'نص وسط على خلفية داكنة',
    swatch: 'linear-gradient(135deg,#111111,#5A5A40)',
    build: () => ({
      version: 1,
      background: 'linear-gradient(135deg,#111111,#5A5A40)',
      image: { fit: 'cover', scale: 1, x: 0, y: 0, opacity: 0.3 },
      overlay: { enabled: true, opacity: 0.7 },
      elements: [
        el({ id: 'badge', type: 'badge', x: 38, y: 14, fontSize: 9, color: '#111111', bg: '#C5A059', radius: 20 }),
        el({ id: 'title', type: 'title', x: 6, y: 36, width: 88, fontSize: 16, color: '#FFFFFF', align: 'center', shadow: true, fontWeight: 900 }),
        el({ id: 'subtitle', type: 'subtitle', x: 6, y: 58, width: 88, fontSize: 10, color: '#D9D9D9', align: 'center' }),
        el({ id: 'button', type: 'button', x: 36, y: 76, fontSize: 10, color: '#111111', bg: '#C5A059', radius: 20 }),
      ],
    }),
  },
];
