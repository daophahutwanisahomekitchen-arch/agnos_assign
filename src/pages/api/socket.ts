import { Server } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';

type NextSocketWithServer = { server: { io?: Server; [k: string]: unknown } };

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  const server = (res.socket as unknown as NextSocketWithServer).server;
  if (server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    // `server` is the Next.js socket server (an http.Server). Cast to any here
    // because Next's `res.socket.server` has custom properties in runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = new Server(server as any, {
      path: '/api/socket',
      addTrailingSlash: false,
    });
    server.io = io;

    io.on('connection', (socket) => {
      console.log('New client connected');

      socket.on('input-change', (data) => {
        socket.broadcast.emit('update-dashboard', data);
      });

      socket.on('form-submit', (data) => {
        socket.broadcast.emit('new-submission', data);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  }
  res.end();
};

export default SocketHandler;
