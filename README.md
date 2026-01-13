# 🌾 KhetGo: The Digital Pulse of Indian Farming

**KhetGo** is a comprehensive, all-in-one digital agricultural ecosystem designed to empower farmers and bridge the gap between rural production and urban demand. Built with a focus on stability, premium UI/UX, and regional accessibility.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FCoderaryanyadav%2FKhetGo)

---

## ✨ Key Features

### 🛒 **Smart Marketplace**
- **Direct Trading**: Connect directly with buyers without middlemen.
- **GPS-Based Discovery**: Find the nearest crops and produce with real-time distance calculation.
- **Verified Farmers**: Built-in verification badges for trust and quality assurance.

### 🧠 **AI Agri-Advisor**
- **Instant Diagnosis**: Describe crop symptoms in natural language and receive automated expert guidance.
- **Disease Management**: Get instant solutions for pests and nutrient deficiencies.

### 📒 **Farmer's Digital Khata**
- **Financial Tracking**: A full digital ledger to record income and expenses.
- **Profit Analytics**: Automatic calculation of net profit and loss.
- **PDF Export**: Generate professional financial statements for bank loans or personal records.

### 🎓 **KhetGo Academy**
- **Video Tutorials**: Learn modern farming techniques like drip irrigation and organic composting through high-quality video content.

### 🌐 **Multilingual (i18n)**
- Fully translated interface supporting **English**, **हिन्दी (Hindi)**, and **मराठी (Marathi)**.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Vite, Chart.js
- **Backend/Database**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Modern CSS with Glassmorphism & Responsive Design
- **Financial Reports**: jsPDF & AutoTable
- **Deployment**: Vercel ready with custom routing

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- A [Supabase](https://supabase.com/) Account

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/Coderaryanyadav/KhetGo.git

# Install dependencies
npm install

# Set up environment variables (.env)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialisation
Copy the contents of `SCHEMA.sql` and run it in your **Supabase SQL Editor**.

### 4. Storage Setup
Create a **Public Bucket** named `listings` in your Supabase Storage dashboard to enable image uploads.

---

## 📸 Screenshots

*(Images generated via AI for promotional use)*

![Hero Image](./khetgo_hero_promo.png)
![Dashboard Mockup](./khetgo_dashboard_mockup.png)

---

## 🛡️ Security
KhetGo implements **Row Level Security (RLS)** in Supabase to ensure that user data, private messages, and financial records are only accessible to authorized individuals.

---

## 📄 License
This project is licensed under the MIT License.

---

**Built with ❤️ for the Indian Farmer.**
Developed by [Aryan Yadav](https://github.com/Coderaryanyadav)
