/* eslint-disable @typescript-eslint/no-require-imports */
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
  // In-memory sessions store for live drafts keyed by sessionId
  const sessions = {}; // { [sessionId]: { draft: {}, lastUpdated: ISOString } }

  io.on('connection', (socket) => {
    console.log('Client connected');

    // Send existing submissions to the newly connected client
    socket.emit('initial-submissions', submissions);

    // If a staff client wants to know active drafts, emit current sessions
    socket.emit('active-sessions', Object.keys(sessions).map((id) => ({ sessionId: id, draft: sessions[id].draft })));

    // Patients should send { sessionId, data }
    socket.on('input-change', (payload) => {
      try {
        const { sessionId, data } = payload || {};
        if (sessionId) {
          sessions[sessionId] = sessions[sessionId] || { draft: null, lastUpdated: null };
          sessions[sessionId].draft = data;
          sessions[sessionId].lastUpdated = new Date().toISOString();
          // Broadcast update to staff/clients so they can show per-session drafts
          io.emit('update-dashboard', { sessionId, data });
        } else {
          // fallback to old behavior when no sessionId provided
          socket.broadcast.emit('update-dashboard', payload);
        }
      } catch (err) {
        console.error('Error processing input-change', err);
      }
    });

    socket.on('patient-session', ({ sessionId }) => {
      if (!sessionId) return;
      try {
        socket.join(`session:${sessionId}`);
        // ensure session exists
        sessions[sessionId] = sessions[sessionId] || { draft: null, lastUpdated: null };
        // Notify this socket of current draft (if any)
        if (sessions[sessionId].draft) {
          socket.emit('update-dashboard', { sessionId, data: sessions[sessionId].draft });
        }
      } catch (err) {
        console.error('Error joining patient-session', err);
      }
    });

    socket.on('leave-session', ({ sessionId }) => {
      if (!sessionId) return;
      try { socket.leave(`session:${sessionId}`); } catch { /* ignore */ }
    });

    // Expect { sessionId, data }
    socket.on('form-submit', (payload) => {
      try {
        const { sessionId, data } = payload || {};
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const submission = { ...(data || payload), id, sessionId: sessionId || null, submittedAt: new Date().toISOString(), reviewed: false };
        // store newest first
        submissions.unshift(submission);
        // remove session draft after successful submit
        if (sessionId && sessions[sessionId]) delete sessions[sessionId];
        // Broadcast authoritative submission to all clients (including sender)
        io.emit('new-submission', submission);
      } catch (err) {
        console.error('Error processing form-submit', err);
      }
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