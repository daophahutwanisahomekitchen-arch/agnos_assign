# Agnos Healthcare Portal

A modern, real-time patient intake and staff dashboard application built with Next.js, Tailwind CSS, and Socket.io.

## Features

- **Patient Portal**: Responsive intake form with real-time validation.
- **Staff Dashboard**: Live monitoring of patient inputs and submissions.
- **Real-time Sync**: Instant updates using Socket.io.
- **Modern UI**: Clean, professional healthcare aesthetic with Glassmorphism design.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This app uses a custom Node server (Socket.io) and requires a host that supports long-running Node processes and WebSocket connections. Railway is a simple, free-friendly choice for this.

Why not Vercel?
Vercel's serverless functions are not ideal for persistent WebSocket servers. Use Railway, Render, Heroku, or another provider that supports long-lived Node processes.

How to deploy on Railway (recommended)

1. Push your code to a Git provider (GitHub/GitLab).
2. Sign in to [Railway](https://railway.app) and create a new Project.
3. Click **Deploy from GitHub** (or connect your repo) and select the repository.
4. Railway will prompt for build/start commands — use:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
5. Railway provides an environment variable `PORT` automatically; the app uses `process.env.PORT` in `server.js`, so no extra config is required.


Quick local test (simulate production):

```bash
npm install
npm run build
npm start
```


## Development Planning Documentation

For a detailed breakdown of the project structure, design decisions, component architecture, and real-time synchronization flow, please refer to the [PLANNING.md](./PLANNING.md) file.

### Project Structure Overview

The project follows a standard Next.js App Router structure:

- `src/app/`: Contains the main application routes and global styles.
- `src/components/`: Reusable UI components (`PatientForm`, `StaffDashboard`).
- `src/lib/`: Utility functions and configurations (`socket.ts`).
- `src/pages/api/socket.ts`: The custom Socket.io server handler.

- **PatientForm**: Manages local state for form inputs. Emits `input-change` events via Socket.io on every keystroke to ensure real-time synchronization. Handles final submission via `form-submit` event.
- **StaffDashboard**: Listens for `update-dashboard` events to update the live view and `new-submission` events to add to the history log. Manages connection state and "typing" indicators based on data frequency.

### Real-Time Synchronization Flow

1. **Connection**: Both Client (Patient) and Staff connect to the Socket.io server hosted at `/api/socket`.
2. **Input**: When a patient types in `PatientForm`, the data is sent to the server via the `input-change` event.
3. **Broadcast**: The server broadcasts this data to all connected clients (specifically targeting the staff view) via the `update-dashboard` event.
4. **Display**: `StaffDashboard` receives the data and updates the `currentPatient` state, triggering a re-render of the live monitor.
5. **Submission**: Upon form submission, the data is sent via `form-submit`, which the server broadcasts as `new-submission`, moving the data from the live view to the submission history list.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Real-time**: Socket.io
- **Language**: TypeScript

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
