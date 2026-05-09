import { motion } from 'motion/react';
import { Anchor, AlertTriangle, Fuel, Navigation, Shield, Ship } from 'lucide-react';

interface FleetSidebarProps {
  ships: any[];
  selectedShip: any | null;
  onSelectShip: (ship: any) => void;
  alerts: any[];
}

export default function FleetSidebar({ ships, selectedShip, onSelectShip, alerts }: FleetSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-white border-l border-zinc-200">
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Shield size={14} className="text-zinc-900" /> Fleet Assets
        </h2>
        <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
          Live Track
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {ships.map((ship) => (
          <motion.div
            key={ship.shipId}
            layoutId={ship.shipId}
            onClick={() => onSelectShip(ship)}
            className={`p-3 rounded-lg cursor-pointer transition-all ${
              selectedShip?.shipId === ship.shipId 
                ? 'bg-zinc-100 border border-zinc-200' 
                : 'hover:bg-zinc-50 border border-transparent'
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={`text-sm font-semibold tracking-tight ${selectedShip?.shipId === ship.shipId ? 'text-zinc-900' : 'text-zinc-700'}`}>
                {ship.name}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                ship.status === 'distressed' 
                  ? 'bg-red-50 text-red-600 border border-red-100 pulse' 
                  : ship.status === 'arrived'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-zinc-50 text-zinc-500 border border-zinc-100'
              }`}>
                {ship.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
              <div className="flex items-center gap-1">
                <Navigation size={10} /> {ship.speed}kn
              </div>
              <div className="flex items-center gap-1">
                <Fuel size={10} /> {ship.fuel.toFixed(0)}t
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="p-5 bg-zinc-50 border-t border-zinc-200 max-h-56 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase text-zinc-400 mb-3 flex items-center gap-1">
            <AlertTriangle size={12} className="text-red-500" /> Crisis Logs
          </p>
          <div className="space-y-3">
            {alerts.slice(-5).reverse().map((alert, idx) => (
              <div key={idx} className="text-[11px] leading-relaxed border-l-2 border-zinc-200 pl-3 py-0.5">
                <span className="text-zinc-900 font-bold block mb-0.5">{alert.type.toUpperCase()}</span>
                <span className="text-zinc-500">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
