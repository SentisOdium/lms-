# SBAMS — Student Browser Activity Monitoring System

The **Student Browser Activity Monitoring System (SBAMS)** is a standalone browser monitoring platform designed to help instructors observe students' browser activity during supervised classroom sessions.

## Architecture (Zero SQL Database)

- **Backend**: Node.js, Express, Socket.IO, atomic JSON configuration storage and append-only JSONL event streaming.
- **Student Interface**: Google Chrome Extension (Manifest V3) detecting tab switching, browser focus loss, and system inactivity.
- **Instructor Interface**: React + Vite single-page dashboard with real-time Socket.IO synchronization.

## Directory Structure

```
sbams/
├── backend/                # Express API + Socket.IO + JSON/JSONL Storage
│   ├── data/               # Persistent JSON and JSONL data files
│   │   ├── instructors.json
│   │   ├── sessions.json
│   │   ├── participants.json
│   │   └── activity/       # session_{sessionId}.jsonl
│   ├── exports/            # CSV reports
│   └── src/
├── extension/              # Chrome Extension (Manifest V3)
└── instructor-dashboard/   # React + Vite web dashboard
```

## Running the Application Locally

### 1. Backend Server
```bash
cd backend
npm install
npm run dev
# Running on http://localhost:5000 (Health check: http://localhost:5000/api/health)
```

Run storage concurrency test:
```bash
npm run test:storage
```

### 2. Instructor Dashboard
```bash
cd instructor-dashboard
npm install
npm run dev
# Running on http://localhost:5173
```

### 3. Student Chrome Extension
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right.
3. Click **Load unpacked** and select the `extension` folder.
4. Pin the SBAMS extension to your toolbar.

