import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import * as turf from "@turf/turf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Load initial fleet data
  const fleetData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "src/fleet.json"), "utf-8")
  );

  let ships = [...fleetData.fleet];
  let restrictedZones: any[] = [];
  let alerts: any[] = [];
  let history: any[] = [];

  // Middleware
  app.use(express.json());

  // API Routes
  app.get("/api/fleet", (req, res) => {
    res.json({ ships, restrictedZones });
  });

  app.post("/api/zones", (req, res) => {
    const { zone } = req.body;
    restrictedZones.push({ ...zone, id: Date.now().toString() });
    io.emit("zones:update", restrictedZones);
    res.status(201).json(zone);
  });

  app.delete("/api/zones/:id", (req, res) => {
    restrictedZones = restrictedZones.filter((z) => z.id !== req.params.id);
    io.emit("zones:update", restrictedZones);
    res.status(204).send();
  });

  // Simulation Loop (1Hz)
  setInterval(() => {
    const now = Date.now();
    const tickDuration = 1 / 3600; // 1 second in hours

    ships = ships.map((ship) => {
      if (ship.status === "stopped" || ship.status === "arrived" || ship.fuel <= 0) {
        if (ship.fuel <= 0) ship.status = "out of fuel";
        return ship;
      }

      // Find destination coordinates
      const port = fleetData.ports.find((p: any) => p.id === ship.destination);
      if (!port) return ship;

      // Calculate bearing to destination
      const point1 = turf.point([ship.position[1], ship.position[0]]);
      const point2 = turf.point([port.position[1], port.position[0]]);
      let targetHeading = turf.bearing(point1, point2);
      if (targetHeading < 0) targetHeading += 360;

      // Update current heading towards target heading (smoothly)
      let headingDiff = targetHeading - ship.heading;
      if (headingDiff > 180) headingDiff -= 360;
      if (headingDiff < -180) headingDiff += 360;
      const turnRate = 5; // degrees per tick
      const newHeading = (ship.heading + Math.sign(headingDiff) * Math.min(Math.abs(headingDiff), turnRate) + 360) % 360;

      // Advance position
      const latSpeed = (ship.speed * Math.cos((newHeading * Math.PI) / 180)) / 60;
      const lngSpeed = (ship.speed * Math.sin((newHeading * Math.PI) / 180)) / 60;

      const newLat = ship.position[0] + (latSpeed * tickDuration);
      const newLng = ship.position[1] + (lngSpeed * tickDuration);

      // Check for arrival (within 1km)
      const distToDest = turf.distance(turf.point([newLng, newLat]), point2, { units: "kilometers" });
      const status = distToDest < 1.0 ? "arrived" : "normal";

      // Fuel consumption logic (same as before)
      const isInBadWeather = Math.random() > 0.98;
      let fuelBurn = (ship.speed * 0.1 * (1/3600)) * (isInBadWeather ? 1.3 : 1.0);
      const newFuel = Math.max(0, ship.fuel - fuelBurn);

      // Geofence check
      let currentStatus = status;
      const shipPoint = turf.point([newLng, newLat]);
      restrictedZones.forEach(zone => {
        if (zone.coordinates && zone.coordinates.length >= 3) {
          const polygon = turf.polygon([zone.coordinates]);
          if (turf.booleanPointInPolygon(shipPoint, polygon)) {
            currentStatus = "warning";
            const alertId = `${ship.shipId}-zone-${zone.id}`;
            if (!alerts.find(a => a.id === alertId)) {
                const newAlert = {
                    id: alertId,
                    type: "geofence",
                    shipName: ship.name,
                    shipId: ship.shipId,
                    timestamp: now,
                    message: `Ship ${ship.name} entered restricted zone ${zone.name || zone.id}`
                };
                alerts.push(newAlert);
                io.emit("alert:new", newAlert);
                if (supabase) {
                    supabase.from('alerts').insert([{
                        type: newAlert.type,
                        ship_id: newAlert.shipId,
                        message: newAlert.message,
                        severity: 'warning',
                        created_at: new Date(newAlert.timestamp).toISOString()
                    }]).then(() => {});
                }
            }
          }
        }
      });

      return {
        ...ship,
        position: [newLat, newLng],
        heading: newHeading,
        fuel: newFuel,
        status: currentStatus === "warning" ? "distressed" : currentStatus
      };
    });

    // Proximity Warnings
    for (let i = 0; i < ships.length; i++) {
        for (let j = i + 1; j < ships.length; j++) {
            const s1 = ships[i];
            const s2 = ships[j];
            const dist = turf.distance(
                turf.point([s1.position[1], s1.position[0]]),
                turf.point([s2.position[1], s2.position[0]]),
                { units: "kilometers" }
            );

            if (dist < 2.0) {
                const alertId = `prox-${s1.shipId}-${s2.shipId}`;
                if (!alerts.find(a => a.id === alertId)) {
                    const newAlert = {
                        id: alertId,
                        type: "proximity",
                        ships: [s1.name, s2.name],
                        timestamp: now,
                        message: `Proximity Alert: ${s1.name} and ${s2.name} are ${dist.toFixed(2)}km apart`
                    };
                    alerts.push(newAlert);
                    io.emit("alert:new", newAlert);
                    if (supabase) {
                        supabase.from('alerts').insert([{
                            type: newAlert.type,
                            ship_id: s1.shipId, // using shipId_a logic
                            ship_id_b: s2.shipId,
                            message: newAlert.message,
                            severity: 'medium',
                            created_at: new Date(newAlert.timestamp).toISOString()
                        }]).then(() => {});
                    }
                }
            }
        }
    }

    // Capture history (every 30s as per spec, but we tick every 1s)
    if (now % 30000 < 1000) {
        const snapshot = { timestamp: now, ships: JSON.parse(JSON.stringify(ships)) };
        history.push(snapshot);
        if (history.length > 120) history.shift(); // Keep ~1 hour of 30s snapshots
        
        if (supabase) {
            supabase.from('ship_snapshots').insert([{
                snapshot,
                recorded_at: new Date(now).toISOString()
            }]).then(() => {});
        }
    }

    // Sync ships to Supabase (batch update)
    if (supabase) {
      const upsertData = ships.map(s => ({
        ship_id: s.shipId,
        name: s.name,
        lat: s.position[0],
        lng: s.position[1],
        speed: s.speed,
        heading: s.heading,
        destination: s.destination,
        fuel: s.fuel,
        cargo: s.cargo,
        status: s.status,
        updated_at: new Date().toISOString()
      }));
      
      supabase.from('ships').upsert(upsertData).then(({ error }) => {
        if (error) console.error("Supabase Ships Sync Error:", error);
      });
    }

    io.emit("fleet:update", { ships, timestamp: now });
  }, 1000);

  // WebSocket connection
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.emit("init", { ships, restrictedZones, alerts });

    socket.on("directive:send", (data) => {
        // Command issues directive
        io.emit("directive:received", data);
    });

    socket.on("directive:respond", (data) => {
        // Captain responds
        const { shipId, response, message } = data;
        const ship = ships.find(s => s.shipId === shipId);
        if (ship && response === "ACCEPT") {
            // Update ship target/heading if needed (simple implementation for now)
        }
        io.emit("directive:finalized", data);
    });

    socket.on("distress:send", (data) => {
        io.emit("distress:received", data);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
