# CareerConnect — MongoDB Atlas Deployment & Configuration Guide

This guide details the step-by-step procedure to provision and configure a high-availability MongoDB Atlas cloud database cluster for CareerConnect.

---

## 1. Create a MongoDB Atlas Account & Cluster

1. Navigate to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in or create an account.
2. Click **Create** to deploy a new database cluster.
3. Select the **Shared (M0 Free Tier)** or a dedicated tier according to production scale.
4. Select your preferred Cloud Provider (AWS, Google Cloud, or Azure) and the region closest to your server deployment (e.g., `us-east-1` or `eu-west-1`).
5. Set Cluster Name to `CareerConnect-Cluster` and click **Create Deployment**.

---

## 2. Configure Database Authentication

1. Under **Security** in the left sidebar, click **Database Access**.
2. Click **Add New Database User**.
3. Authentication Method: **Password**.
4. Set Username: `careerconnect_admin`.
5. Set a strong password (e.g. use Atlas's Autogenerate Secure Password). Securely record this password.
6. Database User Privileges: Select **Read and write to any database** (or assign specific `readWrite` access to `careerconnect_db`).
7. Click **Add User**.

---

## 3. Configure Network Access (IP Whitelist)

1. Under **Security** in the left sidebar, click **Network Access**.
2. Click **Add IP Address**.
3. For cloud server environments with dynamic outbound IP addresses (such as Render or AWS Elastic Beanstalk):
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - Add description: `Render Backend Production Access`.
   - Click **Confirm**.
4. *(Optional / Recommended for Enterprise)*: If hosting on dedicated cloud nodes or VPCs, enter the specific static outbound Elastic IPs of your hosting provider.

---

## 4. Retrieve Connection String

1. Navigate to the **Database Deployments** screen.
2. Click **Connect** on `CareerConnect-Cluster`.
3. Choose **Drivers** (Node.js).
4. Select Driver: `Node.js`, Version: `6.0 or later`.
5. Copy the standard connection string format:
   ```text
   mongodb+srv://careerconnect_admin:<password>@careerconnect-cluster.xxxx.mongodb.net/careerconnect_db?retryWrites=true&w=majority&appName=CareerConnect
   ```
6. Replace `<password>` with your database user password.
7. Ensure the database name in the path is `careerconnect_db`.

---

## 5. Environment Variable Configuration

Assign this connection string to the `MONGODB_URI` environment variable in your production host (e.g., Render, Docker, or AWS):

```env
MONGODB_URI=mongodb+srv://careerconnect_admin:<your_password>@careerconnect-cluster.xxxx.mongodb.net/careerconnect_db?retryWrites=true&w=majority&appName=CareerConnect
```

---

## 6. Remote Database Seeding

Once connected, initialize the database with baseline taxonomy, sample companies, admin accounts, and jobs:

```bash
# From local development or CI build with cloud MONGODB_URI set:
MONGODB_URI="mongodb+srv://careerconnect_admin:<your_password>@careerconnect-cluster.xxxx.mongodb.net/careerconnect_db?retryWrites=true&w=majority" npm --prefix server run seed
```

