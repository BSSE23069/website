import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socket } from '../lib/socket';

// Use CDN for Leaflet icons to avoid bundling issues
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ShipMapProps {
  ships: any[];
  zones: any[];
  onZoneCreate?: (zone: any) => void;
  role: 'command' | 'captain';
  selectedShipId?: string;
  onShipClick: (ship: any) => void;
}

export default function ShipMap({ ships, zones, onZoneCreate, role, selectedShipId, onShipClick }: ShipMapProps) {
  const [drawingCoords, setDrawingCoords] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isDrawing || role !== 'command') return;
        setDrawingCoords(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
    });
    return null;
  };

  const finalizeZone = () => {
    if (drawingCoords.length < 3) return;
    onZoneCreate?.({
      name: `Restricted Zone ${zones.length + 1}`,
      coordinates: [...drawingCoords, drawingCoords[0]].map(c => [c[1], c[0]]), // geojson uses [lng, lat]
      id: Date.now().toString()
    });
    setDrawingCoords([]);
    setIsDrawing(false);
  };

  return (
    <div className="relative w-full h-full bg-zinc-100">
      <MapContainer 
        center={[26.5, 54.5]} 
        zoom={7} 
        className="w-full h-full grayscale-[90%] brightness-[1.05] contrast-[1.1]"
        style={{ background: '#f4f4f5' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <MapEvents />

        {/* Restricted Zones */}
        {zones.map((zone, idx) => (
          <Polygon 
            key={idx} 
            positions={zone.coordinates.map((c: any) => [c[1], c[0]])}
            pathOptions={{ color: '#000', weight: 1, fillColor: '#000', fillOpacity: 0.1, dashArray: '4, 4' }}
          >
            <Popup><span className="font-sans text-[10px] font-bold">{zone.name}</span></Popup>
          </Polygon>
        ))}

        {/* Currently Drawing Zone */}
        {drawingCoords.length > 0 && (
          <Polygon 
            positions={drawingCoords}
            pathOptions={{ color: '#000', weight: 2, dashArray: '5, 5' }}
          />
        )}

        {/* Ships */}
        {ships.map((ship) => (
          <Marker 
            key={ship.shipId} 
            position={ship.position}
            icon={L.divIcon({
              className: 'custom-ship-icon',
              html: `
                <div class="relative">
                  <div class="w-5 h-5 flex items-center justify-center transition-all duration-1000" style="transform: rotate(${ship.heading}deg)">
                     <svg viewBox="0 0 24 24" class="w-full h-full ${ship.status === 'distressed' ? 'text-red-600 animate-pulse' : 'text-zinc-900'}" fill="currentColor">
                        <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" />
                     </svg>
                  </div>
                  ${selectedShipId === ship.shipId ? '<div class="absolute -inset-1 border border-zinc-900 rounded-sm scale-150"></div>' : ''}
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
            eventHandlers={{
              click: () => onShipClick(ship)
            }}
          >
            <Popup>
              <div className="font-sans text-[10px] p-1">
                <p className="font-bold border-b border-zinc-100 mb-1 pb-1 uppercase tracking-tight">{ship.name}</p>
                <div className="space-y-0.5">
                  <p><span className="text-zinc-400">STATUS:</span> <span className={ship.status === 'distressed' ? 'text-red-600 font-bold' : 'text-zinc-900'}>{ship.status.toUpperCase()}</span></p>
                  <p><span className="text-zinc-400">SPEED:</span> <span className="text-zinc-900">{ship.speed} kn</span></p>
                  <p><span className="text-zinc-400">FUEL:</span> <span className="text-zinc-900">{ship.fuel.toFixed(0)} t</span></p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {role === 'command' && (
        <div className="absolute top-6 right-6 z-[1000] flex gap-3">
          {!isDrawing ? (
            <button 
              onClick={() => setIsDrawing(true)}
              className="bg-white border border-zinc-200 px-4 py-2 rounded-lg text-xs font-bold text-zinc-900 shadow-sm hover:bg-zinc-50 transition-all flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              Design Restricted Area
            </button>
          ) : (
            <div className="flex gap-2 p-1 bg-white border border-zinc-200 rounded-lg shadow-sm">
              <button 
                onClick={finalizeZone}
                className="bg-zinc-900 px-4 py-2 rounded-md text-[10px] font-bold text-white uppercase tracking-wider"
              >
                Confirm Area
              </button>
              <button 
                onClick={() => { setIsDrawing(false); setDrawingCoords([]); }}
                className="bg-white px-4 py-2 rounded-md text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
