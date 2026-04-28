import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server as SocketIoServer } from 'socket.io';
import { GameManager } from './game/GameManager';
import { buildApiRouter } from './routes/api.routes';
import { registerHostHandlers } from './socket/hostHandlers';
import { registerPlayerHandlers } from './socket/playerHandlers';

const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

const manager = new GameManager();
manager.startCleanup();

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/session', apiLimiter);

app.use(buildApiRouter(manager));

const httpServer = http.createServer(app);

const io = new SocketIoServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerHostHandlers(io, socket, manager);
  registerPlayerHandlers(io, socket, manager);
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
