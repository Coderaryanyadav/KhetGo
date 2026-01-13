# 🚀 KhetGo Deployment Guide (Vercel + Supabase)

Follow these steps to deploy your professional copy of KhetGo to the cloud.

---

## 1. Supabase Backend Setup (Essential)

Before deploying the frontend, your database must be configured correctly.

### **A. SQL Schema**
1.  Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Open your project and click on **SQL Editor** in the left sidebar.
3.  Click **"New Query"**.
4.  Copy the entire content of the `SCHEMA.sql` file from this repository and paste it into the editor.
5.  Click **Run**.

### **B. Storage (For Image Uploads)**
1.  Click on **Storage** in the left sidebar.
2.  Click **"New Bucket"**.
3.  Name it exactly: `listings`.
4.  Switch the **"Public"** toggle to **ON**.
5.  Click **Create**.

---

## 2. Vercel Frontend Deployment

### **A. Connect GitHub**
1.  Push your latest code to your GitHub repository.
2.  Log in to [Vercel](https://vercel.com).
3.  Click **"Add New"** > **"Project"**.
4.  Import your `KhetGo` repository.

### **B. Environment Variables**
During the import process, expand the **"Environment Variables"** section and add these two:

| Key | Value |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Your Project URL (found in Supabase Settings > API) |
| `VITE_SUPABASE_ANON_KEY` | Your `anon` key (found in Supabase Settings > API) |

### **C. Build & Deploy**
1.  Click **Deploy**.
2.  Vercel will automatically detect Vite and use `npm run build`.
3.  Once finished, you will receive a production URL (e.g., `khetgo.vercel.app`).

---

## 3. Post-Deployment Checks

1.  **Auth**: Try signing up with a new email to ensure Supabase Auth is linked.
2.  **Images**: Try creating a new listing and uploading a photo to verify the Storage bucket is working.
3.  **Khata**: Ensure you can record an entry and download the PDF.
4.  **Notifications**: Allow browser notifications when prompted to see real-time alerts.

---

## 🛠️ Troubleshooting

- **404 on Refresh?**: I have already included a `vercel.json` file in the root directory that handles Single Page Application (SPA) routing. This should prevent 404 errors.
- **Images not showing?**: Ensure the `listings` bucket in Supabase is set to "Public".
- **Database errors?**: Double-check that all tables were created in the SQL Editor.

---

**Congratulations! Your KhetGo platform is now live and serving the community.** 🌾🚀
