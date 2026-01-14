import { supabase } from './supabase';
import './style.css';
import { Chart, registerables } from 'chart.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

Chart.register(...registerables);

/**
 * KhetGo - High-Performance Agricultural Ecosystem
 */

// --- App State ---
let state = {
  user: null,
  profile: null,
  currentView: 'dashboard',
  searchQuery: '',
  filters: {
    pincode: '',
    minPrice: 0,
    maxPrice: 10000,
    sortBy: 'newest'
  },
  location: null,
  mandiPrices: [],
  cropListings: [],
  myBookings: [],
  storeProducts: [],
  services: [],
  news: [],
  forumPosts: [],
  ledgerEntries: [],
  academyContent: [],
  messages: [],
  language: 'en', // 'en', 'hi', 'mr'
  activeChat: null,
  isLoading: false,
  weather: null,
  weatherLoading: false
};

const translations = {
  en: { dashboard: 'Dashboard', marketplace: 'Marketplace', rentals: 'Rentals', advisor: 'AI Advisor', khata: 'Ledger', academy: 'Academy', community: 'Agri-Forum', activity: 'Activity' },
  hi: { dashboard: 'डैशबोर्ड', marketplace: 'बाजार', rentals: 'किराया', advisor: 'एआई सलाहकार', khata: 'बहीखाता', academy: 'अकादमी', community: 'कृषि-मंच', activity: 'गतिविधि' },
  mr: { dashboard: 'डॅशबोर्ड', marketplace: 'बाजारपेठ', rentals: 'भाड्याने', advisor: 'एआय सल्लागार', khata: 'खातेवही', academy: 'अकादमी', community: 'कृषी-मंच', activity: 'हालचाल' }
};

const t = (key) => translations[state.language][key] || key;

// --- Auth Handling ---
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  state.user = user;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    state.profile = profile;
    subscribeToMessages();
    requestNotificationPermission();
    getGeoLocation();
  }
  render();
}

function subscribeToMessages() {
  if (!state.user) return;
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMessage = payload.new;
      if (newMessage.receiver_id === state.user.id || newMessage.sender_id === state.user.id) {
        state.messages.push(newMessage);
        if (state.currentView === 'chat') render();
      }
    })
    .subscribe();
}

async function fetchMessages(otherUserId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${state.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${state.user.id})`)
    .order('created_at', { ascending: true });

  if (!error) {
    state.messages = data;
    render();
  }
}

async function getGeoLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await fetchWeather(pos.coords.latitude, pos.coords.longitude);
      render();
    });
  } else {
    // Fallback to default location if geolocation not available
    const defaultLat = import.meta.env.VITE_DEFAULT_LAT || 21.1458;
    const defaultLng = import.meta.env.VITE_DEFAULT_LNG || 79.0882;
    await fetchWeather(defaultLat, defaultLng);
  }
}

async function fetchWeather(lat, lng) {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.warn('OpenWeather API key not configured');
    state.weather = null;
    return;
  }

  state.weatherLoading = true;
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`
    );
    const data = await response.json();

    // Process 7-day forecast (OpenWeather gives 5-day/3-hour forecast)
    const dailyForecast = {};
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      if (!dailyForecast[day]) {
        dailyForecast[day] = {
          temp: Math.round(item.main.temp),
          icon: item.weather[0].icon,
          description: item.weather[0].description
        };
      }
    });

    state.weather = {
      current: data.list[0],
      daily: Object.entries(dailyForecast).slice(0, 7).map(([day, data]) => ({ day, ...data })),
      city: data.city.name
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    state.weather = null;
  } finally {
    state.weatherLoading = false;
  }
}

// Haversine Distance Helper
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// Notification Helper
function showNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: 'https://ui-avatars.com/api/?name=K&background=1B4332&color=fff' });
  }
}

// Request Notification Permission
async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

// --- Data Fetching ---
async function fetchAllData() {
  state.isLoading = true;
  render();

  try {
    const fetchers = [
      supabase.from('mandi_prices').select('*').order('updated_at', { ascending: false }),
      supabase.from('listings').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('booking_date', { ascending: false }),
      supabase.from('store_products').select('*').order('created_at', { ascending: false }),
      supabase.from('agri_services').select('*').order('created_at', { ascending: false }),
      supabase.from('news_articles').select('*').order('created_at', { ascending: false }),
      supabase.from('forum_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('ledger_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('academy_content').select('*').order('created_at', { ascending: false })
    ];

    const results = await Promise.all(fetchers);

    state.mandiPrices = results[0].data || [];
    state.cropListings = results[1].data || [];
    state.myBookings = results[2].data || [];
    state.storeProducts = results[3].data || [];
    state.services = results[4].data || [];
    state.news = results[5].data || [];
    state.forumPosts = results[6].data || [];
    state.ledgerEntries = results[7].data || [];
    state.academyContent = results[8].data || [];

  } catch (err) {
    console.error('Real Data Sync Error:', err.message);
  } finally {
    state.isLoading = false;
    render();
  }
}

// --- Component Fragments ---
const Header = (title) => `
  <header>
    <div class="header-left">
      <h1>${title}</h1>
    </div>
    <div class="header-right">
      <div class="search-bar">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="global-search" placeholder="Search crops, locations..." value="${state.searchQuery}">
      </div>
      <div class="user-profile">
        <div class="verified-badge">
          <i class="fa-solid fa-circle-check"></i> ${state.profile?.is_verified ? 'Verified' : 'Member'}
        </div>
        <img class="profile-img" src="https://ui-avatars.com/api/?name=${state.profile?.full_name || 'User'}&background=1B4332&color=fff&rounded=true" alt="User">
      </div>
    </div>
  </header>
`;

const Sidebar = () => `
  <aside class="sidebar">
    <div class="brand">
      <i class="fa-solid fa-leaf"></i>
      <span>KhetGo</span>
    </div>
    <nav class="nav-links">
      <div class="nav-link ${state.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
        <i class="fa-solid fa-chart-pie"></i>
        <span>${t('dashboard')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'marketplace' ? 'active' : ''}" data-view="marketplace">
        <i class="fa-solid fa-shop"></i>
        <span>${t('marketplace')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'services' ? 'active' : ''}" data-view="services">
        <i class="fa-solid fa-truck-pickup"></i>
        <span>${t('rentals')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'advisor' ? 'active' : ''}" data-view="advisor">
        <i class="fa-solid fa-robot"></i>
        <span>${t('advisor')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'khata' ? 'active' : ''}" data-view="khata">
        <i class="fa-solid fa-book"></i>
        <span>${t('khata')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'academy' ? 'active' : ''}" data-view="academy">
        <i class="fa-solid fa-graduation-cap"></i>
        <span>${t('academy')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'forum' ? 'active' : ''}" data-view="forum">
        <i class="fa-solid fa-users"></i>
        <span>${t('community')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'my-activity' ? 'active' : ''}" data-view="my-activity">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <span>${t('activity')}</span>
      </div>
    </nav>
    <div style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
       <select onchange="window.setLanguage(this.value)" style="width:100%; padding:8px; border-radius:8px; background:rgba(255,255,255,0.1); color:white; border:none; outline:none; font-size: 0.8rem;">
          <option value="en" ${state.language === 'en' ? 'selected' : ''}>English</option>
          <option value="hi" ${state.language === 'hi' ? 'selected' : ''}>हिन्दी</option>
          <option value="mr" ${state.language === 'mr' ? 'selected' : ''}>मराठी</option>
       </select>
    </div>
    <div class="sidebar-footer" style="margin-top: auto; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--accent); cursor: pointer;" onclick="window.setView('profile')">${state.profile?.full_name || 'User'}</div>
        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em;">${state.profile?.role || 'Member'}</div>
      </div>
      <div class="nav-link" style="color: #FF6B6B;" onclick="window.logout()">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span>Logout</span>
      </div>
    </div>
  </aside>
`;

// --- View Definitions ---
const DashboardView = () => `
  <div class="fade-in">
    ${Header('Farm Overview')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%); color: white; margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Harvest Update</h2>
          <p style="opacity: 0.9; margin-bottom: 1.5rem;">
            ${state.mandiPrices[0]
    ? `Market prices for <strong>${state.mandiPrices[0].crop}</strong> have changed by ${state.mandiPrices[0].change_pct} today.`
    : 'Welcome back! Check the latest mandi rates below.'}
          </p>
          <button class="btn-primary" style="background: var(--accent); color: var(--primary);" onclick="window.setView('add-listing')">Post New Listing</button>
        </div>
        
        <div class="section-title" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 1.4rem;">Market Trends</h2>
          <button class="btn-primary" style="background: none; color: var(--secondary); padding: 0;" onclick="window.setView('marketplace')">See All</button>
        </div>
        
        <div class="marketplace-grid">
          ${state.cropListings.slice(0, 3).map(crop => `
            <div class="crop-card">
              <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image">
              <div class="crop-details">
                <div class="crop-name">${crop.name}</div>
                <div class="crop-location"><i class="fa-solid fa-location-dot"></i> ${crop.location || 'Local'}</div>
                <div class="crop-footer">
                  <span class="price">₹${crop.price}/${crop.unit}</span>
                  <button class="btn-primary" onclick="window.showListing('${crop.id}')">Details</button>
                </div>
              </div>
            </div>
          `).join('') || '<p style="color: grey;">No listings yet. Be the first!</p>'}
        </div>
      </section>
      
      <aside>
        <div class="glass-card">
          <h2 style="font-size: 1.25rem; margin-bottom: 1.5rem;">Live Mandi Prices</h2>
          <div class="mandi-list">
            ${state.mandiPrices.map(item => `
              <div class="mandi-item">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="background:#F0FDF4; padding:8px; border-radius:10px; color:var(--primary);"><i class="fa-solid fa-seedling"></i></div>
                  <div>
                    <div style="font-weight:700; font-size:0.9rem;">${item.crop}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${item.unit}</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="price">${item.price}</div>
                  <div class="trend ${item.trend}" style="font-size:0.8rem;">
                    ${item.trend === 'up' ? '▲' : '▼'} ${item.change}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        <div class="glass-card" style="margin-top: 2rem;">
          <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">
            ${state.weather?.city ? `Weather in ${state.weather.city}` : 'Local Weather'}
          </h2>
          ${state.weatherLoading ? `
            <div style="text-align: center; padding: 2rem; color: grey;">
              <i class="fa-solid fa-spinner fa-spin"></i> Loading weather...
            </div>
          ` : state.weather ? `
            <div style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 10px;">
              ${state.weather.daily.map(day => `
                <div style="text-align: center; min-width: 60px; padding: 10px; background: #f9f9f9; border-radius: 12px;">
                  <div style="font-size: 0.8rem; color: grey;">${day.day}</div>
                  <img src="https://openweathermap.org/img/wn/${day.icon}.png" style="width: 40px; height: 40px; margin: 4px 0;" alt="${day.description}">
                  <div style="font-weight: 700; font-size: 0.9rem;">${day.temp}°C</div>
                </div>
              `).join('')}
            </div>
            <p style="font-size: 0.75rem; color: #059669; margin-top: 10px;">
              <i class="fa-solid fa-circle-info"></i> ${state.weather.current.weather[0].description}
            </p>
          ` : `
            <div style="text-align: center; padding: 2rem; color: grey; font-size: 0.85rem;">
              <i class="fa-solid fa-cloud-slash"></i><br>
              Weather data unavailable. Add VITE_OPENWEATHER_API_KEY to enable.
            </div>
          `}
        </div>

        <div class="glass-card" style="margin-top: 2rem;">
          <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">Price Trends (Wheat)</h2>
          <canvas id="mandi-mini-chart" style="max-height: 150px;"></canvas>
        </div>
      </aside>
    </div>
  </div>
`;

const ServicesView = () => {
  return `
    <div class="fade-in">
      ${Header('Agri Services & Rentals')}
      <div style="margin-bottom: 3rem;">
        <h2 style="margin-bottom: 1.5rem;">Equipment Rental</h2>
        <div class="marketplace-grid">
          ${state.services.length > 0 ? state.services.map(s => `
            <div class="crop-card">
              <img src="${s.image_url}" class="crop-image">
              <div class="crop-details">
                <div style="display:flex; justify-content:space-between;">
                  <div class="crop-name">${s.title}</div>
                  <span style="font-size: 0.75rem; background: #f0fdf4; color: var(--primary); padding: 4px 8px; border-radius: 6px; height: fit-content;">${s.type}</span>
                </div>
                <div class="crop-location" style="margin-top: 4px;">${s.location || 'Local Region'}</div>
                <div class="crop-footer">
                  <span class="price">₹${(s.price_per_day || 0).toLocaleString()}/day</span>
                  <button class="btn-primary" onclick="window.bookService('${s.title}', ${s.price_per_day})">Rent Now</button>
                </div>
              </div>
            </div>
          `).join('') : '<p style="text-align:center; color:grey; padding: 2rem; width:100%;">No services found in your area.</p>'}
        </div>
      </div>

      <div class="glass-card" style="background: linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%); color: white;">
        <h2 style="margin-bottom: 1rem;">Soil Testing Service</h2>
        <p style="opacity: 0.9; margin-bottom: 1.5rem;">Get your soil tested by experts. Optimize your fertilizer usage and increase yield by up to 30%.</p>
        <button class="btn-primary" style="background: var(--accent); color: var(--primary);" onclick="window.setView('soil-testing')">Book Laboratory Test</button>
      </div>
    </div>
  `;
};

const AgriStoreView = () => {
  return `
    <div class="fade-in">
      ${Header('Agri Store')}
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem; overflow-x: auto;">
        ${['All', 'Seeds', 'Fertilizer', 'Pesticides', 'Tools'].map(cat => `
          <button class="btn-primary" style="background: ${cat === 'All' ? 'var(--primary)' : 'white'}; color: ${cat === 'All' ? 'white' : 'var(--text-main)'}; border: 1px solid #eee; white-space: nowrap;">${cat}</button>
        `).join('')}
      </div>

      <div class="marketplace-grid">
        ${state.storeProducts.length > 0 ? state.storeProducts.map(p => `
          <div class="crop-card">
            <img src="${p.image_url}" class="crop-image">
            <div class="crop-details">
              <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 600; text-transform: uppercase;">${p.brand || 'Local'}</div>
              <div class="crop-name" style="margin: 4px 0;">${p.name}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">${p.unit || ''}</div>
              <div class="crop-footer">
                <span class="price">₹${p.price}</span>
                <button class="btn-primary" onclick="alert('Item added to cart!')">Buy Now</button>
              </div>
            </div>
          </div>
        `).join('') : '<p style="grid-column:1/-1; text-align:center; color:grey; padding: 3rem;">Store is temporarily empty.</p>'}
      </div>
    </div>
  `;
};

const SoilTestingView = () => `
  <div class="fade-in">
    ${Header('Soil Testing Lab')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">Why Test Your Soil?</h2>
          <p style="line-height: 1.6; color: #4B5563;">Soil testing is an essential first step for any successful farming season. Our digital reports help you determine exactly what nutrients your soil lacks, saving you thousands in unnecessary fertilizer costs.</p>
        </div>

        <div class=" glass-card">
          <h3 style="margin-bottom: 1.5rem;">Book a Lab Test</h3>
          <form style="display: flex; flex-direction: column; gap: 1.2rem;">
            <div>
              <label style="display:block; font-weight:600; margin-bottom:6px;">Test Package</label>
              <select style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; background: white;">
                <option>Basic NPK Analysis - ₹299</option>
                <option>Advanced Micronutrient Test - ₹599</option>
                <option>Complete Soil Health Card - ₹999</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-weight:600; margin-bottom:6px;">Sample Collection Date</label>
              <input type="date" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB;">
            </div>
            <button class="btn-primary" type="button" onclick="alert('Sample collection agent will be assigned to your pincode.')">Schedule Collection</button>
          </form>
        </div>
      </section>

      <aside>
        <div class="glass-card" style="background: #F0FDF4; border: 1px dashed var(--secondary);">
          <h3 style="font-size: 1.1rem; color: var(--primary); margin-bottom: 1rem;">Previous Reports</h3>
          <p style="font-size: 0.85rem; color: grey;">You haven't uploaded any soil health cards yet. Get your first test today!</p>
        </div>
      </aside>
    </div>
  </div>
`;

const MandiMarketsView = () => `
  <div class="fade-in">
    ${Header('Market Price Analytics')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1.5rem;">Historical Price Analysis</h2>
          <div style="height: 300px;">
            <canvas id="mandi-large-chart"></canvas>
          </div>
        </div>
        
        <div class="glass-card">
          <h2 style="margin-bottom: 1.5rem;">Live Market Rates</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
            ${state.mandiPrices.map(item => `
              <div class="glass-card" style="padding: 1rem; border: 1px solid #eee;">
                <div style="font-weight: 700;">${item.crop}</div>
                <div class="price" style="font-size: 1.25rem; margin: 10px 0;">${item.price}</div>
                <div class="trend ${item.trend}">${item.trend === 'up' ? '▲' : '▼'} ${item.change}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <aside>
        <div class="glass-card">
          <h2 style="font-size: 1.25rem; margin-bottom: 1.5rem;">Market Updates</h2>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="font-size: 0.9rem; padding: 10px; border-left: 4px solid var(--primary); background: #f9f9f9;">
              New government MSP declared for Kharif crops.
            </div>
            <div style="font-size: 0.9rem; padding: 10px; border-left: 4px solid var(--secondary); background: #f9f9f9;">
              Export duty reduced on Basmati Rice.
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
`;

const MarketplaceView = () => {
  let filtered = state.cropListings.filter(c =>
    (c.name.toLowerCase().includes(state.searchQuery.toLowerCase())) &&
    (state.filters.pincode === '' || (c.pincode && c.pincode.includes(state.filters.pincode))) &&
    (c.price >= state.filters.minPrice && c.price <= state.filters.maxPrice)
  );

  // Sorting Logic
  if (state.filters.sortBy === 'price-low') filtered.sort((a, b) => a.price - b.price);
  if (state.filters.sortBy === 'price-high') filtered.sort((a, b) => b.price - a.price);
  if (state.filters.sortBy === 'newest') filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (state.filters.sortBy === 'nearest' && state.location) {
    filtered.sort((a, b) => {
      const distA = calculateDistance(state.location.lat, state.location.lng, a.lat, a.lng) || 99999;
      const distB = calculateDistance(state.location.lat, state.location.lng, b.lat, b.lng) || 99999;
      return distA - distB;
    });
  }

  return `
    <div class="fade-in">
      ${Header('Marketplace')}
      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 2.5rem;">
        <aside class="glass-card" style="height: fit-content; position: sticky; top: 2.5rem; padding: 1.5rem;">
          <h3 style="margin-bottom: 1.5rem;">Smart Filters</h3>
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Sort By</label>
            <select id="sort-select" style="width:100%; padding:10px; border-radius:10px; border:1px solid #E5E7EB; background:white;">
              <option value="newest" ${state.filters.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="price-low" ${state.filters.sortBy === 'price-low' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-high" ${state.filters.sortBy === 'price-high' ? 'selected' : ''}>Price: High to Low</option>
              <option value="nearest" ${state.filters.sortBy === 'nearest' ? 'selected' : ''}>Nearest (GPS)</option>
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Max Price: ₹${state.filters.maxPrice}</label>
            <input type="range" id="price-range" min="0" max="10000" step="100" value="${state.filters.maxPrice}" style="width:100%; accent-color: var(--primary);">
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Region Pincode</label>
            <input type="text" id="filter-pincode" placeholder="e.g. 4400" value="${state.filters.pincode}" 
                   style="width:100%; padding:10px; border-radius:10px; border:1px solid #E5E7EB; outline:none;">
          </div>
          
          <div style="background: #F0FDF4; padding: 10px; border-radius: 10px; font-size: 0.75rem; color: var(--primary); margin-bottom: 1.5rem;">
            <i class="fa-solid fa-location-crosshairs"></i> ${state.location ? 'Nearby mode active' : 'Enable GPS for distance sorting'}
          </div>

          <button class="btn-primary" style="width:100%;" onclick="window.resetFilters()">Reset All</button>
        </aside>
        
        <section class="marketplace-grid">
          ${filtered.map(crop => {
    const dist = state.location ? calculateDistance(state.location.lat, state.location.lng, crop.lat, crop.lng) : null;
    return `
              <div class="crop-card">
                <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image">
                <div class="crop-details">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="crop-name">${crop.name}</div>
                    ${crop.is_verified ? '<i class="fa-solid fa-certificate" style="color:#2D6A4F;" title="Verified"></i>' : ''}
                  </div>
                  <div class="crop-location" style="display:flex; justify-content:space-between;">
                    <span><i class="fa-solid fa-location-dot"></i> ${crop.location || 'Local'}</span>
                    ${dist ? `<span style="color:var(--primary); font-weight:600;">${dist} km</span>` : ''}
                  </div>
                  <div class="crop-footer">
                    <span class="price">₹${crop.price}/${crop.unit}</span>
                    <button class="btn-primary" onclick="window.showListing('${crop.id}')">Details</button>
                  </div>
                </div>
              </div>
            `;
  }).join('') || '<div style="grid-column:1/-1; text-align:center; padding:4rem;">No crops match your search.</div>'}
        </section>
      </div>
    </div>
  `;
};

const AddListingView = () => `
  <div class="fade-in">
    ${Header('Create Listing')}
    <div class="glass-card" style="max-width: 640px; margin: 0 auto;">
      <h2 style="margin-bottom: 2rem;">Market Your Produce</h2>
      <form id="listing-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div>
          <label style="display:block; font-weight:600; margin-bottom:8px;">Crop Name</label>
          <input type="text" name="name" required placeholder="e.g. Sona Masuri Rice" 
                 style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Price (₹)</label>
            <input type="number" name="price" required placeholder="per unit" 
                   style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Unit</label>
            <select name="unit" style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB;">
              <option value="kg">kg</option>
              <option value="quintal">quintal</option>
              <option value="ton">ton</option>
            </select>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Quantity Available</label>
            <input type="text" name="quantity" required placeholder="e.g. 500 kg" 
                   style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:8px;">Category</label>
            <select name="category" style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB; background: white;">
              <option value="Grains">Grains</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Fruits">Fruits</option>
              <option value="Organic">Organic</option>
            </select>
          </div>
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:8px;">Description</label>
          <textarea name="description" placeholder="Describe the quality, freshness, and organic details..." 
                    style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB; height: 120px; outline: none;"></textarea>
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:8px;">Region Pincode</label>
          <input type="text" name="pincode" required placeholder="6-digit pincode" 
                 style="width:100%; padding:14px; border-radius:14px; border:1px solid #E5E7EB;">
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:8px;">Crop Images (Multiple Support)</label>
          <input type="file" id="listing-images" multiple accept="image/*" 
                 style="width:100%; padding:14px; border-radius:14px; border:1px dashed #E5E7EB; background: #F9FAFB;">
          <p style="font-size: 0.75rem; color: grey; margin-top: 5px;">Upload real photos of your harvest for faster sales.</p>
        </div>
        <button type="submit" class="btn-primary" id="publish-btn" style="padding:16px; font-size:1rem; margin-top:1rem;">Publish to Marketplace</button>
      </form>
    </div>
  </div>
`;

const ActivityView = () => {
  const isFarmer = state.profile?.role === 'farmer';
  const myListings = state.cropListings.filter(l => l.owner_id === state.user.id);
  const myOrders = state.myBookings.filter(b => b.user_id === state.user.id);

  return `
    <div class="fade-in">
      ${Header('Your Dashboard')}
      
      ${isFarmer ? `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
          <div class="glass-card" style="background: #ECFDF5; border-color: #A7F3D0;">
            <div style="color: #065F46; font-size: 0.85rem; font-weight: 600;">Potential Revenue</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--primary); margin: 8px 0;">₹${myListings.reduce((acc, l) => acc + (l.price * 10), 0).toLocaleString()}</div>
            <div style="font-size: 0.75rem; color: #059669;">+12% from last month</div>
          </div>
          <div class="glass-card" style="background: #EFF6FF; border-color: #BFDBFE;">
            <div style="color: #1E40AF; font-size: 0.85rem; font-weight: 600;">Profile Visits</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: #1E3A8A; margin: 8px 0;">${(state.cropListings.length * 12) + 42}</div>
            <div style="font-size: 0.75rem; color: #2563EB;">Live from database</div>
          </div>
          <div class="glass-card" style="background: #FDF2F8; border-color: #FBCFE8;">
            <div style="color: #9D174D; font-size: 0.85rem; font-weight: 600;">Active Listings</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: #831843; margin: 8px 0;">${myListings.length}</div>
            <div style="font-size: 0.75rem; color: #DB2777;">4 verified crops</div>
          </div>
        </div>
      ` : ''}

      <div class="dashboard-grid">
        <section>
          <h2 style="margin-bottom: 1.5rem; font-size: 1.4rem;">${isFarmer ? 'Your Active Listings' : 'Orders You Placed'}</h2>
          ${isFarmer ? (myListings.length > 0 ? myListings.map(l => `
            <div class="activity-item">
              <div class="activity-info">
                <div class="activity-icon"><i class="fa-solid fa-leaf"></i></div>
                <div>
                  <div style="font-weight:700;">${l.name}</div>
                  <div style="font-size:0.85rem; color:var(--text-muted);">₹${l.price}/${l.unit} • Listed ${new Date(l.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <button class="btn-delete" onclick="window.deleteItem('${l.id}')">Remove</button>
            </div>
          `).join('') : '<div class="glass-card" style="text-align:center; padding:3rem; color:grey;">No active listings.</div>')
      : (myOrders.length > 0 ? myOrders.map(o => `
            <div class="activity-item">
              <div class="activity-info">
                <div class="activity-icon" style="background:#F0FDF4; color:var(--primary);"><i class="fa-solid fa-cart-shopping"></i></div>
                <div>
                  <div style="font-weight:700;">${o.item_name}</div>
                  <div style="font-size:0.85rem; color:var(--text-muted);">Status: <span style="color:var(--secondary); font-weight:600;">${o.status.toUpperCase()}</span></div>
                </div>
              </div>
            </div>
          `).join('') : '<div class="glass-card" style="text-align:center; padding:3rem; color:grey;">No orders yet.</div>')}
        </section>
        
        <aside>
          <h2 style="margin-bottom: 1.5rem; font-size: 1.4rem;">Notifications</h2>
          <div class="glass-card" style="padding: 1.25rem;">
            <div style="font-size: 0.9rem; padding: 12px 0; border-bottom: 1px solid #eee;">
              <div style="font-weight: 700;">Listing Verified</div>
              <div style="font-size: 0.75rem; color: grey;">Your 'Organic Wheat' listing is now live.</div>
            </div>
            <div style="font-size: 0.9rem; padding: 12px 0;">
              <div style="font-weight: 700;">Welcome to KhetGo!</div>
              <div style="font-size: 0.75rem; color: grey;">Complete your profile to get a verified badge.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
};

const LoginView = () => `
  <div class="fade-in" style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
    <div class="glass-card" style="width: 400px; padding: 2.5rem;">
      <div style="text-align: center; margin-bottom: 2rem;">
        <i class="fa-solid fa-leaf" style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem;"></i>
        <h2 style="font-size: 1.75rem;">Welcome to KhetGo</h2>
        <p style="color: var(--text-muted);">Please login to your account</p>
      </div>
      <form id="login-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Email Address</label>
          <input type="email" name="email" required placeholder="farmer@example.com" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; outline: none;">
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Password</label>
          <input type="password" name="password" required placeholder="••••••••" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; outline: none;">
        </div>
        <button type="submit" class="btn-primary" style="padding: 16px; margin-top: 1rem; font-size: 1rem;">Login Now</button>
        <p style="text-align: center; font-size: 0.95rem; margin-top: 1.5rem; color: var(--text-muted);">
          Don't have an account? <a href="#" style="color: var(--primary); font-weight: 700; text-decoration: none;" onclick="window.setView('signup')">Create one</a>
        </p>
      </form>
    </div>
  </div>
`;

const SignupView = () => `
  <div class="fade-in" style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
    <div class="glass-card" style="width: 400px; padding: 2.5rem;">
      <h2 style="text-align: center; margin-bottom: 2rem; font-size: 1.75rem;">Join KhetGo</h2>
      <form id="signup-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Full Name</label>
          <input type="text" name="full_name" required placeholder="Ram Singh" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; outline: none;">
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Email Address</label>
          <input type="email" name="email" required placeholder="farmer@example.com" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; outline: none;">
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">I want to...</label>
          <select name="role" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; background: white; outline: none;">
            <option value="farmer">Sell Produce (Farmer)</option>
            <option value="buyer">Buy Produce (Buyer)</option>
          </select>
        </div>
        <div>
          <label style="display:block; font-weight:600; margin-bottom:6px;">Create Password</label>
          <input type="password" name="password" required minlength="6" placeholder="••••••••" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; outline: none;">
        </div>
        <button type="submit" class="btn-primary" style="padding: 16px; margin-top: 1rem; font-size: 1rem;">Setup Account</button>
        <p style="text-align: center; font-size: 0.95rem; margin-top: 1.5rem; color: var(--text-muted);">
          Already have an account? <a href="#" style="color: var(--primary); font-weight: 700; text-decoration: none;" onclick="window.setView('login')">Login</a>
        </p>
      </form>
    </div>
  </div>
`;

const ProductDetailView = (id) => {
  const crop = state.cropListings.find(c => c.id === id);
  if (!crop) return '<div class="fade-in">Listing not found.</div>';

  return `
    <div class="fade-in">
      ${Header(crop.name)}
      <div class="dashboard-grid">
        <section>
          <div class="glass-card" style="padding: 0; overflow: hidden;">
            <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" 
                 style="width: 100%; height: 400px; object-fit: cover;">
            <div style="padding: 2.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                <div>
                  <h2 style="font-size: 2rem; margin-bottom: 0.5rem;">${crop.name}</h2>
                  <div class="crop-location" style="font-size: 1.1rem;">
                    <i class="fa-solid fa-location-dot"></i> ${crop.location_name || 'Local Region'} (${crop.pincode})
                  </div>
                </div>
                <div class="price" style="font-size: 2.5rem;">₹${crop.price}<span style="font-size: 1rem; color: var(--text-muted); font-weight: 500;">/${crop.unit}</span></div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
                <div class="glass-card" style="background: #F9FAFB; padding: 1.25rem; border-radius: 18px;">
                  <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px;">Quantity Available</div>
                  <div style="font-weight: 700; font-size: 1.1rem;">${crop.quantity || 'Contact Farmer'}</div>
                </div>
                <div class="glass-card" style="background: #F9FAFB; padding: 1.25rem; border-radius: 18px;">
                  <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px;">Harvest Date</div>
                  <div style="font-weight: 700; font-size: 1.1rem;">${crop.harvest_date ? new Date(crop.harvest_date).toLocaleDateString() : 'Fresh Stock'}</div>
                </div>
                <div class="glass-card" style="background: #F9FAFB; padding: 1.25rem; border-radius: 18px;">
                  <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px;">Category</div>
                  <div style="font-weight: 700; font-size: 1.1rem;">${crop.category || 'General'}</div>
                </div>
              </div>

              <h3 style="margin-bottom: 1rem;">Description</h3>
              <p style="line-height: 1.7; color: #4B5563; margin-bottom: 2.5rem; font-size: 1.05rem;">
                ${crop.description || 'No detailed description provided by the farmer. This is premium quality fresh produce ready for market.'}
              </p>

              <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                <button class="btn-primary" style="flex: 1; padding: 18px; font-size: 1.1rem; background: var(--secondary); display: flex; align-items: center; justify-content: center; gap: 10px;" 
                        onclick="window.placeOrder('${crop.id}')">
                  <i class="fa-solid fa-cart-shopping"></i> Order Produce
                </button>
              </div>
              <div style="display: flex; gap: 1rem;">
                <button class="btn-primary" style="flex: 1; padding: 18px; font-size: 1.1rem; background: var(--secondary); display: flex; align-items: center; justify-content: center; gap: 10px;" 
                        onclick="window.startChat('${crop.owner_id}')">
                  <i class="fa-solid fa-comments"></i> Chat with Farmer
                </button>
                <button class="btn-primary" style="flex: 1; padding: 18px; font-size: 1.1rem;" onclick="window.open('https://wa.me/911234567890?text=Hi, I am interested in your ${crop.name} on KhetGo')">
                  <i class="fa-brands fa-whatsapp"></i> Contact on WhatsApp
                </button>
              </div>
              <h3 style="margin-bottom: 1rem;">Pickup Point</h3>
              <div class="glass-card" style="background: #F9FAFB; padding: 1rem; margin-bottom: 2.5rem; display: flex; align-items: center; gap: 1rem;">
                <i class="fa-solid fa-truck-ramp-box" style="font-size: 1.5rem; color: var(--secondary);"></i>
                <div>
                  <div style="font-weight: 700;">Local Mandi Collection Point</div>
                  <div style="font-size: 0.85rem; color: grey;">Sector 4, Main Mandi, Nagpur</div>
                </div>
              </div>

              <h3 style="margin-bottom: 1.5rem;">Farmer Reviews</h3>
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <div style="font-weight:700; font-size: 0.9rem;">Sunil Kumar</div>
                    <div style="color: #F59E0B;"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i></div>
                  </div>
                  <p style="font-size: 0.85rem; color: var(--text-muted);">Excellent quality! The wheat was very clean and delivered on time. Highly recommended.</p>
                </div>
                <div style="border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                    <div style="font-weight:700; font-size: 0.9rem;">Meena S.</div>
                    <div style="color: #F59E0B;"><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-regular fa-star"></i></div>
                  </div>
                  <p style="font-size: 0.85rem; color: var(--text-muted);">Fresh and organic. Will buy again.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside>
          <div class="glass-card">
            <h3 style="margin-bottom: 1.5rem;">Sold by</h3>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
              <img src="https://ui-avatars.com/api/?name=${crop.farmer || 'Farmer'}&background=1B4332&color=fff&rounded=true" style="width: 60px; height: 60px;">
              <div>
                <div style="font-weight: 700; font-size: 1.1rem;">${crop.farmer || 'Ram Singh'}</div>
                <div class="verified-badge" style="margin-top: 4px; padding: 4px 10px;">
                  <i class="fa-solid fa-certificate"></i> Verified
                </div>
              </div>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5;">
              Farmer from ${crop.location_name || 'Nagpur'} region. Member since 2024. Known for high-quality organic produce.
            </p>
          </div>
        </aside>
      </div>
    </div>
  `;
};

const InboxView = () => {
  // Extract unique users we have chatted with
  const chatPartners = new Map();
  state.messages.forEach(msg => {
    const partnerId = msg.sender_id === state.user.id ? msg.receiver_id : msg.sender_id;
    if (!chatPartners.has(partnerId)) {
      chatPartners.set(partnerId, {
        id: partnerId,
        lastMsg: msg.content,
        time: msg.created_at
      });
    }
  });

  return `
    <div class="fade-in">
      ${Header('Your Inbox')}
      <div class="glass-card" style="padding: 1rem;">
        ${chatPartners.size === 0 ? '<p style="text-align:center; color:grey; padding: 3rem;">No conversations yet. Connect with farmers on the marketplace!</p>' : ''}
        ${Array.from(chatPartners.values()).map(partner => `
          <div class="mandi-item" style="cursor: pointer; padding: 1.5rem;" onclick="window.startChat('${partner.id}')">
            <div style="display:flex; align-items:center; gap:20px;">
              <img src="https://ui-avatars.com/api/?name=User&background=1B4332&color=fff&rounded=true" style="width: 50px; height: 50px;">
              <div>
                <div style="font-weight:700; font-size:1.1rem;">Farmer / Buyer</div>
                <div style="font-size:0.9rem; color:var(--text-muted);">${partner.lastMsg.substring(0, 40)}${partner.lastMsg.length > 40 ? '...' : ''}</div>
              </div>
            </div>
            <div style="text-align:right;">
               <div style="font-size:0.8rem; color:grey;">${new Date(partner.time).toLocaleDateString()}</div>
               <i class="fa-solid fa-chevron-right" style="color: #eee; margin-top: 8px;"></i>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

const ProfileView = () => `
  <div class="fade-in">
    ${Header('Your Profile')}
    <div class="glass-card" style="max-width: 600px; margin: 0 auto;">
      <div style="text-align:center; margin-bottom: 2rem;">
        <img src="https://ui-avatars.com/api/?name=${state.profile?.full_name || 'User'}&background=1B4332&color=fff&size=100" style="border-radius: 30px; margin-bottom: 1rem;">
        <h2>${state.profile?.full_name}</h2>
        <div class="verified-badge" style="display:inline-flex;">${state.profile?.role === 'farmer' ? 'Verified Farmer' : 'Registered Buyer'}</div>
      </div>
      <form id="profile-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
        <div>
          <label style="display:block; font-weight:600; margin-bottom:5px;">Farmer Bio</label>
          <textarea name="bio" style="width:100%; padding:14px; border-radius:12px; border:1px solid #E5E7EB; height:100px;">${state.profile?.bio || ''}</textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display:block; font-weight:600; margin-bottom:5px;">District</label>
            <input type="text" name="district" value="${state.profile?.district || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid #ddd;">
          </div>
          <div>
            <label style="display:block; font-weight:600; margin-bottom:5px;">Pincode</label>
            <input type="text" name="pincode" value="${state.profile?.pincode || ''}" style="width:100%; padding:12px; border-radius:10px; border:1px solid #ddd;">
          </div>
        </div>
        <button type="submit" class="btn-primary">Update Profile</button>
      </form>
    </div>
  </div>
`;

const ForumView = () => {
  return `
    <div class="fade-in">
      ${Header('Community Forum')}
      <div class="dashboard-grid">
        <section>
          ${state.forumPosts.length > 0 ? state.forumPosts.map(post => `
            <div class="glass-card" style="margin-bottom: 1.5rem;">
              <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <img src="https://ui-avatars.com/api/?name=User&background=random" style="width: 40px; border-radius: 50%;">
                <div>
                  <div style="font-weight:700;">Farmer Contributor</div>
                  <div style="font-size: 0.75rem; color: grey;">${new Date(post.created_at).toLocaleDateString()} • <span style="color: var(--secondary);">${post.category || 'General'}</span></div>
                </div>
              </div>
              <h3 style="margin-bottom: 0.5rem;">${post.title}</h3>
              <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">${post.content}</p>
              <div style="margin-top: 1rem; display: flex; gap: 1.5rem; font-size: 0.85rem; color: grey;">
                <span><i class="fa-solid fa-comment"></i> Replies</span>
                <span><i class="fa-solid fa-heart"></i> ${post.likes_count} Likes</span>
              </div>
            </div>
          `).join('') : '<div class="glass-card" style="text-align:center; padding:3rem; color:grey;">Be the first to start a discussion!</div>'}
          <button class="btn-primary" style="width: 100%; border-radius: 50px;" onclick="window.setView('add-post')">Start New Discussion</button>
        </section>
        <aside>
          <div class="glass-card">
            <h3 style="margin-bottom: 1rem;">Top Contributors</h3>
            <p style="color: grey; font-size: 0.85rem;">Active users will appear here.</p>
          </div>
        </aside>
      </div>
    </div>
  `;
};

const NewsView = () => {
  return `
    <div class="fade-in">
      ${Header('Agri-Buzz: Farming News')}
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
        ${state.news.length > 0 ? state.news.map(a => `
          <div class="crop-card">
            <img src="${a.image_url}" class="crop-image" style="height: 180px;">
            <div class="crop-details">
              <span style="font-size: 0.7rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">${a.category}</span>
              <h3 style="font-size: 1.1rem; margin: 8px 0;">${a.title}</h3>
              <div style="font-size: 0.8rem; color: grey; margin-top: auto;">Published ${new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        `).join('') : '<p style="grid-column:1/-1; text-align:center; padding:4rem; color:grey;">No news articles currently. Stay tuned!</p>'}
      </div>
    </div>
  `;
};

const AdvisorView = () => `
  <div class="fade-in">
    ${Header('AI Agri-Advisor')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 2rem; background: #EEF2FF; border: 1px solid #C7D2FE;">
          <h2 style="color: #4338CA; margin-bottom: 1rem;"><i class="fa-solid fa-wand-sparkles"></i> Smart Diagnosis</h2>
          <p style="color: #4B5563;">Describe the issue your crop is facing (e.g., 'Yellow spots on tomato leaves' or 'Pests in wheat field') and our AI will provide instant guidance.</p>
        </div>

        <div class="glass-card">
          <textarea id="advisor-query" style="width:100%; height:150px; padding:1.5rem; border-radius:15px; border:1px solid #ddd; outline:none; font-size:1.05rem;" placeholder="Type your query here..."></textarea>
          <button class="btn-primary" style="width:100%; margin-top:1.5rem; padding:18px;" onclick="window.askAdvisor()">Get Expert Advice</button>
        </div>

        <div id="advisor-result" style="margin-top:2rem;"></div>
      </section>
      <aside>
        <div class="glass-card">
          <h3 style="margin-bottom: 1rem;">Recent Consultations</h3>
          <p style="font-size: 0.85rem; color: grey;">Your previous AI diagnostic reports will appear here.</p>
        </div>
      </aside>
    </div>
  </div>
`;

const KhataView = () => {
  const totalIncome = state.ledgerEntries.filter(e => e.type === 'income').reduce((acc, e) => acc + e.amount, 0);
  const totalExpense = state.ledgerEntries.filter(e => e.type === 'expense').reduce((acc, e) => acc + e.amount, 0);
  const balance = totalIncome - totalExpense;

  return `
    <div class="fade-in">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
        ${Header("Farmer's Digital Khata")}
        <button class="btn-primary" style="background:#1B4332;" onclick="window.exportKhataToPDF()">
          <i class="fa-solid fa-file-pdf"></i> Download Statement
        </button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
        <div class="glass-card" style="border-bottom: 4px solid #10B981;">
          <div style="color: grey; font-size: 0.85rem;">Total Income</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #065F46;">₹${totalIncome.toLocaleString()}</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid #EF4444;">
          <div style="color: grey; font-size: 0.85rem;">Total Expenses</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #991B1B;">₹${totalExpense.toLocaleString()}</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid var(--primary);">
          <div style="color: grey; font-size: 0.85rem;">Net Profit</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">₹${balance.toLocaleString()}</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <section>
          <div class="glass-card" style="margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1.5rem;">Add New Transaction</h3>
            <form id="khata-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
              <input type="text" name="title" placeholder="Description (e.g. Sold Wheat)" required style="padding:12px; border-radius:10px; border:1px solid #ddd;">
              <input type="number" name="amount" placeholder="Amount (₹)" required style="padding:12px; border-radius:10px; border:1px solid #ddd;">
              <select name="type" style="padding:12px; border-radius:10px; border:1px solid #ddd;">
                <option value="income">Income (+)</option>
                <option value="expense">Expense (-)</option>
              </select>
              <button type="submit" class="btn-primary">Record Entry</button>
            </form>
          </div>

          <div class="glass-card">
            <h3 style="margin-bottom: 1.5rem;">Recent Logs</h3>
            ${state.ledgerEntries.map(e => `
              <div class="mandi-item">
                <div>
                  <div style="font-weight:700;">${e.title}</div>
                  <div style="font-size:0.8rem; color:grey;">${new Date(e.created_at).toLocaleDateString()}</div>
                </div>
                <div style="font-weight:800; color: ${e.type === 'income' ? '#10B981' : '#EF4444'};">
                  ${e.type === 'income' ? '+' : '-'} ₹${e.amount}
                </div>
              </div>
            `).join('') || '<p style="text-align:center; color:grey;">No entries found.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;
};

const AcademyView = () => `
  <div class="fade-in">
    ${Header('KhetGo Academy')}
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem;">
      ${state.academyContent.map(v => `
        <div class="crop-card">
          <div style="position:relative;">
            <img src="${v.thumbnail_url}" class="crop-image" style="height:200px;">
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:3rem; color:white; opacity:0.8; cursor:pointer;" onclick="window.open('${v.video_url}')">
              <i class="fa-solid fa-circle-play"></i>
            </div>
          </div>
          <div class="crop-details">
            <span style="font-size:0.75rem; color:var(--secondary); font-weight:700;">${v.category}</span>
            <h3 style="margin: 8px 0; font-size:1.1rem;">${v.title}</h3>
            <p style="font-size:0.85rem; color:grey;">Learn professional techniques to double your yield.</p>
          </div>
        </div>
      `).join('') || '<p>Academy content loading...</p>'}
    </div>
  </div>
`;

window.setLanguage = (lang) => {
  state.language = lang;
  render();
};

window.askAdvisor = async () => {
  const query = document.getElementById('advisor-query').value.trim();
  if (!query) return;
  const resultDiv = document.getElementById('advisor-result');
  resultDiv.innerHTML = '<div class="glass-card">Consulting AI Expert... <i class="fa-solid fa-spinner fa-spin"></i></div>';

  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_HUGGINGFACE_API_KEY;

    if (!apiKey) {
      throw new Error('No AI API key configured. Please add VITE_GEMINI_API_KEY to your .env file.');
    }

    let advice = '';

    // Try Google Gemini first
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert agricultural advisor in India. A farmer asks: "${query}". Provide specific, actionable advice in 3-4 bullet points. Focus on practical solutions for Indian farming conditions.`
            }]
          }]
        })
      });

      const data = await response.json();
      advice = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate advice at this time.';
    }
    // Fallback to HuggingFace
    else if (import.meta.env.VITE_HUGGINGFACE_API_KEY) {
      const response = await fetch('https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: `As an agricultural expert, provide advice for: ${query}`
        })
      });

      const data = await response.json();
      advice = data.generated_text || data[0]?.generated_text || 'Unable to generate advice.';
    }

    resultDiv.innerHTML = `
      <div class="glass-card fade-in" style="border-left: 5px solid var(--primary);">
        <h3 style="margin-bottom: 1rem;"><i class="fa-solid fa-robot"></i> AI Expert Recommendation</h3>
        <p style="line-height:1.6;"><strong>Your Query:</strong> "${query}"</p>
        <div style="background: #F0FDF4; padding: 1.5rem; border-radius: 12px; margin: 1rem 0; line-height: 1.8;">
          ${advice.replace(/\n/g, '<br>')}
        </div>
        <div style="font-size: 0.75rem; color: grey; font-style: italic; margin-top: 1rem;">
          ⚠️ Powered by AI. Always consult local agricultural experts for critical decisions.
        </div>
      </div>
    `;
  } catch (error) {
    console.error('AI Advisor Error:', error);
    resultDiv.innerHTML = `
      <div class="glass-card" style="border-left: 5px solid #EF4444;">
        <h3 style="color: #EF4444;">⚠️ Connection Issue</h3>
        <p style="line-height:1.6;">
          ${error.message.includes('API key')
        ? 'AI service not configured. Please add your API key to environment variables.'
        : 'Unable to reach AI service. Please check your internet connection and try again.'}
        </p>
        <details style="margin-top: 1rem; font-size: 0.85rem; color: grey;">
          <summary style="cursor: pointer;">Technical Details</summary>
          <pre style="margin-top: 0.5rem; padding: 1rem; background: #f9f9f9; border-radius: 8px; overflow-x: auto;">${error.message}</pre>
        </details>
      </div>
    `;
  }
};

window.exportKhataToPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor(27, 67, 50);
  doc.text("KhetGo: Financial Statement", 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Farmer: ${state.profile?.full_name || 'Anonymous'}`, 14, 35);

  const tableData = state.ledgerEntries.map(e => [
    new Date(e.created_at).toLocaleDateString(),
    e.title,
    e.type.toUpperCase(),
    `Rs. ${e.amount.toLocaleString()}`
  ]);

  doc.autoTable({
    startY: 45,
    head: [['Date', 'Description', 'Type', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [27, 67, 50] }
  });

  const totalIncome = state.ledgerEntries.filter(e => e.type === 'income').reduce((acc, e) => acc + e.amount, 0);
  const totalExpense = state.ledgerEntries.filter(e => e.type === 'expense').reduce((acc, e) => acc + e.amount, 0);
  const finalY = doc.lastAutoTable.finalY + 10;

  doc.text(`Total Income: Rs. ${totalIncome.toLocaleString()}`, 14, finalY);
  doc.text(`Total Expense: Rs. ${totalExpense.toLocaleString()}`, 14, finalY + 5);
  doc.text(`Net Balance: Rs. ${(totalIncome - totalExpense).toLocaleString()}`, 14, finalY + 10);

  doc.save(`KhetGo_Statement_${state.profile?.full_name || 'Farmer'}.pdf`);
  showNotification("Statement Ready", "Your financial report has been downloaded.");
};

const AdminView = () => `
  <div class="fade-in">
    ${Header('Platform Moderation')}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
      <div class="glass-card">
        <div style="color: grey; font-size: 0.8rem;">Total Active Listings</div>
        <div style="font-size: 2rem; font-weight: 800;">${state.cropListings.length}</div>
      </div>
      <div class="glass-card">
        <div style="color: grey; font-size: 0.8rem;">Platform Users</div>
        <div style="font-size: 2rem; font-weight: 800;">${state.cropListings.length + 5}</div>
      </div>
      <div class="glass-card">
        <div style="color: grey; font-size: 0.8rem;">Active Orders</div>
        <div style="font-size: 2rem; font-weight: 800;">${state.myBookings.length}</div>
      </div>
    </div>
    <div class="glass-card">
      <h2 style="margin-bottom: 1.5rem;">System Overview</h2>
      <p style="color: grey;">Admin tools are active. You have full moderation rights over all listings and profiles.</p>
    </div>
  </div>
`;

const ChatView = () => {
  if (!state.activeChat) return '<div class="fade-in">Select a user to start chatting.</div>';

  return `
    <div class="fade-in">
      ${Header(`Chat with ${state.activeChat.full_name}`)}
      <div class="glass-card" style="height: 65vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">
        <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: #fafafa;">
          ${state.messages.map(msg => {
    const isMe = msg.sender_id === state.user.id;
    return `
              <div style="max-width: 75%; padding: 12px 16px; border-radius: 18px; font-size: 0.95rem; 
                          ${isMe ? 'align-self: flex-end; background: var(--primary); color: white; border-bottom-right-radius: 4px;' : 'align-self: flex-start; background: white; border: 1px solid #E5E7EB; color: var(--text-main); border-bottom-left-radius: 4px;'}">
                ${msg.content}
                <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 4px; text-align: ${isMe ? 'right' : 'left'};">
                  ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            `;
  }).join('') || '<div style="text-align:center; color:grey; margin-top:2rem;">No messages yet. Send a greeting!</div>'}
        </div>
        <div style="padding: 1.25rem; background: white; border-top: 1px solid #E5E7EB; display: flex; gap: 1rem;">
          <input type="text" id="chat-input" placeholder="Type your message..." style="flex: 1; padding: 14px; border-radius: 12px; border: 1px solid #E5E7EB; outline: none;">
          <button class="btn-primary" onclick="window.sendMessage()">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `;
};

// --- Global Handlers ---
window.startChat = async (userId) => {
  const { data: targetProfile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) return alert('Profile not found');
  state.activeChat = targetProfile;
  state.currentView = 'chat';
  await fetchMessages(userId);
  render();
  const chatBox = document.getElementById('chat-messages');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
};

window.sendMessage = async () => {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim() || !state.activeChat) return;

  const content = input.value.trim();
  input.value = '';

  const { error } = await supabase.from('messages').insert([{
    sender_id: state.user.id,
    receiver_id: state.activeChat.id,
    content: content
  }]);

  if (error) alert(error.message);
};

window.setView = (view) => {
  state.currentView = view;
  render();
};

window.showListing = (id) => {
  state.viewData = id;
  state.currentView = 'listing-detail';
  render();
};

window.deleteItem = async (id) => {
  if (!confirm('Permanent delete this listing?')) return;
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (!error) fetchAllData();
};

window.placeOrder = async (listingId) => {
  const crop = state.cropListings.find(c => c.id === listingId);
  if (!crop) return;

  const { error } = await supabase.from('bookings').insert([{
    user_id: state.user.id,
    item_name: crop.name,
    item_type: 'Produce',
    price_per_unit: crop.price,
    status: 'pending'
  }]);

  if (error) alert(error.message);
  else {
    alert('Order placed successfully! The farmer will contact you soon.');
    window.setView('my-activity');
    fetchAllData();
  }
};

window.bookService = async (itemName, price) => {
  const confirmBooking = confirm(`Rent ${itemName} for ₹${price} per day?`);
  if (!confirmBooking) return;

  const { error } = await supabase.from('bookings').insert([{
    user_id: state.user.id,
    item_name: itemName,
    item_type: 'Service',
    price_per_unit: price,
    status: 'confirmed'
  }]);

  if (error) alert(error.message);
  else {
    alert('Booking confirmed! The provider will contact you shortly.');
    window.setView('my-activity');
    fetchAllData();
  }
};

window.resetFilters = () => {
  state.filters = { pincode: '', minPrice: 0, maxPrice: 10000, sortBy: 'newest' };
  render();
};

window.logout = async () => {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
  window.setView('login');
};

// --- Core Engine ---
function render() {
  const app = document.querySelector('#app');

  // Auth Redirect
  if (!state.user && !['login', 'signup'].includes(state.currentView)) {
    state.currentView = 'login';
  }

  if (state.isLoading && !state.cropListings.length) {
    app.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; width:100%; background:var(--background);">
        <i class="fa-solid fa-leaf fa-spin" style="font-size:3rem; color:var(--primary); margin-bottom:1rem;"></i>
        <h2 style="color:var(--primary);">Syncing KhetGo...</h2>
      </div>
    `;
    return;
  }

  let content = '';
  switch (state.currentView) {
    case 'login': content = LoginView(); break;
    case 'signup': content = SignupView(); break;
    case 'dashboard': content = DashboardView(); break;
    case 'marketplace': content = MarketplaceView(); break;
    case 'add-listing': content = AddListingView(); break;
    case 'my-activity': content = ActivityView(); break;
    case 'listing-detail': content = ProductDetailView(state.viewData); break;
    case 'chat': content = ChatView(); break;
    case 'inbox': content = InboxView(); break;
    case 'forum': content = ForumView(); break;
    case 'advisor': content = AdvisorView(); break;
    case 'khata': content = KhataView(); break;
    case 'academy': content = AcademyView(); break;
    case 'profile': content = ProfileView(); break;
    case 'news': content = NewsView(); break;
    case 'agri-store': content = AgriStoreView(); break;
    case 'soil-testing': content = SoilTestingView(); break;
    case 'admin': content = AdminView(); break;
    case 'mandi-markets': content = MandiMarketsView(); break;
    case 'services': content = ServicesView(); break;
    default: content = DashboardView();
  }

  app.innerHTML = `
    ${state.user ? Sidebar() : ''}
    <main class="main-content" style="${!state.user ? 'margin-left: 0; width: 100%;' : ''}">
      ${content}
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  // Navigation
  document.querySelectorAll('.nav-links .nav-link').forEach(link => {
    link.onclick = () => window.setView(link.dataset.view);
  });

  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(loginForm);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: d.get('email'),
        password: d.get('password'),
      });
      if (error) alert(error.message);
      else {
        await checkAuth();
        window.setView('dashboard');
        fetchAllData();
      }
    };
  }

  // Signup Form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(signupForm);
      const { data, error } = await supabase.auth.signUp({
        email: d.get('email'),
        password: d.get('password'),
        options: {
          data: {
            full_name: d.get('full_name'),
            role: d.get('role'),
          }
        }
      });
      if (error) alert(error.message);
      else {
        alert('Welcome! Profile created. Please check your email for confirmation.');
        window.setView('login');
      }
    };
  }

  // Dynamic Search
  const search = document.getElementById('global-search');
  if (search) {
    search.oninput = (e) => {
      const cursorPosition = e.target.selectionStart;
      state.searchQuery = e.target.value;
      render();
      // Re-focus and restore cursor position after render
      const searchAfterRender = document.getElementById('global-search');
      if (searchAfterRender && document.activeElement === document.body) {
        searchAfterRender.focus();
        searchAfterRender.setSelectionRange(cursorPosition, cursorPosition);
      }
    };
  }

  // Filter
  const pFilter = document.getElementById('filter-pincode');
  if (pFilter) {
    pFilter.oninput = (e) => {
      state.filters.pincode = e.target.value;
      render();
      document.getElementById('filter-pincode').focus();
    };
  }

  // Form Submission
  const form = document.getElementById('listing-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const publishBtn = document.getElementById('publish-btn');
      const imageInput = document.getElementById('listing-images');

      const d = new FormData(form);
      publishBtn.disabled = true;
      publishBtn.innerHTML = 'Uploading... <i class="fa-solid fa-spinner fa-spin"></i>';

      let imageUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';

      // Handle Image Upload to Supabase Storage
      if (imageInput && imageInput.files.length > 0) {
        const file = imageInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${state.user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('listings')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('listings')
            .getPublicUrl(filePath);
          imageUrl = publicUrl;
        }
      }

      const payload = {
        name: d.get('name'),
        price: parseFloat(d.get('price')),
        unit: d.get('unit'),
        quantity: d.get('quantity'),
        category: d.get('category'),
        description: d.get('description'),
        pincode: d.get('pincode'),
        owner_id: state.user.id,
        is_verified: state.profile?.is_verified || false,
        image_url: imageUrl,
        lat: state.location?.lat || null,
        lng: state.location?.lng || null
      };

      const { error } = await supabase.from('listings').insert([payload]);
      if (!error) {
        showNotification("Success!", "Your crop listing is now live.");
        alert('Listing live on KhetGo!');
        window.setView('marketplace');
      } else {
        alert('Error: ' + error.message);
        publishBtn.disabled = false;
        publishBtn.innerText = 'Publish to Marketplace';
      }
    };
  }
  // Chat Input Enter Key
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.onkeypress = (e) => {
      if (e.key === 'Enter') window.sendMessage();
    };
  }

  // Price Range
  const priceRange = document.getElementById('price-range');
  if (priceRange) {
    priceRange.oninput = (e) => {
      state.filters.maxPrice = parseInt(e.target.value);
      render();
    };
  }

  // Sort
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      state.filters.sortBy = e.target.value;
      render();
    };
  }

  // Profile Form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(profileForm);
      const { error } = await supabase.from('profiles').update({
        bio: d.get('bio'),
        district: d.get('district'),
        pincode: d.get('pincode')
      }).eq('id', state.user.id);

      if (!error) {
        alert('Profile Updated!');
        checkAuth();
      }
    };
  }

  // Dashboard & Market Charts
  initCharts();

  // Khata Form
  const khataForm = document.getElementById('khata-form');
  if (khataForm) {
    khataForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(khataForm);
      const { error } = await supabase.from('ledger_entries').insert([{
        user_id: state.user.id,
        title: d.get('title'),
        amount: parseFloat(d.get('amount')),
        type: d.get('type')
      }]);
      if (!error) {
        alert('Entry Recorded!');
        fetchAllData();
      }
    };
  }
}

function initCharts() {
  const miniCtx = document.getElementById('mandi-mini-chart');
  if (miniCtx) {
    new Chart(miniCtx, {
      type: 'line',
      data: {
        labels: ['1 Jan', '3 Jan', '5 Jan', '7 Jan', '9 Jan', '11 Jan', '13 Jan'],
        datasets: [{
          label: 'Wheat Price',
          data: [2300, 2350, 2320, 2400, 2450, 2430, 2450],
          borderColor: '#1B4332',
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: 'rgba(27, 67, 50, 0.1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  const largeCtx = document.getElementById('mandi-large-chart');
  if (largeCtx) {
    new Chart(largeCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Market Average (₹/Qtl)',
          data: [2100, 2250, 2300, 2200, 2150, 2400, 2600, 2550, 2450, 2600, 2700, 2800],
          borderColor: '#2D6A4F',
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(45, 106, 79, 0.05)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: false, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }
      }
    });
  }
}

// --- Kickoff ---
(async () => {
  await checkAuth();
  if (state.user) fetchAllData();
  render();
})();
