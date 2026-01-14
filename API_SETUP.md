# 🚀 KhetGo - Free API Setup Guide

This guide will help you get **100% free API keys** for all the real features.

---

## 1. 🤖 AI Agri-Advisor (Google Gemini) - FREE

**Signup**: [Google AI Studio](https://makersuite.google.com/app/apikey)

1. Click "Get API Key"
2. Create new API key
3. Copy the key
4. Add to `.env`:
   ```bash
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

**Free Tier**: 60 requests per minute (more than enough!)

---

## 2. 🌦️ Weather API (OpenWeatherMap) - FREE

**Signup**: [OpenWeatherMap](https://openweathermap.org/api)

1. Create free account
2. Go to API Keys section
3. Copy your default API key
4. Add to `.env`:
   ```bash
   VITE_OPENWEATHER_API_KEY=your_openweather_key_here
   ```

**Optional**: Set your default city (for users who block location):
```bash
VITE_DEFAULT_CITY=Nagpur
VITE_DEFAULT_LAT=21.1458
VITE_DEFAULT_LNG=79.0882
```

**Free Tier**: 1,000 calls per day

---

## 3. 📊 Analytics (Google Analytics 4) - FREE

**Setup**: [Google Analytics](https://analytics.google.com/)
s
1. Create new GA4 property
2. Get your Measurement ID (starts with `G-`)
3. Add to `.env`:
   ```bash
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

**Free Tier**: Unlimited (completely free forever!)

---

## 4. Alternative: HuggingFace AI (Free Forever)

If you prefer an alternative to Google Gemini:

**Signup**: [HuggingFace](https://huggingface.co/settings/tokens)

1. Create account
2. Generate new token
3. Add to `.env`:
   ```bash
   VITE_HUGGINGFACE_API_KEY=your_huggingface_token
   ```

**Free Tier**: Unlimited inference API calls!

---

## 📝 Final `.env` File Example

```bash
# Supabase (Required)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# AI (Choose one - both are free!)
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXX
# OR
VITE_HUGGINGFACE_API_KEY=hf_XXXXXXXXXXXXXXXXX

# Weather
VITE_OPENWEATHER_API_KEY=your_openweather_key

# Analytics (optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Default location (optional)
VITE_DEFAULT_CITY=Nagpur
VITE_DEFAULT_LAT=21.1458
VITE_DEFAULT_LNG=79.0882
```

---

## ✅ After Adding Keys

1. **Local**: Restart your dev server (`npm run dev`)
2. **Vercel**: 
   - Go to your project settings
   - Add all `VITE_*` variables
   - Redeploy

---

**That's it!** All features are now 100% real and powered by free APIs! 🚀
