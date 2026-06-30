import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RetreatHouse } from '../types';
import { MapPin, Star } from 'lucide-react';

// Fix Leaflet default marker icon (broken in Vite builds)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createHouseIcon = (isSelected: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background: ${isSelected ? '#464E3D' : '#C5A059'};
      color: white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">
      <span style="transform: rotate(45deg); font-size: 14px;">🏠</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });

function FitBounds({ houses }: { houses: RetreatHouse[] }) {
  const map = useMap();
  useEffect(() => {
    if (houses.length === 0) return;
    const bounds = L.latLngBounds(houses.map(h => [h.lat, h.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
  }, []);
  return null;
}

interface InteractiveMapProps {
  houses: RetreatHouse[];
  onSelectHouse: (house: RetreatHouse) => void;
}

export default function InteractiveMap({ houses, onSelectHouse }: InteractiveMapProps) {
  const approvedHouses = houses.filter(h => h.status === 'approved' && h.lat && h.lng);

  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-[var(--color-natural-secondary)]">
        <MapPin className="w-4 h-4 text-[var(--color-natural-primary)]" />
        <span>خريطة بيوت الخلوات في مصر ({approvedHouses.length} موقع)</span>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-[var(--color-natural-border)] shadow-sm min-h-[400px]">
        <MapContainer
          center={[27.0, 30.5]}
          zoom={6}
          style={{ width: '100%', height: '100%', minHeight: 400 }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds houses={approvedHouses} />
          {approvedHouses.map(house => (
            <Marker
              key={house.id}
              position={[house.lat, house.lng]}
              icon={createHouseIcon(false)}
            >
              <Popup maxWidth={260}>
                <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif', minWidth: 220 }}>
                  {house.images[0] && (
                    <img
                      src={house.images[0]}
                      alt={house.name}
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                    />
                  )}
                  <p style={{ fontWeight: 700, fontSize: 14, margin: '4px 0' }}>{house.name}</p>
                  <p style={{ fontSize: 12, color: '#867E65', margin: '2px 0' }}>{house.governorate}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0' }}>
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>★</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{house.rating}</span>
                    <span style={{ fontSize: 11, color: '#867E65' }}>({house.reviewsCount} تقييم)</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#464E3D', margin: '4px 0' }}>
                    {house.pricePerNightPerPerson} ج.م / شخص / ليلة
                  </p>
                  <button
                    onClick={() => onSelectHouse(house)}
                    style={{
                      marginTop: 8, width: '100%', background: '#464E3D', color: 'white',
                      border: 'none', borderRadius: 8, padding: '6px 0', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600
                    }}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
