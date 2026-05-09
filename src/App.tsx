/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Shield, Ship, Radio, AlertCircle, Map as MapIcon, LogOut, ChevronRight, MessageSquareWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ShipMap from './components/ShipMap';
import FleetSidebar from './components/FleetSidebar';
import { socket } from './lib/socket';
import { analyzeDistressMessage } from './lib/gemini';
import { supabase } from './lib/supabase';
import { fetchMaritimeWeather, WeatherData } from './services/weatherService';

type Role = 'command' | 'captain' | null;

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [ships, setShips] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedShip, setSelectedShip] = useState<any | null>(null);
  const [activeShipId, setActiveShipId] = useState<string | null>(null); // For Captain role
  const [distressMsg, setDistressMsg] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (selectedShip) {
      fetchMaritimeWeather(selectedShip.position[0], selectedShip.position[1]).then(setWeather);
    } else {
      setWeather(null);
    }
  }, [selectedShip?.shipId]);

  useEffect(() => {
    // Initial data fetch from Supabase
    const fetchInitialData = async () => {
      if (!supabase) return;
      
      const { data: shipsData } = await supabase.from('ships').select('*');
      if (shipsData) {
        setShips(shipsData.map((s: any) => ({
          shipId: s.ship_id,
          name: s.name,
          position: [s.lat, s.lng],
          speed: s.speed,
          heading: s.heading,
          destination: s.destination,
          fuel: s.fuel,
          cargo: s.cargo,
          status: s.status,
          updatedAt: s.updated_at
        })));
      }

      const { data: zonesData } = await supabase.from('zones').select('*');
      if (zonesData) setZones(zonesData);
      
      const { data: alertsData } = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20);
      if (alertsData) setAlerts(alertsData.map((a: any) => ({
        type: a.type,
        shipId: a.ship_id,
        message: a.message,
        timestamp: new Date(a.created_at).getTime()
      })));
    };

    fetchInitialData();

    socket.on('init', (data) => {
      setShips(data.ships);
      setZones(data.restrictedZones);
      setAlerts(data.alerts);
    });

    socket.on('fleet:update', (data) => {
      setShips(prev => data.ships);
    });

    socket.on('zones:update', (data) => {
      setZones(data);
    });

    socket.on('alert:new', (data) => {
      setAlerts(prev => [...prev, data]);
    });

    // Supabase Realtime Subscription (Fallback for Vercel/Background updates)
    if (supabase) {
      const shipChannel = supabase
        .channel('ships-realtime')
        .on('postgres_changes', { event: '*', table: 'ships', schema: 'public' }, (payload) => {
          const newShip = payload.new as any;
          if (!newShip.ship_id) return;
          
          setShips(current => {
            const index = current.findIndex(s => s.shipId === newShip.ship_id);
            const mappedShip = {
              shipId: newShip.ship_id,
              name: newShip.name,
              position: [newShip.lat, newShip.lng],
              speed: newShip.speed,
              heading: newShip.heading,
              destination: newShip.destination,
              fuel: newShip.fuel,
              cargo: newShip.cargo,
              status: newShip.status,
              updatedAt: newShip.updated_at
            };
            if (index > -1) {
              const updated = [...current];
              updated[index] = mappedShip;
              return updated;
            }
            return [...current, mappedShip];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(shipChannel);
        socket.off('init');
        socket.off('fleet:update');
        socket.off('zones:update');
        socket.off('alert:new');
      }
    }

    return () => {
      socket.off('init');
      socket.off('fleet:update');
      socket.off('zones:update');
      socket.off('alert:new');
    };
  }, []);

  const handleZoneCreate = (zone: any) => {
    socket.emit('zone:create', { zone });
    fetch('/api/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone })
    });
  };

  const sendDistress = async () => {
    if (!distressMsg || !activeShipId) return;
    setIsAnalyzing(true);
    const analysis = await analyzeDistressMessage(distressMsg);
    
    socket.emit('distress:send', {
      shipId: activeShipId,
      message: distressMsg,
      analysis,
      timestamp: Date.now()
    });
    
    setDistressMsg('');
    setIsAnalyzing(false);
  };

  if (!role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-200 p-10 rounded-2xl w-full max-w-md shadow-sm space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center mx-auto mb-2">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-white"></div>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 uppercase">Strait Control</h1>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Fleet Defense Infrastructure</p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => setRole('command')}
              className="w-full p-5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-900 transition-all group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Shield size={20} className="text-zinc-900" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Command Center</p>
                    <p className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5">Strategic oversight mode</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-900" />
              </div>
            </button>

            <button 
              onClick={() => setRole('captain')}
              className="w-full p-5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-900 transition-all group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Ship size={20} className="text-zinc-900" />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">Vessel Captain</p>
                    <p className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5">Operational pilot mode</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-900" />
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Captain Role Selection
  if (role === 'captain' && !activeShipId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-6">
        <div className="bg-white border border-zinc-200 p-10 rounded-2xl w-full max-w-2xl shadow-sm">
          <button onClick={() => setRole(null)} className="text-[10px] font-bold text-zinc-400 mb-6 flex items-center gap-1 hover:text-zinc-900 uppercase tracking-wider">
            <LogOut size={12}/> Role Selection
          </button>
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-6">Select Assignment</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ships.map(s => (
              <button 
                key={s.shipId}
                onClick={() => setActiveShipId(s.shipId)}
                className="p-5 rounded-xl border border-zinc-200 bg-white hover:border-zinc-900 text-xs font-bold transition-all text-left group"
                id={`vessel-${s.shipId}`}
              >
                <div className="flex justify-between items-center">
                  <span>{s.name}</span>
                  <ChevronRight size={12} className="text-zinc-300 group-hover:text-zinc-900" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans text-zinc-900 bg-zinc-50">
      {/* Main Map Area */}
      <div className="relative flex-1 bg-zinc-100">
        <ShipMap 
          ships={ships} 
          zones={zones} 
          role={role} 
          onZoneCreate={handleZoneCreate}
          selectedShipId={selectedShip?.shipId}
          onShipClick={(ship) => setSelectedShip(ship)}
        />
        
        {/* HUD Elements */}
        <div className="absolute top-6 left-6 z-[500] bg-white border border-zinc-200 px-4 py-2.5 rounded-lg flex items-center gap-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${socket.connected ? 'bg-emerald-500' : 'bg-orange-500 animate-pulse'} transition-colors`}></div>
            <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-500">
              {socket.connected ? 'Secure Link' : 'Connecting...'}
            </span>
          </div>
          <div className="h-3 w-[1px] bg-zinc-200"></div>
          <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-900 underline underline-offset-4">{role?.toUpperCase()}</span>
          {activeShipId && (
            <>
              <div className="h-3 w-[1px] bg-zinc-200"></div>
              <span className="text-[10px] font-bold uppercase text-zinc-500">{ships.find(s => s.shipId === activeShipId)?.name}</span>
            </>
          )}
        </div>

        {/* Selected Ship Detail Mini-HUD */}
        <AnimatePresence>
          {selectedShip && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-10 left-10 z-[500] bg-white border border-zinc-200 p-8 rounded-2xl w-80 shadow-lg space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">{selectedShip.name}</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1">Telemetry Live</p>
                </div>
                <button onClick={() => setSelectedShip(null)} className="text-zinc-300 hover:text-zinc-900">×</button>
              </div>

              <div className="grid grid-cols-2 gap-8 border-y border-zinc-100 py-6">
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-400 font-bold uppercase">Bearing Speed</p>
                  <p className="font-mono text-lg font-medium text-zinc-900">{selectedShip.speed} <span className="text-[10px] opacity-40">KN</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-zinc-400 font-bold uppercase">Fuel Reserve</p>
                  <p className="font-mono text-lg font-medium text-zinc-900">{selectedShip.fuel.toFixed(0)} <span className="text-[10px] opacity-40">T</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] text-zinc-400 font-bold uppercase text-center tracking-widest">Risk Analysis</p>
                <div className={`p-3 rounded-lg text-[10px] font-bold text-center uppercase tracking-widest border ${
                  selectedShip.status === 'distressed' 
                    ? 'bg-red-50 text-red-600 border-red-100' 
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {selectedShip.status}
                </div>
              </div>

              {weather && (
                <div className="pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2">
                   <div className="text-center">
                     <p className="text-[8px] text-zinc-400 font-bold uppercase">Waves</p>
                     <p className="text-[10px] font-mono text-zinc-900">{weather.waveHeight}m</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[8px] text-zinc-400 font-bold uppercase">Wind</p>
                     <p className="text-[10px] font-mono text-zinc-900">{weather.windSpeed}m/s</p>
                   </div>
                   <div className="text-center">
                     <p className="text-[8px] text-zinc-400 font-bold uppercase">Vis</p>
                     <p className="text-[10px] font-mono text-zinc-900">{weather.visibility}km</p>
                   </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Intelligence Panel */}
      <div className="w-[380px] flex flex-col bg-white border-l border-zinc-200">
        <FleetSidebar 
          ships={ships} 
          selectedShip={selectedShip} 
          onSelectShip={(ship) => setSelectedShip(ship)}
          alerts={alerts}
        />
        
        {/* Role Specific Actions Area */}
        <div className="p-6 bg-zinc-50 border-t border-zinc-200 mt-auto">
          {role === 'captain' && activeShipId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                <Radio size={14} className="text-zinc-900" /> Distress Channel
              </div>
              <textarea 
                value={distressMsg}
                onChange={(e) => setDistressMsg(e.target.value)}
                placeholder="Declare emergency parameters..."
                className="w-full h-24 bg-white border border-zinc-200 rounded-xl p-4 text-xs focus:outline-none focus:border-zinc-900 transition-all font-mono placeholder:text-zinc-300"
                id="distress-input"
              />
              <button 
                onClick={sendDistress}
                disabled={isAnalyzing || !distressMsg}
                className="w-full py-4 bg-zinc-900 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                id="send-distress-btn"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    Triage In Progress
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} /> Declare Distress
                  </>
                )}
              </button>
            </div>
          )}

          {role === 'command' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                <MapIcon size={14} className="text-zinc-900" /> Strategic Directives
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">Issue precise waypoint adjustments or rerouting parameters to active fleet assets.</p>
              {selectedShip ? (
                 <button 
                  className="w-full py-4 bg-zinc-900 rounded-xl text-[10px] font-bold text-white uppercase tracking-widest hover:bg-black transition-all"
                  id="issue-directive-btn"
                 >
                   Deploy New Waypoint
                 </button>
              ) : (
                <div className="p-4 bg-zinc-100 rounded-xl border border-zinc-200 border-dashed text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Awaiting Selection</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
