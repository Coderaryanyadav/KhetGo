# 🌱 KhetGo Seed Data Guide

This guide explains how to populate your KhetGo database with realistic Indian agricultural data.

---

## 📋 What's Included

The seed data includes:

### 1. **Mandi Prices** (20 crops)
- Wheat, Rice (Basmati & Sona Masuri), Mustard, Gram
- Potato, Onion, Tomato, Cotton, Sugarcane
- Turmeric, Groundnut, Soybean, Maize, Jowar
- Bajra, Various Dals, Green Chilli
- Real market prices with trends (up/down) and percentage changes

### 2. **Agri Services** (10 equipment/services)
- Tractors with operators
- Implements (Rotavator, Cultivator, Seed Drill)
- Harvester, Sprayer, Thresher
- Water pumps, Land leveler
- Realistic pricing per day in INR

### 3. **Store Products** (14 products)
- **Seeds**: Hybrid Tomato, BT Cotton, Wheat
- **Fertilizers**: Urea, DAP, Potash, NPK
- **Pesticides**: Insecticides, Fungicides, Herbicides
- **Tools**: Sprayers, Sickles, Spades, pH meters
- Brand names, prices, descriptions

### 4. **Academy Content** (8 video tutorials)
- Drip Irrigation Guide
- Organic Composting
- Integrated Pest Management
- Soil Testing
- Crop Rotation, Mulching
- Greenhouse Farming
- Water Harvesting

### 5. **News Articles** ( 5 recent articles)
- MSP announcements
- Loan waiver schemes
- PM-KISAN updates
- Technology adoption
- Organic farming growth

---

## 🚀 How to Run

### Method 1: Supabase SQL Editor (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your KhetGo project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `seed-data.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Ctrl/Cmd + Enter)

**Expected Output**:
```
Seed data inserted successfully!
========================================
Mandi Prices: 20 crops
Agri Services: 10 equipment/services
Store Products: 14 products
Academy Content: 8 video tutorials
News Articles: 5 recent articles
========================================
```

### Method 2: Using Supabase CLI

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run the seed script
supabase db push --include-seeds

# Or directly execute the SQL file
psql -h db.your-project-ref.supabase.co -p 5432 -d postgres -U postgres -f seed-data.sql
```

---

## ✅ Verification

After running the seed script, verify the data:

### Check Mandi Prices
```sql
SELECT crop, price, trend FROM mandi_prices LIMIT 5;
```

### Check Agri Services
```sql
SELECT title, type, price_per_day FROM agri_services WHERE is_active = true;
```

### Check Store Products
```sql
SELECT name, category, price FROM store_products WHERE is_available = true LIMIT 5;
```

### Check Academy Content
```sql
SELECT title, category, views FROM academy_content;
```

### Check News
```sql
SELECT title, category, publish_date FROM news_articles ORDER BY publish_date DESC;
```

---

## 🔄 Re-running the Script

The seed script is **safe to run multiple times** because:
- Uses `ON CONFLICT DO NOTHING` for most inserts
- Uses `ON CONFLICT DO UPDATE` for mandi prices (to refresh daily prices)
- Won't create duplicates

---

## 📝 Notes

### User-Generated Content
Some tables are not seeded and will be populated by users:
- **`listings`** - Marketplace listings created by farmers
- **`forum_posts`** - Community discussions
- **`messages`** - Private conversations
- **`bookings`** - Equipment rentals
- **`ledger_entries`** - Financial records

### Customization
You can customize the seed data by:
1. Editing `seed-data.sql` with your own data
2. Adding more entries following the same format
3. Changing prices, locations, or descriptions

### Regional Data
Current data is focused on Maharashtra region. To add other states:
1. Copy and modify the agri services section
2. Update locations to your state/district
3. Adjust crop varieties to match regional preferences

---

## 🎯 Next Steps After Seeding

1. **Create user accounts** through the app signup
2. **Test marketplace** by creating sample listings
3. **Test services** by browsing equipment rentals
4. **Check mandi prices** on dashboard
5. **View academy content** for learning resources

---

## 🔧 Troubleshooting

### Error: "relation does not exist"
**Solution**: Run `SCHEMA.sql` first to create all tables

### Error: "duplicate key value violates unique constraint"
**Solution**: This is normal if re-running. The script handles duplicates gracefully.

### Error: "permission denied for table"
**Solution**: Ensure you're using the correct database credentials with full permissions

### No data showing in app
**Solution**:
1. Check Supabase logs for errors
2. Verify Row Level Security (RLS) policies allow reading
3. Check browser console for API errors
4. Ensure app is connected to correct Supabase project

---

## 📊 Data Statistics

- **Total Crops in Mandi**: 20
- **Total Equipment**: 10
- **Total Store Products**: 14
- **Total Video Tutorials**: 8
- **Total News Articles**: 5
- **Total Records**: 57+

---

## 🔒 Security Notes

- Seed data does NOT contain any real user information
- All data is publicly readable (as per app design)
- Marketplace listings require user authentication
- Private messages are protected by RLS policies

---

## 💡 Tips

1. **Regular Updates**: Update mandi prices weekly for realistic data
2. **Add More Products**: Expand store products as needed
3. **Fresh Content**: Add new academy videos regularly
4. **News Updates**: Keep news articles current
5. **Seasonal Data**: Adjust crop prices based on season

---

## 📚 Additional Resources

- [Supabase SQL Documentation](https://supabase.com/docs/guides/database)
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- [Indian Mandi Prices](https://agmarknet.gov.in/)
- [Agricultural Schemes](https://agricoop.nic.in/)

---

**Need help?** Check the main README.md or create an issue on GitHub.

**Built with ❤️ for Indian Farmers**
