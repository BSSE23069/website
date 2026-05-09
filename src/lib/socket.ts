import { io } from "socket.io-client";

// In browser environments like AI Studio, we should connect to the current origin
const URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'] // Ensure compatibility
});
