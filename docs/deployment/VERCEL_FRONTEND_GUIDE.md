# CareerConnect — Vercel Frontend Deployment Guide

This guide details deploying the CareerConnect React 19, Vite, and Tailwind CSS Single-Page Application (SPA) to [Vercel](https://vercel.com).

---

## Architecture Overview

The CareerConnect frontend is an optimized SPA built with Vite. It communicates with the backend REST API and establishes WebSocket connections using Socket.IO client.
The repository includes a production-ready `client/vercel.json` file configuring:
- Catch-all URL rewrites (`/(.*) -> /index.html`) to support client-side deep routing without HTTP 404 errors.
- Strict security response headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- Immutable caching policies for compiled JavaScript and CSS bundles.

---

## Deployment Steps

### 1. Import Repository into Vercel

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your Git repository containing CareerConnect.

### 2. Configure Project Settings

On the **Configure Project** setup screen:

- **Project Name**: `careerconnect-ui` (or your choice)
- **Framework Preset**: `Vite` (automatically detected)
- **Root Directory**: Click **Edit** and select `client`
- **Build and Output Settings**:
  - Build Command: `npm run build` (or override with `vite build`)
  - Output Directory: `dist`
  - Install Command: `npm install`

### 3. Configure Environment Variables

Under **Environment Variables**, define the backend API connection URL:

| Key | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://careerconnect-backend.onrender.com/api` | Full URL to backend REST API |

> [!NOTE]
> If using custom domains or Docker reverse proxies, point `VITE_API_URL` to your domain or omit to use same-origin relative `/api` paths.

### 4. Deploy

1. Click **Deploy**.
2. Vercel will install dependencies, execute `vite build`, and publish the assets to the global edge CDN.
3. Once complete, your site will be live at `https://careerconnect-ui.vercel.app`.

---

## Post-Deployment Verification

1. Test SPA navigation by opening deep URLs directly in the address bar (e.g., `/jobs`, `/login`, `/dashboard`).
2. Verify browser console has no CORS errors when authenticating.
3. Verify Socket.IO connects to the backend and the real-time indicator is green in the navigation bar.

