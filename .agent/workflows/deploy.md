---
description: Deploy the KhetGo application to Vercel
---
// turbo-all
# Deployment Workflow

Follow these steps to deploy KhetGo to production.

1. **Verify build success**:
```bash
npm run build
```

2. **Supabase Setup**:
   - Log in to your Superbase project.
   - Run the contents of `SCHEMA.sql` in the SQL Editor.
   - Run the contents of `seed-data.sql` to populate initial data.
   - Create a public bucket in Storage named `listings`.

3. **Vercel Deployment**:
   - Install Vercel CLI if not already present:
     ```bash
     npm install -g vercel
     ```
   - Deploy:
     ```bash
     vercel --prod
     ```
   - Ensure you add the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, etc.) in the Vercel dashboard.

4. **Verify Deployment**:
   - Visit the production URL.
   - Check if you can log in and see the marketplace.
