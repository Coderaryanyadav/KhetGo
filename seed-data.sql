-- =====================================================
-- KhetGo Seed Data Script
-- Populates database with realistic Indian agricultural data
-- =====================================================

-- Note: Run this AFTER running SCHEMA.sql
-- This script is safe to run multiple times (uses INSERT ... ON CONFLICT)

-- =====================================================
-- 1. MANDI PRICES (Real Indian Market Prices)
-- =====================================================

INSERT INTO mandi_prices (crop, price, unit, change, change_pct, trend, market_date) VALUES
  ('Wheat', '₹2450', 'Quintal', '+₹50', '+2.1%', 'up', CURRENT_DATE),
  ('Rice (Basmati)', '₹4200', 'Quintal', '+₹120', '+2.9%', 'up', CURRENT_DATE),
  ('Rice (Sona Masuri)', '₹3800', 'Quintal', '-₹80', '-2.1%', 'down', CURRENT_DATE),
  ('Mustard', '₹5600', 'Quintal', '-₹150', '-2.6%', 'down', CURRENT_DATE),
  ('Gram (Chana)', '₹5200', 'Quintal', '+₹75', '+1.5%', 'up', CURRENT_DATE),
  ('Potato', '₹1200', 'Quintal', '+₹40', '+3.4%', 'up', CURRENT_DATE),
  ('Onion', '₹1800', 'Quintal', '-₹200', '-10%', 'down', CURRENT_DATE),
  ('Tomato', '₹2200', 'Quintal', '+₹300', '+15.8%', 'up', CURRENT_DATE),
  ('Cotton', '₹6500', 'Quintal', '+₹100', '+1.6%', 'up', CURRENT_DATE),
  ('Sugarcane', '₹350', 'Quintal', '+₹10', '+2.9%', 'up', CURRENT_DATE),
  ('Turmeric', '₹8200', 'Quintal', '-₹300', '-3.5%', 'down', CURRENT_DATE),
  ('Groundnut', '₹6800', 'Quintal', '+₹180', '+2.7%', 'up', CURRENT_DATE),
  ('Soybean', '₹4500', 'Quintal', '+₹90', '+2%', 'up', CURRENT_DATE),
  ('Maize', '₹1900', 'Quintal', '-₹60', '-3.1%', 'down', CURRENT_DATE),
  ('Jowar', '₹3200', 'Quintal', '+₹50', '+1.6%', 'up', CURRENT_DATE),
  ('Bajra', '₹2400', 'Quintal', '-₹30', '-1.2%', 'down', CURRENT_DATE),
  ('Tur Dal', '₹7500', 'Quintal', '+₹200', '+2.7%', 'up', CURRENT_DATE),
  ('Moong Dal', '₹8500', 'Quintal', '+₹150', '+1.8%', 'up', CURRENT_DATE),
  ('Urad Dal', '₹6800', 'Quintal', '-₹120', '-1.7%', 'down', CURRENT_DATE),
  ('Green Chilli', '₹3500', 'Quintal', '+₹500', '+16.7%', 'up', CURRENT_DATE)
ON CONFLICT (crop) DO UPDATE SET
  price = EXCLUDED.price,
  change = EXCLUDED.change,
  change_pct = EXCLUDED.change_pct,
  trend = EXCLUDED.trend,
  market_date = EXCLUDED.market_date,
  updated_at = NOW();

-- =====================================================
-- 2. SAMPLE MARKETPLACE LISTINGS
-- Note: You'll need to replace 'USER_ID_HERE' with actual user IDs
-- after users sign up
-- =====================================================

-- Example: Create some sample listings (these will fail if no users exist)
-- You can run these after creating your first user account

COMMENT ON TABLE listings IS 'Sample listings will be created by users through the app';

-- =====================================================
-- 3. AGRI SERVICES (Equipment Rental)
-- =====================================================

INSERT INTO agri_services (title, type, price_per_day, location, description, image_url, is_active) VALUES
  ('Tractor (50 HP) with Operator', 'Heavy Equipment', 2500, 'Nagpur, Maharashtra', 'Mahindra 575 DI tractor with experienced operator. Perfect for ploughing, leveling, and transportation. Fuel included.', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400', true),
  ('Rotavator 7 Feet', 'Implements', 1200, 'Amravati, Maharashtra', 'Heavy-duty rotavator for soil preparation. Suitable for all soil types. Can be attached to any 35+ HP tractor.', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400', true),
  ('Harvester Combine', 'Heavy Equipment', 8000, 'Wardha, Maharashtra', 'Self-propelled combine harvester for wheat, rice, and pulses. Covers 10-12 acres per day. Operator included.', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400', true),
  ('Seed Drill Machine', 'Implements', 800, 'Yavatmal, Maharashtra', '9-tyne seed drill for precise sowing. Adjustable row spacing. Suitable for wheat, gram, and soybean.', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400', true),
  ('Water Pump (Diesel)', 'Irrigation', 600, 'Chandrapur, Maharashtra', '5 HP diesel water pump. Discharge rate: 200 gallons/minute. Perfect for emergency irrigation.', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400', true),
  ('Sprayer (Power)', 'Crop Protection', 400, 'Nagpur, Maharashtra', 'Power sprayer with 200L tank. Suitable for pesticide, fungicide, and fertilizer application. Covers 5 acres per refill.', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', true),
  ('Cultivator (9 Tyne)', 'Implements', 500, 'Bhandara, Maharashtra', 'Spring loaded cultivator for intercultivation and weed control. Works with 35+ HP tractors.', 'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&q=80&w=400', true),
  ('Laser Land Leveler', 'Land Preparation', 3500, 'Akola, Maharashtra', 'Laser-guided land leveler for perfect field leveling. Improves irrigation efficiency by 40%. Operator included.', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400', true),
  ('Post Hole Digger', 'Tools', 300, 'Gondia, Maharashtra', 'Tractor-mounted post hole digger. Dig 50-60 holes per hour. Perfect for fence installation.', 'https://images.unsplash.com/photo-1416339442236-8ceb164046f8?auto=format&fit=crop&q=80&w=400', true),
  ('Paddy Thresher', 'Processing', 1500, 'Gadchiroli, Maharashtra', 'High-capacity paddy thresher. Processes 10-12 quintals per hour with minimal grain damage.', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. AGRI STORE PRODUCTS
-- =====================================================

INSERT INTO store_products (name, brand, price, unit, category, image_url, description, stock_quantity, is_available) VALUES
  -- Seeds
  ('Hybrid Tomato Seeds (Abhilash)', 'Nunhems', 450, '10g packet', 'Seeds', 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&q=80&w=400', 'High yielding hybrid tomato variety. Resistant to leaf curl virus. Avg yield: 60-70 tons/acre', 500, true),
  ('BT Cotton Seeds (Mallika)', 'Kaveri', 850, '450g packet', 'Seeds', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&q=80&w=400', 'Bollworm resistant BT cotton. Suitable for black soil. Duration: 150-160 days', 300, true),
  ('Wheat Seeds (HD-2967)', 'IARI', 40, 'Kg', 'Seeds', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=400', 'High yielding wheat variety. Avg yield: 50-55 quintals/acre. Suitable for irrigated areas', 2000, true),
  
  -- Fertilizers
  ('Urea (46% N)', 'IFFCO', 268, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400', 'High nitrogen fertilizer. Apply during vegetative growth stage. Dosage: 2-3 bags/acre', 1000, true),
  ('DAP (Di-Ammonium Phosphate)', 'IFFCO', 1350, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', '18-46-0 formula. Apply as basal dose. Promotes root development', 800, true),
  ('Potash (MOP)', 'National', 890, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&q=80&w=400', 'Muriate of Potash (60% K2O). Improves fruit quality and disease resistance', 600, true),
  ('NPK 19:19:19', 'Tata Rallis', 1100, '50 Kg bag', 'Fertilizer', 'https://images.unsplash.com/photo-1416339442236-8ceb164046f8?auto=format&fit=crop&q=80&w=400', 'Complete balanced fertilizer. Water-soluble. Suitable for all crops', 400, true),

  -- Pesticides
  ('Confidor (Imidacloprid)', 'Bayer', 320, '100ml bottle', 'Pesticides', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400', 'Systemic insecticide. Controls aphids, jassids, whiteflies. Dosage: 60ml/acre', 250, true),
  ('Bavistin (Carbendazim)', 'BASF', 280, '250g pack', 'Fungicides', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400', 'Broad-spectrum fungicide. Controls leaf spot, powdery mildew. Dosage: 200g/acre', 300, true),
  ('Roundup (Glyphosate)', 'Monsanto', 425, '500ml bottle', 'Herbicides', 'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&q=80&w=400', 'Post-emergence herbicide. Controls all types of weeds. Apply before sowing', 200, true),

  -- Tools
  ('Sprayer Pump (Manual)', 'Neptune', 850, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400', '16L capacity backpack sprayer. Brass nozzle. Comfortable shoulder straps', 150, true),
  ('Sickle (Harvesting)', 'Standard', 120, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&q=80&w=400', 'Sharp steel blade. Wooden handle. Perfect for wheat and rice harvesting', 500, true),
  ('Spade (Heavy Duty)', 'Bellota', 380, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?auto=format&fit=crop&q=80&w=400', 'Forged steel blade. Hardwood handle. Lifetime warranty', 200, true),
  ('Digital Soil pH Meter', 'Lutron', 2400, 'Piece', 'Tools', 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80&w=400', 'Measures pH, moisture, and temperature. Battery operated. LCD display', 50, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. ACADEMY CONTENT (Educational Resources)
-- =====================================================

INSERT INTO academy_content (title, category, description, video_url, thumbnail_url, duration_minutes, views) VALUES
  ('Drip Irrigation Installation Guide', 'Irrigation', 'Complete step-by-step guide for installing drip irrigation system. Learn about spacing, emitter selection, and maintenance.', 'https://www.youtube.com/watch?v=TtQDNFe94-k', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=400', 18, 15420),
  ('Organic Composting at Home', 'Organic Farming', 'Learn to make nutrient-rich compost from farm waste. Vermicomposting techniques and troubleshooting tips included.', 'https://www.youtube.com/watch?v=qyhp0WiI_qo', 'https://images.unsplash.com/photo-1585744256869-b441f32cb815?auto=format&fit=crop&q=80&w=400', 12, 28730),
  ('Integrated Pest Management (IPM)', 'Crop Protection', 'Reduce pesticide use with IPM strategies. Identify beneficial insects and use biological controls effectively.', 'https://www.youtube.com/watch?v=LXE04h8a28Y', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400', 22, 19850),
  ('Soil Testing and Analysis', 'Soil Management', 'Understand NPK values, pH levels, and micronutrients. Learn when and how to collect soil samples for testing.', 'https://www.youtube.com/watch?v=vrMYR9hy_Ko', 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&q=80&w=400', 14, 22340),
  ('Crop Rotation Benefits', 'Farming Techniques', 'Maximize yield and soil health with proper crop rotation. Examples of 3-year and 4-year rotation cycles.', 'https://www.youtube.com/watch?v=6P7AsxD5vPI', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=400', 16, 17620),
  ('Mulching Techniques', 'Soil Management', 'Water conservation through mulching. Organic vs plastic mulch - pros and cons for different crops.', 'https://www.youtube.com/watch?v=C0L925rvO8Y', 'https://images.unsplash.com/photo-1585744256869-b441f32cb815?auto=format&fit=crop&q=80&w=400', 10, 13540),
  ('Greenhouse Farming Basics', 'Protected Cultivation', 'Introduction to polyhouse farming. Structure selection, climate control, and suitable crops.', 'https://www.youtube.com/watch?v=vZRtvOp_tSQ', 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=400', 25, 31250),
  ('Water Harvesting Structures', 'Water Management', 'Build farm ponds and check dams. Rainwater harvesting techniques for drought-prone areas.', 'https://www.youtube.com/watch?v=Q3lXvpyqU_w', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400', 20, 16890)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. NEWS ARTICLES
-- =====================================================

INSERT INTO news_articles (title, summary, content, category, source_url, publish_date) VALUES
  ('New Government MSP Announced for Kharif Crops 2024',
   'Centre increases Minimum Support Price for major Kharif crops including paddy, cotton, and pulses',
   'The Government of India has announced new Minimum Support Prices (MSP) for Kharif crops for marketing season 2024-25. Paddy (common) will now fetch ₹2183/quintal, up from ₹2040. Cotton MSP increased to ₹6620/quintal from ₹6080. The decision aims to ensure remunerative prices for farmers.',
   'Policy',
   'https://pib.gov.in',
   CURRENT_DATE - INTERVAL '2 days'),
   
  ('Maharashtra Approves ₹10,000 Crore Farm Loan Waiver',
   'State cabinet clears complete waiver for small and marginal farmers',
   'The Maharashtra state government has approved a farm loan waiver scheme worth ₹10,000 crore benefiting approximately 15 lakh farmers. The scheme covers loans up to ₹2 lakh taken from cooperative banks and will provide immediate relief to debt-stressed farmers.',
   'State News',
   'https://maharashtra.gov.in',
   CURRENT_DATE - INTERVAL '5 days'),
   
  ('PM-KISAN 16th Installment Released',
   '₹2000 credited to 9.5 crore farmer accounts',
   'The 16th installment of PM-KISAN scheme has been released, benefiting 9.5 crore farmers across India. Each beneficiary receives ₹2000 directly in their bank accounts. Farmers can verify payment status on pmkisan.gov.in using their Aadhaar number.',
   'Schemes',
   'https://pmkisan.gov.in',
   CURRENT_DATE - INTERVAL '1 day'),
   
  ('Drone Technology Adoption Increasing in Indian Agriculture',
   'Over 5000 drones currently being used for crop monitoring and spraying',
   'The adoption of agricultural drones has seen rapid growth with over 5000 drones now operational across India. Drones are being used for pesticide spraying, crop health monitoring, and precision agriculture. The government has announced subsidies up to 50% for drone purchases.',
   'Technology',
   'https://agricoop.nic.in',
   CURRENT_DATE - INTERVAL '3 days'),
   
  ('Organic Farming Area Crosses 4 Million Hectares',
   'India ranks 3rd globally in organic agricultural land',
   'India''s organic farming area has crossed 4.43 million hectares, making it the country with third-largest organic farmland globally. Sikkim continues to be the first fully organic state. The export of organic products has grown by 51% in the last year.',
   'Market Trends',
   'https://apeda.gov.in',
   CURRENT_DATE - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. FORUM POSTS (Sample Discussions)
-- Note: These will reference actual user IDs once users sign up
-- =====================================================

COMMENT ON TABLE forum_posts IS 'Forum posts will be created by users through the app. Community discussions on farming topics.';

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
  RAISE NOTICE 'Note: Marketplace listings and forum posts';
  RAISE NOTICE 'will be created by users through the app.';
  RAISE NOTICE '========================================';
END $$;
