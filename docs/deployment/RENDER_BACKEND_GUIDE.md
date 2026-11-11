# CareerConnect — Render Backend Deployment Guide

This guide describes deploying the CareerConnect Node.js, Express, and Socket.IO real-time backend service to [Render](https://render.com).

---

## Architecture Overview

CareerConnect's backend is a stateless REST API with stateful WebSocket (Socket.IO) support, requiring:
1. Node.js 22 runtime.
2. Inbound HTTP and WebSocket connections.
3. Persistent disk storage for candidate resume uploads (`/app/uploads`).
4. MongoDB Atlas cloud connection.
5. CORS integration with the production frontend (e.g. Vercel).

---

## Method 1: Automated Blueprint Deployment (Recommended)

CareerConnect includes a root `render.yaml` Blueprint file for automatic infrastructure setup.

1. Push your repository to your private GitHub or GitLab account.
2. Log into the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Blueprint**.
4. Connect your CareerConnect repository.
5. Render reads `render.yaml` and displays the configured services:
   - `careerconnect-backend` (Node Web Service)
   - `careerconnect-frontend` (Static Site)
6. Supply the required environment values:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `CLIENT_URL`: Your frontend domain (e.g., `https://careerconnect.vercel.app`).
7. Click **Apply**. Render will automatically provision the disk, build the service, and deploy the application.

---

## Method 2: Manual Web Service Deployment

If configuring manually via the Render UI:

1. Click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configure service parameters:
   - **Name**: `careerconnect-backend`
   - **Region**: Oregon (or closest to your MongoDB Atlas region)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Starter (supports persistent disks and continuous WebSocket connections)

4. Configure **Disks** (for file uploads):
   - Click **Add Disk**.
   - **Name**: `uploads-data`
   - **Mount Path**: `/app/uploads`
   - **Size**: 1 GB

5. Configure **Health Check**:
   - **Health Check Path**: `/api/health`

6. Set Environment Variables under the **Environment** tab:
   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations & error handling |
   | `PORT` | `5000` | Port listening for HTTP/WebSocket traffic |
   | `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas cluster connection string |
   | `JWT_SECRET` | *(64-char random string)* | Cryptographic key for signing JWT tokens |
   | `JWT_EXPIRE` | `7d` | Lifetime of authentication tokens |
   | `CLIENT_URL` | `https://your-frontend.vercel.app` | Allowed CORS origin for frontend |
   | `UPLOAD_PATH` | `uploads` | Relative storage directory inside mount |
   | `MAX_FILE_SIZE` | `5242880` | Maximum file upload size (5 MB) |

7. Click **Create Web Service**.

---

## Verifying Deployment

Once the build logs output `CareerConnect Server is running on port 5000`:
- Test Health Check:
  ```bash
  curl -s https://careerconnect-backend.onrender.com/api/health
  # Expected: {"status":"healthy","application":"CareerConnect API","version":"1.0.0"}
  ```
- Test Swagger Documentation:
  Open `https://careerconnect-backend.onrender.com/api/docs` in your browser.

