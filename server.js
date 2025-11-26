const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

// Create Next without forcing a hostname so the host Render provides works correctly
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
  });
  // In-memory submissions store (simple for demo).
  const submissions = [];

  io.on('connection', (socket) => {
    console.log('Client connected');

    // Send existing submissions to the newly connected client
    socket.emit('initial-submissions', submissions);

    socket.on('input-change', (data) => {
      socket.broadcast.emit('update-dashboard', data);
    });

    socket.on('form-submit', (data) => {
      // Attach server-side metadata
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const submission = { ...data, id, submittedAt: new Date().toISOString(), reviewed: false };
      // store newest first
      submissions.unshift(submission);
      // Broadcast authoritative submission to all clients (including sender)
      io.emit('new-submission', submission);
    });

    socket.on('mark-reviewed', (id) => {
      const idx = submissions.findIndex((s) => s.id === id);
      if (idx !== -1) {
        submissions[idx].reviewed = !submissions[idx].reviewed;
        // Broadcast update to all clients
        io.emit('review-updated', { id: submissions[idx].id, reviewed: submissions[idx].reviewed });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  httpServer.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  // Bind to 0.0.0.0 to accept external connections on Render
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on port ${port} (listening on 0.0.0.0)`);
  });
});