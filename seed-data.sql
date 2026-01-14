-- =====================================================
-- KhetGo Seed Data Script (Fixed for SCHEMA.sql)
-- Populates database with realistic Indian agricultural data
-- =====================================================

-- Note: Run this AFTER running SCHEMA.sql
-- This script is safe to run multiple times (uses INSERT ... ON CONFLICT)

-- =====================================================
-- 1. MANDI PRICES (Real Indian Market Prices)
-- =====================================================

INSERT INTO mandi_prices (crop, price, unit, change_pct, trend) VALUES
  ('Wheat', 2450, 'Quintal', '+2.1%', 'up'),
  ('Rice (Basmati)', 4200, 'Quintal', '+2.9%', 'up'),
  ('Rice (Sona Masuri)', 3800, 'Quintal', '-2.1%', 'down'),
  ('Mustard', 5600, 'Quintal', '-2.6%', 'down'),
  ('Gram (Chana)', 5200, 'Quintal', '+1.5%', 'up'),
  ('Potato', 1200, 'Quintal', '+3.4%', 'up'),
  ('Onion', 1800, 'Quintal', '-10%', 'down'),
  ('Tomato', 2200, 'Quintal', '+15.8%', 'up'),
  ('Cotton', 6500, 'Quintal', '+1.6%', 'up'),
  ('Sugarcane', 350, 'Quintal', '+2.9%', 'up'),
  ('Turmeric', 8200, 'Quintal', '-3.5%', 'down'),
  ('Groundnut', 6800, 'Quintal', '+2.7%', 'up'),
  ('Soybean', 4500, 'Quintal', '+2%', 'up'),
  ('Maize', 1900, 'Quintal', '-3.1%', 'down'),
  ('Jowar', 3200, 'Quintal', '+1.6%', 'up'),
  ('Bajra', 2400, 'Quintal', '-1.2%', 'down'),
  ('Tur Dal', 7500, 'Quintal', '+2.7%', 'up'),
  ('Moong Dal', 8500, 'Quintal', '+1.8%', 'up'),
  ('Urad Dal', 6800, 'Quintal', '-1.7%', 'down'),
  ('Green Chilli', 3500, 'Quintal', '+16.7%', 'up')
ON CONFLICT (crop) DO UPDATE SET
  price = EXCLUDED.price,
  change_pct = EXCLUDED.change_pct,
  trend = EXCLUDED.trend,
  updated_at = NOW();

-- =====================================================
-- 2. AGRI SERVICES (Equipment Rental)
-- =====================================================

INSERT INTO agri_services (title, type, price_per_day, location, image_url) VALUES
  ('Tractor (50 HP) with Operator', 'Heavy Equipment', 2500, 'Nagpur, Maharashtra', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400'),
  ('Rotavator 7 Feet', 'Implements', 1200, 'Amravati, Maharashtra', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400'),
  ('Harvester Combine', 'Heavy Equipment', 8000, 'Wardha, Maharashtra', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400'),
  ('Seed Drill Machine', 'Implements', 800, 'Yavatmal, Maharashtra', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400'),
  ('Water Pump (Diesel)', 'Irrigation', 600, 'Chandrapur, Maharashtra', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400'),
  ('Sprayer (Power)', 'Crop Protection', 400, 'Nagpur, Maharashtra', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400'),
  ('Cultivator (9 Tyne)', 'Implements', 500, 'Bhandara, Maharashtra', 'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&q=80&w=400'),
  ('Laser Land Leveler', 'Land Preparation', 3500, 'Akola, Maharashtra', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400'),
  ('Post Hole Digger', 'Tools', 300, 'Gondia, Maharashtra', 'https://images.unsplash.com/photo-1416339442236-8ceb164046f8?auto=format&fit=crop&q=80&w=400'),
  ('Paddy Thresher', 'Processing', 1500, 'Gadchiroli, Maharashtra', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400')
ON CONFLICT (title) DO NOTHING;

-- =====================================================
-- 3. AGRI STORE PRODUCTS
-- =====================================================

INSERT INTO store_products (name, brand, price, unit, category, image_url, description) VALUES
  ('Hybrid Tomato Seeds (Abhilash)', 'Nunhems', 450, '10g packet', 'Seeds', 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&q=80&w=400', 'High yielding hybrid tomato variety. Resistant to leaf curl virus. Avg yield: 60-70 tons/acre'),
  ('BT Cotton Seeds (Mallika)', 'Kaveri', 850, '450g packet', 'Seeds', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=400', 'Bollworm resistant BT cotton. Suitable for black soil. Duration: 150-160 days'),
  ('Wheat Seeds (HD-2967)', 'IARI', 40, 'Kg', 'Seeds', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=400', 'High yielding wheat variety. Avg yield: 50-55 quintals/acre. Suitable for irrigated areas'),
  ('Urea (46% N)', 'IFFCO', 268, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400', 'High nitrogen fertilizer. Apply during vegetative growth stage. Dosage: 2-3 bags/acre'),
  ('DAP (Di-Ammonium Phosphate)', 'IFFCO', 1350, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', '18-46-0 formula. Apply as basal dose. Promotes root development'),
  ('Potash (MOP)', 'National', 890, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&q=80&w=400', 'Muriate of Potash (60% K2O). Improves fruit quality and disease resistance'),
  ('NPK 19:19:19', 'Tata Rallis', 1100, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1416339442236-8ceb164046f8?auto=format&fit=crop&q=80&w=400', 'Complete balanced fertilizer. Water-soluble. Suitable for all crops'),
  ('Confidor (Imidacloprid)', 'Bayer', 320, '100ml bottle', 'Pesticides', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400', 'Systemic insecticide. Controls aphids, jassids, whiteflies. Dosage: 60ml/acre'),
  ('Bavistin (Carbendazim)', 'BASF', 280, '250g pack', 'Fungicides', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400', 'Broad-spectrum fungicide. Controls leaf spot, powdery mildew. Dosage: 200g/acre'),
  ('Roundup (Glyphosate)', 'Monsanto', 425, '500ml bottle', 'Herbicides', 'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&q=80&w=400', 'Post-emergence herbicide. Controls all types of weeds. Apply before sowing'),
  ('Sprayer Pump (Manual)', 'Neptune', 850, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400', '16L capacity backpack sprayer. Brass nozzle. Comfortable shoulder straps'),
  ('Sickle (Harvesting)', 'Standard', 120, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400', 'Sharp steel blade. Wooden handle. Perfect for wheat and rice harvesting'),
  ('Spade (Heavy Duty)', 'Bellota', 380, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?auto=format&fit=crop&q=80&w=400', 'Forged steel blade. Hardwood handle. Lifetime warranty'),
  ('Digital Soil pH Meter', 'Lutron', 2400, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80&w=400', 'Measures pH, moisture, and temperature. Battery operated. LCD display')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 4. ACADEMY CONTENT (Educational Resources)
-- =====================================================

INSERT INTO academy_content (title, category, description, video_url, thumbnail_url) VALUES
  ('Drip Irrigation Installation Guide', 'Irrigation', 'Complete step-by-step guide for installing drip irrigation system. Learn about spacing, emitter selection, and maintenance.', 'https://www.youtube.com/watch?v=TtQDNFe94-k', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400'),
  ('Organic Composting at Home', 'Organic Farming', 'Learn to make nutrient-rich compost from farm waste. Vermicomposting techniques and troubleshooting tips included.', 'https://www.youtube.com/watch?v=qyhp0WiI_qo', 'https://images.unsplash.com/photo-1585744256869-b441f32cb815?auto=format&fit=crop&q=80&w=400'),
  ('Integrated Pest Management (IPM)', 'Crop Protection', 'Reduce pesticide use with IPM strategies. Identify beneficial insects and use biological controls effectively.', 'https://www.youtube.com/watch?v=LXE04h8a28Y', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400'),
  ('Soil Testing and Analysis', 'Soil Management', 'Understand NPK values, pH levels, and micronutrients. Learn when and how to collect soil samples for testing.', 'https://www.youtube.com/watch?v=vrMYR9hy_Ko', 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80&w=400'),
  ('Crop Rotation Benefits', 'Farming Techniques', 'Maximize yield and soil health with proper crop rotation. Examples of 3-year and 4-year rotation cycles.', 'https://www.youtube.com/watch?v=6P7AsxD5vPI', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400'),
  ('Mulching Techniques', 'Soil Management', 'Water conservation through mulching. Organic vs plastic mulch - pros and cons for different crops.', 'https://www.youtube.com/watch?v=C0L925rvO8Y', 'https://images.unsplash.com/photo-1585744256869-b441f32cb815?auto=format&fit=crop&q=80&w=400'),
  ('Greenhouse Farming Basics', 'Protected Cultivation', 'Introduction to polyhouse farming. Structure selection, climate control, and suitable crops.', 'https://www.youtube.com/watch?v=vZRtvOp_tSQ', 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=400'),
  ('Water Harvesting Structures', 'Water Management', 'Build farm ponds and check dams. Rainwater harvesting techniques for drought-prone areas.', 'https://www.youtube.com/watch?v=Q3lXvpyqU_w', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400')
ON CONFLICT (title) DO NOTHING;

-- =====================================================
-- 5. NEWS ARTICLES
-- =====================================================

INSERT INTO news_articles (title, content, category, image_url) VALUES
  ('New Government MSP Announced for Kharif Crops 2024',
   'The Government of India has announced new Minimum Support Prices (MSP) for Kharif crops for marketing season 2024-25. Paddy (common) will now fetch ₹2183/quintal, up from ₹2040. Cotton MSP increased to ₹6620/quintal from ₹6080. The decision aims to ensure remunerative prices for farmers.',
   'Policy',
   'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400'),
   
  ('Maharashtra Approves ₹10,000 Crore Farm Loan Waiver',
   'The Maharashtra state government has approved a farm loan waiver scheme worth ₹10,000 crore benefiting approximately 15 lakh farmers. The scheme covers loans up to ₹2 lakh taken from cooperative banks and will provide immediate relief to debt-stressed farmers.',
   'State News',
   'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400'),
   
  ('PM-KISAN 16th Installment Released',
   'The 16th installment of PM-KISAN scheme has been released, benefiting 9.5 crore farmers across India. Each beneficiary receives ₹2000 directly in their bank accounts. Farmers can verify payment status on pmkisan.gov.in using their Aadhaar number.',
   'Schemes',
   'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=400'),
   
  ('Drone Technology Adoption Increasing in Indian Agriculture',
   'The adoption of agricultural drones has seen rapid growth with over 5000 drones now operational across India. Drones are being used for pesticide spraying, crop health monitoring, and precision agriculture. The government has announced subsidies up to 50% for drone purchases.',
   'Technology',
   'https://images.unsplash.com/photo-1507666405495-422189b5a48d?auto=format&fit=crop&q=80&w=400'),
   
  ('Organic Farming Area Crosses 4 Million Hectares',
   'India''s organic farming area has crossed 4.43 million hectares, making it the country with third-largest organic farmland globally. Sikkim continues to be the first fully organic state. The export of organic products has grown by 51% in the last year.',
   'Market Trends',
   'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400')
ON CONFLICT (title) DO NOTHING;

-- =====================================================
-- Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed data inserted successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Mandi Prices: 20 crops';
  RAISE NOTICE 'Agri Services: 10 equipment/services';
  RAISE NOTICE 'Store Products: 14 products';
  RAISE NOTICE 'Academy Content: 8 video tutorials';
  RAISE NOTICE 'News Articles: 5 recent articles';
  RAISE NOTICE '========================================';
END $$;
