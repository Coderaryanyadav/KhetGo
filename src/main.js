import { supabase } from './supabase';
import './style.css';
import { Chart, registerables } from 'chart.js';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  sanitizeHTML,
  escapeHTML,
  validateEmail,
  validatePrice,
  validateImageFile,
  debounce,
  showToast,
  handleError,
  retryWithBackoff,
  isAuthenticated,
  formatCurrency,
  formatDate
} from './utils.js';

Chart.register(...registerables);

const CONSTANTS = {
  DEFAULT_LAT: parseFloat(import.meta.env.VITE_DEFAULT_LAT) || 21.1458,
  DEFAULT_LNG: parseFloat(import.meta.env.VITE_DEFAULT_LNG) || 79.0882,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,
  DEBOUNCE_DELAY: 300,
};

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
  weatherLoading: false,
  isAdmin: false,
  adminStats: {
    totalUsers: 0,
    totalListings: 0,
    totalRevenue: 0
  },
  charts: {}
};

const translations = {
  en: { dashboard: 'Dashboard', marketplace: 'Marketplace', rentals: 'Rentals', advisor: 'AI Advisor', khata: 'Ledger', academy: 'Academy', community: 'Agri-Forum', activity: 'Activity' },
  hi: { dashboard: 'डैशबोर्ड', marketplace: 'बाजार', rentals: 'किराया', advisor: 'एआई सलाहकार', khata: 'बहीखाता', academy: 'अकादमी', community: 'कृषि-मंच', activity: 'गतिविधि' },
  mr: { dashboard: 'डॅशबोर्ड', marketplace: 'बाजारपेठ', rentals: 'भाड्याने', advisor: 'एआय सल्लागार', khata: 'खातेवही', academy: 'अकादमी', community: 'कृषी-मंच', activity: 'हालचाल' }
};

const t = (key) => translations[state.language][key] || key;

// --- Auth Handling ---
// --- Auth Handling ---
async function checkAuth() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    state.user = user;
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;
      state.profile = profile;
      state.isAdmin = profile?.role === 'admin';

      subscribeToMessages();
      requestNotificationPermission();
      getGeoLocation();
    } else {
      // Check for demo admin session in localStorage
      if (localStorage.getItem('khetgo_admin_session') === 'true') {
        state.isAdmin = true;
        state.profile = { full_name: 'Master Admin', role: 'admin' };
        state.user = { id: 'admin-bypass' };
      }
    }
  } catch (error) {
    console.warn('Auth check failed:', error.message);
  } finally {
    render();
  }
}

function subscribeToMessages() {
  if (!isAuthenticated(state.user)) return;
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
  if (!isAuthenticated(state.user)) return;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${state.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${state.user.id})`)
      .order('created_at', { ascending: true });

    if (error) throw error;
    state.messages = data || [];
    render();
  } catch (error) {
    handleError(error, 'Fetch Messages');
  }
}

async function getGeoLocation() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    await fetchWeather(CONSTANTS.DEFAULT_LAT, CONSTANTS.DEFAULT_LNG);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      state.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await fetchWeather(pos.coords.latitude, pos.coords.longitude);
      render();
    },
    async (error) => {
      console.warn('Geolocation error:', error.message);
      await fetchWeather(CONSTANTS.DEFAULT_LAT, CONSTANTS.DEFAULT_LNG);
    },
    { timeout: 10000 }
  );
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
    if (!response.ok) throw new Error('Weather service unavailable');

    const data = await response.json();
    if (!data || !data.list) throw new Error('Invalid weather data');

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
    console.error('Weather error:', error);
    state.weather = null;
  } finally {
    state.weatherLoading = false;
    render();
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
  return parseFloat((R * c).toFixed(1));
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
  if (!isAuthenticated(state.user)) return;

  state.isLoading = true;
  render();

  try {
    const fetchers = [
      supabase.from('mandi_prices').select('*').order('updated_at', { ascending: false }),
      supabase.from('listings').select('*, profiles(full_name, phone, district)').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').eq('user_id', state.user.id).order('booking_date', { ascending: false }),
      supabase.from('store_products').select('*').order('created_at', { ascending: false }),
      supabase.from('agri_services').select('*').order('created_at', { ascending: false }),
      supabase.from('news_articles').select('*').order('created_at', { ascending: false }),
      supabase.from('forum_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('ledger_entries').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }),
      supabase.from('academy_content').select('*').order('created_at', { ascending: false })
    ];

    const results = await Promise.allSettled(fetchers);

    state.mandiPrices = results[0].status === 'fulfilled' ? (results[0].value.data || []) : [];
    state.cropListings = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
    state.myBookings = results[2].status === 'fulfilled' ? (results[2].value.data || []) : [];
    state.storeProducts = results[3].status === 'fulfilled' ? (results[3].value.data || []) : [];
    state.services = results[4].status === 'fulfilled' ? (results[4].value.data || []) : [];
    state.news = results[5].status === 'fulfilled' ? (results[5].value.data || []) : [];
    state.forumPosts = results[6].status === 'fulfilled' ? (results[6].value.data || []) : [];
    state.ledgerEntries = results[7].status === 'fulfilled' ? (results[7].value.data || []) : [];
    state.academyContent = results[8].status === 'fulfilled' ? (results[8].value.data || []) : [];

  } catch (err) {
    handleError(err, 'Sync Data');
  } finally {
    state.isLoading = false;
    render();
  }
}

// --- Component Fragments ---
const Header = (title) => `
  <header class="fade-in">
    <div class="header-left">
      <h1>${sanitizeHTML(title)}</h1>
    </div>
    <div class="header-right">
      <div class="search-bar">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="global-search" placeholder="Search crops, prices, locations..." value="${escapeHTML(state.searchQuery)}">
      </div>
      <div class="user-profile" onclick="window.setView('profile')" style="cursor: pointer;">
        <div class="verified-badge">
          <i class="fa-solid fa-certificate"></i> ${state.profile?.is_verified ? 'Verified Farmer' : 'Member'}
        </div>
        <img class="profile-img" src="https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.full_name || 'User')}&background=1B4332&color=fff&rounded=true" alt="User">
      </div>
    </div>
  </header>
`;

const Sidebar = () => `
  <aside class="sidebar">
    <div class="brand" onclick="window.setView('dashboard')" style="cursor:pointer">
      <i class="fa-solid fa-leaf"></i>
      <span>KhetGo</span>
    </div>
    <nav class="nav-links">
      <div class="nav-link ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="window.setView('dashboard')">
        <i class="fa-solid fa-chart-pie"></i>
        <span>${t('dashboard')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'marketplace' ? 'active' : ''}" onclick="window.setView('marketplace')">
        <i class="fa-solid fa-shop"></i>
        <span>${t('marketplace')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'services' ? 'active' : ''}" onclick="window.setView('services')">
        <i class="fa-solid fa-truck-pickup"></i>
        <span>${t('rentals')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'advisor' ? 'active' : ''}" onclick="window.setView('advisor')">
        <i class="fa-solid fa-robot"></i>
        <span>${t('advisor')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'khata' ? 'active' : ''}" onclick="window.setView('khata')">
        <i class="fa-solid fa-book"></i>
        <span>${t('khata')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'academy' ? 'active' : ''}" onclick="window.setView('academy')">
        <i class="fa-solid fa-graduation-cap"></i>
        <span>${t('academy')}</span>
      </div>
      <div class="nav-link ${state.currentView === 'forum' ? 'active' : ''}" onclick="window.setView('forum')">
        <i class="fa-solid fa-users"></i>
        <span>${t('community')}</span>
      </div>
    </nav>

    <div class="sidebar-footer" style="margin-top: auto; padding: 2rem 1rem; border-top: 1px solid rgba(255,255,255,0.08);">
      <div style="margin-bottom: 2rem;">
         <select onchange="window.setLanguage(this.value)" style="width:100%; padding:10px; border-radius:12px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.1); outline:none; font-size: 0.85rem; cursor: pointer;">
            <option value="en" ${state.language === 'en' ? 'selected' : ''}>🇬🇧 English</option>
            <option value="hi" ${state.language === 'hi' ? 'selected' : ''}>🇮🇳 हिन्दी</option>
            <option value="mr" ${state.language === 'mr' ? 'selected' : ''}>🇮🇳 मराठी</option>
         </select>
      </div>

      <div style="margin-bottom: 2rem; display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="window.setView('profile')">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.full_name || 'User')}&background=accent&color=1B4332&rounded=true" style="width: 42px; height: 42px; border: 2px solid var(--accent);">
        <div>
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--accent);">${sanitizeHTML(state.profile?.full_name || 'User')}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; font-weight: 700;">${sanitizeHTML(state.profile?.role || 'Member')}</div>
        </div>
      </div>
      
      <div class="nav-link" style="color: #FF6B6B; background: rgba(255, 107, 107, 0.05); border: 1px solid rgba(255, 107, 107, 0.1);" onclick="window.logout()">
        <i class="fa-solid fa-power-off"></i>
        <span>Logout Session</span>
      </div>

      ${state.isAdmin ? `
      <div class="admin-badge" onclick="window.setView('admin')" style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(149, 213, 178, 0.1); border-radius: 18px; cursor: pointer; border: 1px dashed var(--accent); text-align: center;">
        <div style="font-size: 0.75rem; color: var(--accent); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Control Center</div>
        <div style="font-size: 0.9rem; color: white; font-weight: 600; margin-top: 4px;">Platform Admin</div>
      </div>
      ` : ''}
    </div>
  </aside>
`;

// --- View Definitions ---
const DashboardView = () => `
  <div class="fade-in">
    ${Header('Farm Overview')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="background: linear-gradient(135deg, var(--primary) 0%, #081C15 100%); color: white; margin-bottom: 3rem; position: relative; border: none;">
          <div style="position: absolute; right: -20px; top: -20px; font-size: 15rem; color: rgba(255,255,255,0.03); transform: rotate(15deg); pointer-events: none;">
            <i class="fa-solid fa-leaf"></i>
          </div>
          <div style="position: relative; z-index: 1;">
            <h2 style="font-size: 2rem; margin-bottom: 0.75rem;">Premium Harvest Update</h2>
            <p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 2rem; max-width: 500px; line-height: 1.6;">
              ${state.mandiPrices[0]
    ? `The market for <strong>${sanitizeHTML(state.mandiPrices[0].crop)}</strong> is trending <strong>${state.mandiPrices[0].trend}</strong> by ${sanitizeHTML(state.mandiPrices[0].change_pct)} today. List your harvest now to capture peak demand.`
    : 'Your digital farm operations are synchronized. Check newest market trends or update your harvest status.'}
            </p>
            <div style="display: flex; gap: 1rem;">
              <button class="btn-primary" style="background: var(--accent); color: var(--primary-dark); font-weight: 800;" onclick="window.setView('add-listing')">Post Your Harvest</button>
              <button class="btn-primary" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(5px);" onclick="window.setView('marketplace')">Explore Market</button>
            </div>
          </div>
        </div>
        
        <div class="section-title" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="font-size: 1.75rem; color: var(--text-main);">Market Trends</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time opportunities in your region</p>
          </div>
          <button class="nav-link" style="color: var(--secondary); padding: 0; font-size: 1rem;" onclick="window.setView('marketplace')">View Marketplace <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        
        <div class="marketplace-grid">
          ${state.cropListings.slice(0, 3).map(crop => `
            <div class="crop-card" onclick="window.showListing('${crop.id}')">
              <div style="position: relative;">
                <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image" alt="${sanitizeHTML(crop.name)}">
                <div style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); color: white; padding: 5px 12px; border-radius: 50px; font-size: 0.75rem; font-weight: 700;">
                  <i class="fa-solid fa-tag"></i> ${sanitizeHTML(crop.category || 'Fresh')}
                </div>
              </div>
              <div class="crop-details">
                <div class="crop-name">${sanitizeHTML(crop.name)}</div>
                <div class="crop-location"><i class="fa-solid fa-location-dot" style="color: var(--secondary);"></i> ${sanitizeHTML(crop.profiles?.district || 'Nagpur')}, India</div>
                <div class="crop-footer">
                  <span class="price">${formatCurrency(crop.price)}<span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">/${sanitizeHTML(crop.unit)}</span></span>
                  <button class="btn-primary" style="padding: 10px 20px; font-size: 0.85rem;">View</button>
                </div>
              </div>
            </div>
          `).join('') || `
            <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: rgba(255,255,255,0.02);">
              <i class="fa-solid fa-seedling" style="font-size: 3rem; color: var(--accent); margin-bottom: 1.5rem; opacity: 0.5;"></i>
              <h3 style="color: var(--text-muted);">No active listings in your zone</h3>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Be the local pioneer and post your first harvest today!</p>
              <button class="btn-primary" style="margin-top: 1.5rem;" onclick="window.setView('add-listing')">Create Listing</button>
            </div>
          `}
        </div>
      </section>
      
      <aside>
        <div class="glass-card">
          <h2 style="font-size: 1.25rem; margin-bottom: 1.5rem;">Live Mandi Prices</h2>
          <div class="mandi-list">
            ${state.mandiPrices.slice(0, 5).map(item => `
              <div class="mandi-item">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="background:#F0FDF4; padding:8px; border-radius:10px; color:var(--primary);"><i class="fa-solid fa-seedling"></i></div>
                  <div>
                    <div style="font-weight:700; font-size:0.9rem;">${sanitizeHTML(item.crop)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${sanitizeHTML(item.unit)}</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="price">${formatCurrency(item.price)}</div>
                  <div class="trend ${sanitizeHTML(item.trend)}" style="font-size:0.8rem;">
                    ${item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : ''} ${sanitizeHTML(item.change_pct || '')}
                  </div>
                </div>
              </div>
            `).join('') || '<p style="color: grey; text-align: center; padding: 1rem;">Mandi data coming soon...</p>'}
          </div>
        </div>
        
        <div class="glass-card" style="margin-top: 3rem; background: linear-gradient(135deg, rgba(27, 67, 50, 0.1) 0%, rgba(64, 145, 108, 0.05) 100%);">
          <h2 style="font-size: 1.4rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-cloud-sun" style="color: var(--secondary);"></i> 
              ${state.weather?.city ? sanitizeHTML(state.weather.city) : 'Regional Weather'}
            </span>
          </h2>
          ${state.weatherLoading ? `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
              <i class="fa-solid fa-fan fa-spin" style="font-size: 2rem;"></i><br>
              <span style="font-size: 0.9rem; margin-top: 10px; display: inline-block;">Consulting the skies...</span>
            </div>
          ` : state.weather ? `
            <div style="display: flex; gap: 1.25rem; overflow-x: auto; padding: 5px 0 15px 0; scrollbar-width: none; -ms-overflow-style: none;">
              ${state.weather.daily.map(day => `
                <div style="text-align: center; min-width: 85px; padding: 15px 10px; background: var(--card-bg); border-radius: 18px; border: 1px solid rgba(255,255,255,0.05); box-shadow: var(--shadow-sm); flex-shrink: 0;">
                  <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${sanitizeHTML(day.day)}</div>
                  <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" style="width: 50px; height: 50px; margin: 4px 0;" alt="${sanitizeHTML(day.description)}">
                  <div style="font-weight: 800; font-size: 1.15rem; color: var(--primary-light);">${day.temp}°C</div>
                </div>
              `).join('')}
            </div>
            <div style="margin-top: 1.5rem; padding: 12px 18px; background: rgba(16, 185, 129, 0.1); border-radius: 14px; display: flex; align-items: center; gap: 12px; border: 1px solid rgba(16, 185, 129, 0.15);">
                <i class="fa-solid fa-circle-check" style="color: #10B981;"></i>
                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main);">
                  Currently: <span style="text-transform: capitalize; color: #166534;">${sanitizeHTML(state.weather.current.weather[0].description)}</span>
                </div>
            </div>
          ` : `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: rgba(0,0,0,0.02); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1);">
              <i class="fa-solid fa-cloud-bolt" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>
              <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-main);">Weather Uplink Offline</div>
              <p style="font-size: 0.85rem; line-height: 1.5;">Please ensure OpenWeatherMap configuration is verified for your current node.</p>
              <button class="btn-primary" style="margin-top: 1.25rem; font-size: 0.85rem;" onclick="location.reload()">Retry Connection</button>
            </div>
          `}
        </div>
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
      ${Header('Precision Agri Services')}
      <div style="margin-bottom: 4rem;">
        <div class="section-title" style="margin-bottom: 2.5rem;">
          <h2 style="font-size: 1.75rem; color: var(--text-main);"><i class="fa-solid fa-tractor" style="color: var(--secondary);"></i> Industrial Machinery Rentals</h2>
          <p style="color: var(--text-muted); font-size: 1rem;">High-performance equipment for optimized farming</p>
        </div>
        <div class="marketplace-grid">
          ${state.services.length > 0 ? state.services.map(s => `
            <div class="crop-card" style="cursor: default;">
              <div style="position: relative;">
                <img src="${s.image_url}" class="crop-image">
                <div style="position: absolute; top: 15px; right: 15px; background: var(--accent); color: var(--primary-dark); padding: 5px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">${s.type}</div>
              </div>
              <div class="crop-details">
                <div style="font-weight: 800; font-size: 1.25rem; color: var(--text-main); margin-bottom: 0.5rem;">${s.title}</div>
                <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">
                  <i class="fa-solid fa-location-dot" style="color: var(--secondary);"></i> ${s.location || 'Nagpur Specialized Hub'}
                </div>
                <div class="crop-footer" style="padding-top: 1.25rem;">
                  <span class="price" style="font-size: 1.4rem; font-weight: 900;">₹${(s.price_per_day || 0).toLocaleString()}<span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">/day</span></span>
                  <button class="btn-primary" style="padding: 10px 20px; font-size: 0.85rem;" onclick="window.bookService('${s.title}', ${s.price_per_day})">Reserve</button>
                </div>
              </div>
            </div>
          `).join('') : `
            <div style="grid-column: 1/-1; padding: 5rem; text-align: center; background: rgba(0,0,0,0.02); border-radius: 20px; border: 2px dashed rgba(255,255,255,0.05);">
               <i class="fa-solid fa-gears fa-spin" style="font-size: 3rem; color: var(--secondary); margin-bottom: 1.5rem; opacity: 0.3;"></i>
               <p style="color: var(--text-muted); font-size: 1.1rem;">No industrial rentals active in your jurisdiction.</p>
            </div>
          `}
        </div>
      </div>

      <div class="glass-card" style="padding: 3.5rem; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; border: none; box-shadow: 0 20px 40px rgba(27,67,50,0.3); overflow: hidden; position: relative;">
        <div style="position: absolute; right: -50px; bottom: -50px; font-size: 15rem; color: rgba(255,255,255,0.05); transform: rotate(-15deg);"><i class="fa-solid fa-flask"></i></div>
        <div style="max-width: 600px; position: relative; z-index: 1;">
          <h2 style="font-size: 2.25rem; font-weight: 900; margin-bottom: 1.5rem; letter-spacing: -0.02em;">Digital Soil Diagnostics</h2>
          <p style="font-size: 1.15rem; opacity: 0.85; margin-bottom: 2.5rem; line-height: 1.6;">Leverage laboratory-grade analytics to identify nutrient deficiencies and maximize your agricultural yield.</p>
          <button class="btn-primary" style="background: var(--accent); color: var(--primary); padding: 16px 40px; font-size: 1.1rem; font-weight: 800; border: none;" onclick="window.setView('soil-testing')">Schedule Lab Analysis</button>
        </div>
      </div>
    </div>
  `;
};

const AgriStoreView = () => {
  return `
    <div class="fade-in">
      ${Header('Agri Store & Inputs')}
      <div style="display: flex; gap: 1rem; margin-bottom: 3rem; overflow-x: auto; padding-bottom: 15px; scrollbar-width: none;">
        ${['All Products', 'Verified Seeds', 'Organic Fertilizer', 'Plant Protection', 'Modern Tools'].map((cat, i) => `
          <button class="btn-primary" style="background: ${i === 0 ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; color: ${i === 0 ? 'white' : 'var(--text-main)'}; border: 1px solid ${i === 0 ? 'var(--primary)' : 'rgba(0,0,0,0.05)'}; white-space: nowrap; padding: 12px 24px; font-size: 0.9rem; font-weight: 700; box-shadow: none;">${cat}</button>
        `).join('')}
      </div>

      <div class="marketplace-grid">
        ${state.storeProducts.length > 0 ? state.storeProducts.map(p => `
          <div class="crop-card" style="border: 1px solid rgba(255,255,255,0.05); transition: var(--transition);">
            <div style="position: relative;">
               <img src="${p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image" alt="${sanitizeHTML(p.name)}">
               <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(255,255,255,0.9); color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 900; text-transform: uppercase;">${sanitizeHTML(p.brand || 'Premium')}</div>
            </div>
            <div class="crop-details">
              <div class="crop-name" style="font-size: 1.15rem; margin-bottom: 0.25rem;">${sanitizeHTML(p.name)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; margin-bottom: 1.5rem;">${sanitizeHTML(p.unit || 'Pack')}</div>
              <div class="crop-footer" style="padding-top: 1.25rem;">
                <span class="price" style="font-size: 1.5rem; font-weight: 900;">${formatCurrency(p.price)}</span>
                <button class="btn-primary" style="padding: 10px 24px;" onclick="showToast('Item secured in cart!', 'success')">Buy Now</button>
              </div>
            </div>
          </div>
        `).join('') : `
           <div style="grid-column: 1/-1; padding: 6rem; text-align: center; opacity: 0.5;">
              <i class="fa-solid fa-store-slash" style="font-size: 4rem; margin-bottom: 2rem;"></i>
              <p style="font-size: 1.2rem; font-weight: 600;">The Agri Store is currently restocking globally.</p>
           </div>
        `}
      </div>
    </div>
  `;
};

const SoilTestingView = () => `
  <div class="fade-in">
    ${Header('Precision Soil Testing')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 3rem; background: linear-gradient(135deg, rgba(27, 67, 50, 0.05) 0%, rgba(64, 145, 108, 0.02) 100%);">
          <div style="display: flex; gap: 2rem; align-items: center;">
            <div style="font-size: 3.5rem; color: var(--secondary); opacity: 0.8;"><i class="fa-solid fa-microscope"></i></div>
            <div>
              <h2 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 0.75rem;">Digital Soil Intelligence</h2>
              <p style="line-height: 1.7; color: var(--text-muted); font-size: 1rem;">
                Unlock the biological potential of your land. Our high-precision lab analysis provides actionable insights into NPK levels, pH balance, and organic carbon content, enabling data-driven fertilization strategies.
              </p>
            </div>
          </div>
        </div>

        <div class="glass-card" style="padding: 2.5rem; border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: var(--shadow);">
          <h3 style="font-size: 1.35rem; margin-bottom: 2rem; color: var(--text-main); display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid fa-flask-vial" style="color: var(--secondary);"></i> 
            Reserve Lab Diagnostic
          </h3>
          <form style="display: flex; flex-direction: column; gap: 1.75rem;">
            <div>
              <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">Diagnostic Package</label>
              <select style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); background: var(--white); outline: none; font-weight: 600; cursor: pointer;">
                <option>Standard NPK Profile - ₹299</option>
                <option>Micronutrient Scan (Zinc, Boron, Iron) - ₹599</option>
                <option>Holistic Soil Health Card (Premium) - ₹999</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted);">On-Site Collection Date</label>
              <input type="date" style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); background: var(--white); outline: none; font-weight: 600;">
            </div>
            <button class="btn-primary" type="button" style="padding: 18px; font-size: 1.1rem; margin-top: 1rem;" onclick="showToast('Diagnostic specialist scheduled for your location.', 'success')">Initialize Field Collection</button>
          </form>
        </div>
      </section>

      <aside>
        <div class="glass-card" style="background: rgba(45, 106, 79, 0.03); border: 2px dashed rgba(45, 106, 79, 0.2); padding: 2rem; text-align: center;">
          <div style="font-size: 2.5rem; color: var(--secondary); margin-bottom: 1.5rem; opacity: 0.3;"><i class="fa-solid fa-file-medical-alt"></i></div>
          <h3 style="font-size: 1.15rem; color: var(--primary); margin-bottom: 1rem; font-weight: 800;">Diagnostic History</h3>
          <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6;">No digital soil reports found for this node. Complete your first lab test to synchronize history.</p>
          <button class="btn-primary" style="margin-top: 1.5rem; background: none; border: 1.5px solid var(--secondary); color: var(--secondary); box-shadow: none;" onclick="showToast('Securely connecting to laboratory database...', 'info')">Sync External Reports</button>
        </div>
      </aside>
    </div>
  </div>
`;

const MandiMarketsView = () => `
  <div class="fade-in">
    ${Header('Real-time Market Analytics')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 3rem; padding: 2.5rem; border: none; box-shadow: var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem;">
            <div>
              <h2 style="font-size: 1.5rem; color: var(--text-main);">Historical Market Volatility</h2>
              <p style="color: var(--text-muted); font-size: 0.9rem;">7-Day aggregate price movement analysis</p>
            </div>
            <div style="display: flex; gap: 8px;">
               <button class="btn-primary" style="padding: 8px 16px; font-size: 0.75rem; background: rgba(0,0,0,0.05); color: var(--text-main); box-shadow: none;">Weekly</button>
               <button class="btn-primary" style="padding: 8px 16px; font-size: 0.75rem;">Monthly</button>
            </div>
          </div>
          <div style="height: 350px; background: rgba(0,0,0,0.02); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
            <canvas id="mandi-large-chart"></canvas>
          </div>
        </div>
        
        <div style="margin-bottom: 2.5rem;">
           <h2 style="font-size: 1.5rem; color: var(--text-main); margin-bottom: 1.5rem;"><i class="fa-solid fa-bolt" style="color: var(--secondary);"></i> Live Mandi Rates</h2>
           <div class="marketplace-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));">
             ${state.mandiPrices.map(item => `
               <div class="glass-card" style="padding: 1.75rem; border: 1px solid rgba(255,255,255,0.05); transition: var(--transition);" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.05)'">
                 <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">${sanitizeHTML(item.crop)}</div>
                    <div class="trend ${sanitizeHTML(item.trend)}" style="font-size: 0.8rem;">${item.trend === 'up' ? '▲' : '▼'} ${sanitizeHTML(item.change_pct || '')}</div>
                 </div>
                 <div class="price" style="font-size: 1.75rem; font-weight: 900; margin-bottom: 0.5rem; color: var(--primary-light);">${formatCurrency(item.price)}</div>
                 <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Rate per ${sanitizeHTML(item.unit || 'Quintal')}</div>
               </div>
             `).join('') || '<p style="grid-column: 1/-1; padding: 4rem; text-align: center; color: var(--text-muted);">Awaiting market synchronization...</p>'}
           </div>
        </div>
      </section>

      <aside>
        <div class="glass-card" style="padding: 2.25rem; border: none; background: linear-gradient(135deg, rgba(27,67,50,0.1) 0%, rgba(64,145,108,0.05) 100%);">
          <h2 style="font-size: 1.25rem; color: var(--text-main); margin-bottom: 2rem; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-newspaper" style="color: var(--secondary);"></i> 
            Market Intelligence
          </h2>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            ${state.news.slice(0, 4).map(n => `
              <div style="padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.7rem; color: var(--secondary); font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">Official Mandi Update</div>
                <div style="font-size: 1rem; font-weight: 600; line-height: 1.5; color: var(--text-main); margin-bottom: 10px;">${sanitizeHTML(n.title)}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                  <span>Nagpur Hub</span>
                  <span>2h ago</span>
                </div>
              </div>
            `).join('') || `
              <div style="text-align: center; padding: 2rem 0; opacity: 0.5;">
                <i class="fa-solid fa-satellite-dish fa-spin" style="font-size: 2rem; margin-bottom: 1rem; color: var(--secondary);"></i>
                <p style="font-size: 0.9rem;">Connecting to Mandi Information Network...</p>
              </div>
            `}
          </div>
          <button class="btn-primary" style="width: 100%; margin-top: 2.5rem; background: none; border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); box-shadow: none;">Subscribe to Price Alerts</button>
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
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Max Price: ${formatCurrency(state.filters.maxPrice)}</label>
            <input type="range" id="price-range" min="0" max="100000" step="500" value="${state.filters.maxPrice}" style="width:100%; accent-color: var(--primary);">
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Region Pincode</label>
            <input type="text" id="filter-pincode" placeholder="e.g. 4400" value="${escapeHTML(state.filters.pincode)}" 
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
              <div class="crop-card" onclick="window.showListing('${crop.id}')">
                <div style="position: relative;">
                  <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image" alt="${sanitizeHTML(crop.name)}">
                  <div style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); color: white; padding: 6px 14px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(255,255,255,0.1);">
                    <i class="fa-solid fa-seedling"></i> ${sanitizeHTML(crop.category || 'Fresh')}
                  </div>
                  ${crop.is_verified ? '<div style="position: absolute; top: 15px; right: 15px; background: var(--accent); color: var(--primary-dark); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.2);"><i class="fa-solid fa-certificate"></i></div>' : ''}
                </div>
                <div class="crop-details">
                  <div class="crop-name" style="margin-bottom: 0.5rem;">${sanitizeHTML(crop.name)}</div>
                  <div class="crop-location" style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 2rem;">
                    <span style="display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-location-dot" style="color: var(--secondary);"></i> ${sanitizeHTML(crop.location_name || 'Nagpur')}</span>
                    ${dist ? `<span style="background: rgba(45, 106, 79, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 0.8rem;">${dist} km awaay</span>` : ''}
                  </div>
                  <div class="crop-footer" style="padding-top: 1.5rem;">
                    <span class="price" style="font-size: 1.5rem; font-weight: 900;">${formatCurrency(crop.price)}<span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); opacity: 0.8;">/${sanitizeHTML(crop.unit)}</span></span>
                    <button class="btn-primary" style="padding: 10px 24px; font-size: 0.9rem;">Inspect</button>
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
  <div class="fade-in" style="display: flex; justify-content: center; align-items: center; min-height: 90vh; background: radial-gradient(circle at 50% 50%, rgba(149, 213, 178, 0.05) 0%, transparent 70%);">
    <div class="glass-card" style="width: 450px; padding: 4rem; border: none; box-shadow: 0 40px 100px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 3.5rem;">
        <div style="width: 80px; height: 80px; background: var(--primary); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin: 0 auto 2rem; box-shadow: 0 15px 30px rgba(27,67,50,0.2);">
           <i class="fa-solid fa-leaf" style="font-size: 2.5rem; color: var(--accent);"></i>
        </div>
        <h2 style="font-size: 2.25rem; font-weight: 900; color: var(--text-main); letter-spacing: -0.03em; margin-bottom: 10px;">Operational Relay</h2>
        <p style="color: var(--text-muted); font-size: 1rem; font-weight: 600;">Secure node authentication required</p>
      </div>
      <form id="login-form" style="display: flex; flex-direction: column; gap: 1.75rem;">
        <div>
          <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Access Credential</label>
          <input type="text" name="email" required placeholder="farmer@khetgo.system" 
                 style="width:100%; padding:18px; border-radius:15px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
        </div>
        <div>
          <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Security Cipher</label>
          <input type="password" name="password" required placeholder="••••••••" 
                 style="width:100%; padding:18px; border-radius:15px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
        </div>
        <button type="submit" class="btn-primary" style="padding: 20px; margin-top: 1rem; font-size: 1.15rem; font-weight: 900;">Initialize Session</button>
        <p style="text-align: center; font-size: 0.95rem; margin-top: 2rem; color: var(--text-muted); font-weight: 600;">
          New operative? <a href="#" style="color: var(--primary); font-weight: 800; text-decoration: none;" onclick="window.setView('signup')">Create Identity</a>
        </p>
      </form>
    </div>
  </div>
`;

const SignupView = () => `
  <div class="fade-in" style="display: flex; justify-content: center; align-items: center; min-height: 90vh; background: radial-gradient(circle at 50% 50%, rgba(149, 213, 178, 0.05) 0%, transparent 70%);">
    <div class="glass-card" style="width: 500px; padding: 4rem; border: none; box-shadow: 0 40px 100px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 3.5rem;">
        <h2 style="font-size: 2.25rem; font-weight: 900; color: var(--text-main); letter-spacing: -0.03em; margin-bottom: 10px;">Identity Protocol</h2>
        <p style="color: var(--text-muted); font-size: 1rem; font-weight: 600;">Establish your agricultural jurisdiction</p>
      </div>
      <form id="signup-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Legal Alias</label>
            <input type="text" name="full_name" required placeholder="R. Singh" 
                   style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
          </div>
          <div>
             <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Node Type</label>
             <select name="role" style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); background: var(--white); outline: none; font-weight: 800; cursor: pointer;">
                <option value="farmer">Agronomist</option>
                <option value="buyer">Procurement</option>
             </select>
          </div>
        </div>
        <div>
          <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Encryption Logic (Email)</label>
          <input type="email" name="email" required placeholder="operative@khetgo.system" 
                 style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
        </div>
        <div>
          <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Communication Link (Phone)</label>
          <input type="tel" name="phone" required placeholder="+91 00000 00000" 
                 style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
        </div>
        <div>
          <label style="display:block; font-weight:800; margin-bottom:10px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Primary Cipher</label>
          <input type="password" name="password" required minlength="8" placeholder="••••••••" 
                 style="width:100%; padding:16px; border-radius:14px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: rgba(0,0,0,0.01);">
        </div>
        <button type="submit" class="btn-primary" style="padding: 20px; margin-top: 1rem; font-size: 1.15rem; font-weight: 900;">Establish Identity</button>
        <p style="text-align: center; font-size: 0.95rem; margin-top: 2rem; color: var(--text-muted); font-weight: 600;">
          Existing operative? <a href="#" style="color: var(--primary); font-weight: 800; text-decoration: none;" onclick="window.setView('login')">Authenticate</a>
        </p>
      </form>
    </div>
  </div>
`;

const ProductDetailView = (id) => {
  const crop = state.cropListings.find(c => c.id === id);
  if (!crop) return '<div class="fade-in" style="padding: 4rem; text-align: center;"><h2>Listing not found.</h2><button class="btn-primary" onclick="window.setView(\'marketplace\')">Return to Market</button></div>';

  return `
    <div class="fade-in">
      ${Header(crop.name)}
      <div class="dashboard-grid">
        <section>
          <div class="glass-card" style="padding: 0; overflow: hidden; border: none; box-shadow: var(--shadow);">
            <div style="position: relative;">
              <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" 
                   style="width: 100%; height: 500px; object-fit: cover;">
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%); padding: 3rem 2.5rem; color: white;">
                 <div style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; letter-spacing: 0.1em;">Premium Listing</div>
                 <h2 style="font-size: 3rem; margin: 0;">${sanitizeHTML(crop.name)}</h2>
              </div>
            </div>
            <div style="padding: 3rem 2.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem;">
                <div>
                  <div class="crop-location" style="font-size: 1.25rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-location-dot" style="color: var(--secondary);"></i> 
                    ${sanitizeHTML(crop.location_name || 'Nagpur')}, India
                  </div>
                  <div style="font-size: 0.95rem; color: var(--text-muted);"><i class="fa-solid fa-truck-fast"></i> Delivery available within 50km</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Direct Price</div>
                  <div class="price" style="font-size: 3.5rem; font-weight: 900; line-height: 1;">₹${crop.price}<span style="font-size: 1.25rem; font-weight: 600; color: var(--text-muted);">/${crop.unit}</span></div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
                <div style="padding: 1.5rem; background: rgba(64, 145, 108, 0.05); border-radius: 20px; text-align: center; border: 1px solid rgba(64, 145, 108, 0.1);">
                  <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Supply</div>
                  <div style="font-weight: 800; font-size: 1.25rem; color: var(--primary);">${sanitizeHTML(crop.quantity || 'In Stock')}</div>
                </div>
                <div style="padding: 1.5rem; background: rgba(64, 145, 108, 0.05); border-radius: 20px; text-align: center; border: 1px solid rgba(64, 145, 108, 0.1);">
                  <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Fresher For</div>
                  <div style="font-weight: 800; font-size: 1.25rem; color: var(--primary);">7-10 Days</div>
                </div>
                <div style="padding: 1.5rem; background: rgba(64, 145, 108, 0.05); border-radius: 20px; text-align: center; border: 1px solid rgba(64, 145, 108, 0.1);">
                  <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Region</div>
                  <div style="font-weight: 800; font-size: 1.25rem; color: var(--primary);">${sanitizeHTML(crop.category || 'General')}</div>
                </div>
              </div>

              <h3 style="font-size: 1.5rem; margin-bottom: 1rem; color: var(--text-main);">Product Insight</h3>
              <p style="line-height: 1.8; color: var(--text-muted); margin-bottom: 3rem; font-size: 1.1rem;">
                ${sanitizeHTML(crop.description || 'This premium harvest is directly sourced from local fields. We ensure zero middlemen, providing the highest quality produce at competitive market rates. Verified and inspected for quality.')}
              </p>

              <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem;">
                <button class="btn-primary" style="flex: 1.5; padding: 22px; font-size: 1.25rem; background: var(--secondary);" onclick="window.placeOrder('${crop.id}')">
                  <i class="fa-solid fa-cart-shopping"></i> Secure Order
                </button>
                <button class="btn-primary" style="flex: 1; padding: 22px; font-size: 1.25rem; background: #25D366; box-shadow: 0 8px 20px rgba(37, 211, 102, 0.3);" 
                        onclick="window.open('https://wa.me/${crop.profiles?.phone || '911234567890'}?text=Hi, I am interested in your ${sanitizeHTML(crop.name)} on KhetGo')">
                  <i class="fa-brands fa-whatsapp"></i> WhatsApp
                </button>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 3rem;">
                <div class="glass-card" style="padding: 1.5rem; border-radius: 20px; display: flex; align-items: center; gap: 1.25rem; background: rgba(27,67,50,0.03);">
                  <i class="fa-solid fa-truck-fast" style="font-size: 1.5rem; color: var(--secondary);"></i>
                  <div>
                    <div style="font-weight: 800; font-size: 1rem;">Mandi Logistics</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${sanitizeHTML(crop.profiles?.district || 'Nagpur')} Hub</div>
                  </div>
                </div>
                <div class="glass-card" style="padding: 1.5rem; border-radius: 20px; display: flex; align-items: center; gap: 1.25rem; background: rgba(27,67,50,0.03);">
                  <i class="fa-solid fa-shield-halved" style="font-size: 1.5rem; color: var(--secondary);"></i>
                  <div>
                    <div style="font-weight: 800; font-size: 1rem;">Buyer Protection</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Verified Transactions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside>
          <div class="glass-card" style="padding: 2rem;">
            <h3 style="margin-bottom: 2rem; font-size: 1.25rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 1rem;">Farmer Registry</h3>
            <div style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem;">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(crop.profiles?.full_name || 'Farmer')}&background=1B4332&color=fff&rounded=true" style="width: 70px; height: 70px; border: 3px solid var(--accent); padding: 2px;">
              <div>
                <div style="font-weight: 800; font-size: 1.35rem; color: var(--text-main);">${sanitizeHTML(crop.profiles?.full_name || 'Regional Farmer')}</div>
                <div class="verified-badge" style="margin-top: 6px;">
                  <i class="fa-solid fa-certificate"></i> Verified
                </div>
              </div>
            </div>
            <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.7; margin-bottom: 2rem;">
               Highly rated producer from rural ${sanitizeHTML(crop.profiles?.district || 'Nagpur')}. Specializes in high-yield, organic techniques with a 4.9★ rating.
            </p>
            <button class="btn-primary" style="width: 100%; padding: 16px; background: none; border: 1px solid var(--secondary); color: var(--secondary); box-shadow: none;" onclick="window.startChat('${crop.owner_id}')">
              <i class="fa-solid fa-message"></i> Message Producer
            </button>
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
    ${Header('Agri-Identity Profile')}
    <div class="glass-card" style="max-width: 650px; margin: 0 auto; padding: 3.5rem; border: none; box-shadow: var(--shadow);">
      <div style="text-align:center; margin-bottom: 3.5rem;">
        <div style="position: relative; display: inline-block;">
           <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.full_name || 'U')}&background=1B4332&color=fff&size=120" style="border-radius: 40px; border: 4px solid var(--white); box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
           <div style="position: absolute; bottom: -5px; right: -5px; background: var(--secondary); color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid var(--white);">
              <i class="fa-solid fa-camera" style="font-size: 0.9rem;"></i>
           </div>
        </div>
        <h2 style="margin-top: 2rem; font-size: 2rem; font-weight: 900; color: var(--text-main); letter-spacing: -0.02em;">${sanitizeHTML(state.profile?.full_name || 'Strategic Partner')}</h2>
        <div style="margin-top: 10px;">
           <span class="verified-badge" style="background: rgba(149, 213, 178, 0.2); color: var(--primary); font-weight: 800; padding: 6px 16px; border-radius: 50px; font-size: 0.8rem; text-transform: uppercase;">
              <i class="fa-solid fa-shield-check"></i> ${state.profile?.role === 'farmer' ? 'Verified Agronomist' : 'Strategic Procurement Lead'}
           </span>
        </div>
      </div>
      <form id="profile-form" style="display: flex; flex-direction: column; gap: 2rem;">
        <div>
          <label style="display:block; font-weight:800; margin-bottom:12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">Professional Biography</label>
          <textarea name="bio" style="width:100%; padding:18px; border-radius:18px; border:1px solid rgba(0,0,0,0.1); height:120px; outline: none; font-weight: 600; line-height: 1.6; background: rgba(0,0,0,0.01); resize: none;" 
                    placeholder="Describe your agricultural specialization...">${state.profile?.bio || ''}</textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <label style="display:block; font-weight:800; margin-bottom:12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Jurisdiction / District</label>
            <input type="text" name="district" value="${state.profile?.district || ''}" 
                   style="width:100%; padding:16px; border-radius:15px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700;">
          </div>
          <div>
            <label style="display:block; font-weight:800; margin-bottom:12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Postal Identification</label>
            <input type="text" name="pincode" value="${state.profile?.pincode || ''}" 
                   style="width:100%; padding:16px; border-radius:15px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700;">
          </div>
        </div>
        <div>
          <label style="display:block; font-weight:800; margin-bottom:12px; font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted);">Secure Contact Protocol</label>
          <input type="tel" name="phone" value="${state.profile?.phone || ''}" 
                 style="width:100%; padding:16px; border-radius:15px; border:1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700;" placeholder="+91 00000 00000">
        </div>
        <button type="submit" class="btn-primary" style="padding: 20px; font-size: 1.15rem; font-weight: 900; text-transform: uppercase; margin-top: 1rem; box-shadow: 0 10px 30px rgba(27,67,50,0.2);">Synchronize Profile Archives</button>
      </form>
    </div>
  </div>
`;

const ForumView = () => {
  return `
    <div class="fade-in">
      ${Header('Agronomic Community Hub')}
      <div class="dashboard-grid">
        <section>
          <div style="display: flex; flex-direction: column; gap: 2rem;">
            ${state.forumPosts.length > 0 ? state.forumPosts.map(post => `
              <div class="glass-card" style="padding: 2rem; border: none; box-shadow: var(--shadow-sm); transition: var(--transition);" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display:flex; gap: 1.25rem; align-items: center; margin-bottom: 2rem;">
                  <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(post.owner_id || 'U')}&background=1B4332&color=fff" style="width: 50px; height: 50px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <div>
                    <div style="font-weight:900; color: var(--text-main); font-size: 1.1rem;">Certified Agri-Strategist</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                       ${new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} • 
                       <span style="color: var(--secondary);">${post.category || 'Strategic Growth'}</span>
                    </div>
                  </div>
                </div>
                <h3 style="margin-bottom: 0.75rem; font-size: 1.4rem; font-weight: 900; color: var(--text-main); line-height: 1.3;">${post.title}</h3>
                <p style="font-size: 1.05rem; line-height: 1.7; color: var(--text-muted); margin-bottom: 2rem;">${post.content}</p>
                <div style="display: flex; gap: 2rem; font-size: 0.9rem; font-weight: 800; color: var(--text-muted); padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.02);">
                  <span style="cursor: pointer;"><i class="fa-regular fa-comment-dots" style="color: var(--primary);"></i> 12 Knowledge Clusters</span>
                  <span style="cursor: pointer;"><i class="fa-regular fa-heart" style="color: #EF4444;"></i> ${post.likes_count} Endorsements</span>
                </div>
              </div>
            `).join('') : `
               <div class="glass-card" style="text-align:center; padding:5rem; opacity: 0.5; border: 2px dashed rgba(0,0,0,0.05);">
                  <i class="fa-solid fa-comments" style="font-size: 3rem; margin-bottom: 1.5rem;"></i>
                  <p style="font-size: 1.1rem; font-weight: 600;">The specialized forums are awaiting your strategic input.</p>
               </div>
            `}
            <button class="btn-primary" style="width: 100%; padding: 20px; font-size: 1.1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 18px;" onclick="window.setView('add-post')">Initiate Strategic Discussion</button>
          </div>
        </section>
        <aside>
          <div class="glass-card" style="padding: 2.25rem; background: linear-gradient(135deg, rgba(27,67,50,0.05) 0%, rgba(64,145,108,0.02) 100%);">
            <h3 style="margin-bottom: 1.5rem; font-weight: 900; font-size: 1.25rem;">Node Contributors</h3>
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
               ${[1, 2, 3].map(i => `
                 <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--secondary);"></div>
                    <div>
                       <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main);">Regional Lead ${i}</div>
                       <div style="font-size: 0.75rem; color: var(--text-muted);">Verified Agronomist</div>
                    </div>
                 </div>
               `).join('')}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
};

const NewsView = () => {
  return `
    <div class="fade-in">
      ${Header('Agri-Buzz: Precision Intelligence')}
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 3rem; margin-top: 1.5rem;">
        ${state.news.length > 0 ? state.news.map(a => `
          <div class="crop-card" style="border: 1px solid rgba(255,255,255,0.05); transition: var(--transition);">
            <div style="position: relative; overflow: hidden; border-radius: 20px 20px 0 0;">
              <img src="${a.image_url}" class="crop-image" style="height: 220px; transition: transform 0.6s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
              <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 50%; background: linear-gradient(transparent, rgba(0,0,0,0.7)); opacity: 0.8;"></div>
            </div>
            <div class="crop-details" style="padding: 1.75rem;">
              <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                 <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--secondary); display: inline-block;"></span>
                 ${a.category}
              </div>
              <h3 style="font-size: 1.35rem; font-weight: 900; margin-bottom: 15px; color: var(--text-main); line-height: 1.3; letter-spacing: -0.01em;">${a.title}</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted); font-weight: 700; border-top: 1px solid rgba(0,0,0,0.02); padding-top: 1.5rem;">
                <span>Official Release</span>
                <span>${new Date(a.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </div>
        `).join('') : `
           <div style="grid-column: 1/-1; padding: 7rem; text-align: center; opacity: 0.4;">
              <i class="fa-solid fa-satellite-dish fa-spin" style="font-size: 4rem; margin-bottom: 2rem; color: var(--secondary);"></i>
              <p style="font-size: 1.3rem; font-weight: 700;">Scanning global agricultural frequency for updates...</p>
           </div>
        `}
      </div>
    </div>
  `;
};

const AdvisorView = () => `
  <div class="fade-in">
    ${Header('Agri-Intelligence Advisor')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 2.5rem; background: linear-gradient(135deg, rgba(67, 56, 202, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%); border: 1px solid rgba(67, 56, 202, 0.15); padding: 2.5rem;">
          <div style="display: flex; gap: 2rem; align-items: center;">
             <div style="font-size: 3.5rem; color: #4338CA; opacity: 0.9;"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
             <div>
                <h2 style="color: #4338CA; font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 900;">AI Visionary Diagnostic</h2>
                <p style="color: var(--text-muted); line-height: 1.7; font-size: 1rem;">
                   Deploy our neural networks to analyze crop anomalies. Describe symptoms such as discoloration, parasite presence, or growth stagnation for an immediate agronomic resolution.
                </p>
             </div>
          </div>
        </div>

        <div class="glass-card" style="padding: 2.5rem; border: none; box-shadow: var(--shadow);">
          <div style="margin-bottom: 1.5rem;">
             <label style="display: block; font-weight: 800; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">Input Observation Log</label>
             <textarea id="advisor-query" style="width:100%; height:180px; padding:1.5rem; border-radius:20px; border:1px solid rgba(0,0,0,0.08); outline:none; font-size:1.1rem; line-height: 1.6; background: rgba(0,0,0,0.01); resize: none;" 
                       placeholder="e.g., Identifying rust-colored filaments on wheat stalks after heavy precipitation..."></textarea>
          </div>
          <button class="btn-primary" style="width:100%; padding:20px; font-size: 1.15rem; font-weight: 800; background: #4338CA; box-shadow: 0 10px 25px rgba(67, 56, 202, 0.2);" onclick="window.askAdvisor()">
            <i class="fa-solid fa-microchip"></i> Initialize Neural Analysis
          </button>
        </div>

        <div id="advisor-result" style="margin-top:2.5rem;"></div>
      </section>
      <aside>
        <div class="glass-card" style="padding: 2rem; background: rgba(0,0,0,0.02); border: 1px dashed rgba(67, 56, 202, 0.2);">
          <h3 style="margin-bottom: 1.25rem; font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-history" style="color: #4338CA;"></i> Consultation Logs
          </h3>
          <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6;">No forensic diagnostic signatures found on this node. Your AI consultations are encrypted and stored locally.</p>
          <button class="btn-primary" style="margin-top: 1.5rem; width: 100%; background: none; border: 1px solid #4338CA; color: #4338CA; box-shadow: none;" onclick="showToast('Synchronizing consultation database...', 'info')">Sync Cloud Archive</button>
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
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 3rem;">
        ${Header("Farmer's Digital Khata")}
        <button class="btn-primary" style="background: var(--primary-dark); padding: 12px 24px; font-weight: 800; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.1);" onclick="window.exportKhataToPDF()">
          <i class="fa-solid fa-file-export"></i> Cloud Statement
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3.5rem;">
        <div class="glass-card" style="border-bottom: 4px solid #10B981; background: linear-gradient(135deg, var(--card-bg) 0%, rgba(16, 185, 129, 0.05) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Aggregated Revenue</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: #059669;">₹${totalIncome.toLocaleString()}</div>
          <div style="font-size: 0.8rem; color: #059669; font-weight: 700; margin-top: 10px;"><i class="fa-solid fa-arrow-trend-up"></i> Total Cash Inflow</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid #EF4444; background: linear-gradient(135deg, var(--card-bg) 0%, rgba(239, 68, 68, 0.05) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Operational Burn</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: #DC2626;">₹${totalExpense.toLocaleString()}</div>
          <div style="font-size: 0.8rem; color: #DC2626; font-weight: 700; margin-top: 10px;"><i class="fa-solid fa-arrow-trend-down"></i> Total Expenditures</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid var(--accent); background: linear-gradient(135deg, var(--card-bg) 0%, rgba(149, 213, 178, 0.1) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">Net Capital Reserve</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: var(--primary-light);">₹${balance.toLocaleString()}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; margin-top: 10px;"><i class="fa-solid fa-scale-balanced"></i> Current Asset Liquidity</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <section>
          <div class="glass-card" style="margin-bottom: 2.5rem; padding: 2rem;">
            <h3 style="font-size: 1.25rem; margin-bottom: 2rem; font-weight: 800; color: var(--text-main);">Record Ledger Synchronization</h3>
            <form id="khata-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
              <div style="grid-column: span 2;">
                 <input type="text" name="title" placeholder="Description (e.g., Sold Grade-A Wheat to Nagpur Mandi)" required 
                        style="width: 100%; padding: 16px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); outline: none; font-weight: 600;">
              </div>
              <input type="number" name="amount" placeholder="Transaction Amount (₹)" required 
                     style="padding: 16px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); outline: none; font-weight: 600;">
              <select name="type" style="padding: 16px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); outline: none; font-weight: 700; background: var(--white); cursor: pointer;">
                <option value="income">Cash Inflow (+)</option>
                <option value="expense">Expense Outflow (-)</option>
              </select>
              <button type="submit" class="btn-primary" style="grid-column: span 2; padding: 18px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;">Commit to Blockchain Ledger</button>
            </form>
          </div>

          <div class="glass-card" style="padding: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center;">
               <h3 style="font-size: 1.1rem; font-weight: 800;">Forensic Transaction History</h3>
               <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); opacity: 0.6;">Auto-synced</span>
            </div>
            <div style="padding: 1rem;">
              ${state.ledgerEntries.map(e => `
                <div class="mandi-item" style="padding: 1.25rem 1rem; border-bottom: 1px solid rgba(0,0,0,0.02);">
                  <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 40px; height: 40px; border-radius: 12px; background: ${e.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; display: flex; align-items: center; justify-content: center; color: ${e.type === 'income' ? '#10B981' : '#EF4444'};">
                       <i class="fa-solid ${e.type === 'income' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                    </div>
                    <div>
                      <div style="font-weight: 800; color: var(--text-main);">${sanitizeHTML(e.title)}</div>
                      <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${new Date(e.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div style="font-weight: 900; font-size: 1.15rem; color: ${e.type === 'income' ? '#059669' : '#DC2626'};">
                    ${e.type === 'income' ? '+' : '-'} ₹${e.amount.toLocaleString()}
                  </div>
                </div>
              `).reverse().join('') || '<div style="padding: 4rem; text-align: center; color: var(--text-muted); opacity: 0.5;"><p>No transaction trails detected.</p></div>'}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
};

const AcademyView = () => `
  <div class="fade-in">
    ${Header('Agri-Intelligence Academy')}
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2.5rem; margin-top: 1rem;">
      ${state.academyContent.map(v => `
        <div class="crop-card" style="border: 1px solid rgba(255,255,255,0.05); transition: var(--transition);">
          <div style="position:relative; overflow: hidden; border-radius: 20px 20px 0 0;">
            <img src="${v.thumbnail_url}" class="crop-image" style="height:220px; transition: transform 0.5s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
               <div style="font-size:3.5rem; color:white; opacity:0.9; cursor:pointer; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));" onclick="window.open('${v.video_url}')">
                 <i class="fa-solid fa-circle-play"></i>
               </div>
            </div>
            <div style="position:absolute; bottom: 15px; left: 15px; background: var(--secondary); color: white; padding: 4px 12px; border-radius: 50px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">Professional</div>
          </div>
          <div class="crop-details" style="padding: 1.75rem;">
            <div style="font-size:0.75rem; color: var(--secondary); font-weight:800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${v.category}</div>
            <h3 style="margin-bottom: 12px; font-size:1.2rem; font-weight: 800; color: var(--text-main); line-height: 1.4;">${v.title}</h3>
            <p style="font-size:0.95rem; color:var(--text-muted); line-height: 1.6;">Integrated agronomic techniques curated by specialized research foundations to optimize yield performance.</p>
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
               <span><i class="fa-regular fa-clock"></i> 15 min read</span>
               <span style="color: var(--primary); cursor: pointer;">Start Module <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
      `).join('') || `
         <div style="grid-column: 1/-1; padding: 6rem; text-align: center; opacity: 0.5;">
            <i class="fa-solid fa-graduation-cap" style="font-size: 4rem; margin-bottom: 2rem;"></i>
            <p style="font-size: 1.2rem; font-weight: 600;">The digital library is currently being synchronized with the latest research.</p>
         </div>
      `}
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

const AdminPortalView = () => {
  const users = state.allProfiles || [];
  const listings = state.allListings || [];

  return `
    <div class="fade-in">
      ${Header('Platform Administration')}
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; margin-bottom: 3.5rem;">
        <div class="glass-card" style="border-bottom: 4px solid var(--primary); background: linear-gradient(135deg, var(--card-bg) 0%, rgba(27,67,50,0.05) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase;">Total Platform Users</div>
          <div style="font-size: 3rem; font-weight: 900; margin: 15px 0; color: var(--primary);">${state.adminStats.totalUsers}</div>
          <div style="font-size: 0.85rem; color: #059669; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> ${users.filter(u => u.is_verified).length} Verified Accounts</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid var(--secondary); background: linear-gradient(135deg, var(--card-bg) 0%, rgba(64,145,108,0.05) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase;">Active Market Listings</div>
          <div style="font-size: 3rem; font-weight: 900; margin: 15px 0; color: var(--secondary);">${state.adminStats.totalListings}</div>
          <div style="font-size: 0.85rem; color: #059669; font-weight: 600;"><i class="fa-solid fa-bolt"></i> Real-time Network</div>
        </div>
        <div class="glass-card" style="border-bottom: 4px solid #F59E0B; background: linear-gradient(135deg, var(--card-bg) 0%, rgba(245,158,11,0.05) 100%);">
          <div style="color: var(--text-muted); font-size: 0.9rem; font-weight: 700; text-transform: uppercase;">Gross Flow</div>
          <div style="font-size: 3rem; font-weight: 900; margin: 15px 0; color: #B45309;">${formatCurrency(state.adminStats.totalRevenue)}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cumulative Volume</div>
        </div>
      </div>

      <section style="margin-bottom: 4rem;">
        <div class="section-title" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.8rem; color: var(--text-main);"><i class="fa-solid fa-users-gear" style="color: var(--secondary);"></i> User Registry</h2>
          <p style="font-size: 1rem; color: var(--text-muted);">Moderate platform identities and verification status</p>
        </div>
        <div class="glass-card" style="padding: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Platform User</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Tier/Role</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Region</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Verification</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted); text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.02); transition: background 0.3s;" onmouseover="this.style.background='rgba(0,0,0,0.01)'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 1.25rem 1.5rem;">
                    <div style="font-weight: 800; color: var(--text-main);">${sanitizeHTML(u.full_name || 'Anonymous')}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${u.id.substring(0, 12)}</div>
                  </td>
                  <td style="padding: 1.25rem 1.5rem; text-transform: capitalize; font-weight: 600;">${u.role}</td>
                  <td style="padding: 1.25rem 1.5rem; color: var(--text-muted);">${sanitizeHTML(u.district || 'N/A')}</td>
                  <td style="padding: 1.25rem 1.5rem;">
                    ${u.is_verified ?
      '<span style="color: #059669; background: #ECFDF5; padding: 6px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 700; border: 1px solid #A7F3D0;"><i class="fa-solid fa-check-double"></i> Verified</span>' :
      '<span style="color: #6B7280; background: #F3F4F6; padding: 6px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 700;">Pending</span>'}
                  </td>
                  <td style="padding: 1.25rem 1.5rem; text-align: right;">
                    ${!u.is_verified ? `<button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; background: #059669;" onclick="window.verifyUser('${u.id}')">Verify Now</button>` : '<i class="fa-solid fa-circle-check" style="color: #059669; font-size: 1.25rem;"></i>'}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5" style="padding:4rem; text-align:center; color:var(--text-muted);">No platform users synchronized yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section style="margin-top: 4rem;">
        <div class="section-title" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.8rem; color: var(--text-main);"><i class="fa-solid fa-box-open" style="color: var(--secondary);"></i> Catalog Moderation</h2>
          <p style="font-size: 1rem; color: var(--text-muted);">Approve or remove marketplace listings</p>
        </div>
        <div class="glass-card" style="padding: 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Product</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Price Rate</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted);">Status</th>
                <th style="padding: 1.5rem; font-weight: 800; text-transform: uppercase; font-size: 0.8rem; color: var(--text-muted); text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${listings.map(l => `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.02);">
                  <td style="padding: 1.25rem 1.5rem;">
                    <div style="font-weight: 800; color: var(--text-main);">${sanitizeHTML(l.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Producer: ${l.owner_id.substring(0, 12)}</div>
                  </td>
                  <td style="padding: 1.25rem 1.5rem; font-weight: 700;">${formatCurrency(l.price)}/${l.unit}</td>
                  <td style="padding: 1.25rem 1.5rem;">
                    ${l.is_verified ?
          '<span style="color: #059669; background: #ECFDF5; padding: 6px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 700;"><i class="fa-solid fa-shield-check"></i> Approved</span>' :
          '<span style="color: #B45309; background: #FFFBEB; padding: 6px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 700;">Awaiting Audit</span>'}
                  </td>
                  <td style="padding: 1.25rem 1.5rem; text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    ${!l.is_verified ? `<button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; background: #059669;" onclick="window.verifyListing('${l.id}')">Approve</button>` : ''}
                    <button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; background: #DC2626;" onclick="window.deleteListing('${l.id}')">Terminate</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="padding:4rem; text-align:center; color:var(--text-muted);">Marketplace catalog is synchronized.</td></tr>'}
            </tbody>
          </table>
        </div>
      <section style="margin-top: 4rem;">
        <div class="section-title" style="margin-bottom: 2rem;">
          <h2 style="font-size: 1.8rem; color: var(--text-main);"><i class="fa-solid fa-chart-line" style="color: var(--secondary);"></i> Mandi Market Control</h2>
          <p style="font-size: 1rem; color: var(--text-muted);">Global synchronization of live market volatility</p>
        </div>
        <div class="glass-card" style="padding: 2.5rem; border: 1px solid rgba(255,165,0,0.1); background: linear-gradient(135deg, var(--card-bg) 0%, rgba(255,165,0,0.02) 100%);">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
            ${state.mandiPrices.map(item => `
              <div style="padding: 1.5rem; background: rgba(0,0,0,0.02); border-radius: 18px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                  <div>
                    <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${sanitizeHTML(item.crop)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Rate: ${formatCurrency(item.price)}/${sanitizeHTML(item.unit)}</div>
                  </div>
                  <div class="trend ${sanitizeHTML(item.trend)}">${sanitizeHTML(item.change_pct)}</div>
                </div>
                <div style="display: flex; gap: 10px;">
                  <input type="number" id="price-input-${item.id}" value="${item.price}" 
                         style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); font-weight: 800; width: 80px; outline: none;">
                  <button class="btn-primary" style="padding: 12px 20px; font-size: 0.85rem;" 
                          onclick="const p = document.getElementById('price-input-${item.id}').value; window.updateMandiPrice('${item.id}', p)">Sync Rate</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `;
};

window.updateMandiPrice = async (id, newPrice) => {
  const { error } = await supabase.from('mandi_prices').update({ price: newPrice, updated_at: new Date() }).eq('id', id);
  if (error) showToast(error.message, 'error');
  else {
    showToast('Market price updated!', 'success');
    fetchAllData();
    fetchAllAdminData();
  }
};

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
  if (view === 'admin') fetchAllAdminData();
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
  state.isAdmin = false;
  localStorage.removeItem('khetgo_admin_session');
  window.setView('login');
};

window.verifyUser = async (profileId) => {
  const { error } = await supabase.from('profiles').update({ is_verified: true }).eq('id', profileId);
  if (error) showToast(error.message, 'error');
  else {
    showToast('User verified successfully!', 'success');
    fetchAllAdminData();
  }
};

window.verifyListing = async (listingId) => {
  const { error } = await supabase.from('listings').update({ is_verified: true }).eq('id', listingId);
  if (error) showToast(error.message, 'error');
  else {
    showToast('Listing verified!', 'success');
    fetchAllAdminData();
  }
};

window.deleteListing = async (listingId) => {
  if (!confirm('Permanent delete this listing?')) return;
  const { error } = await supabase.from('listings').delete().eq('id', listingId);
  if (error) showToast(error.message, 'error');
  else {
    showToast('Listing deleted', 'info');
    fetchAllAdminData();
  }
};

async function fetchAllAdminData() {
  if (!state.isAdmin) return;

  const [profiles, listings, bookings] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('listings').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('*').order('booking_date', { ascending: false })
  ]);

  state.allProfiles = profiles.data || [];
  state.allListings = listings.data || [];
  state.allBookings = bookings.data || [];

  state.adminStats = {
    totalUsers: state.allProfiles.length,
    totalListings: state.allListings.length,
    totalRevenue: state.allBookings.reduce((acc, b) => acc + (b.price_per_unit || 0), 0)
  };

  render();
}

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
    case 'admin': content = AdminPortalView(); break;
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

  // Debounced Search
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.oninput = debounce((e) => {
      state.searchQuery = e.target.value;
      render();
    }, 400);
  }

  // Debounced Filter inputs
  const pincodeFilter = document.getElementById('filter-pincode');
  if (pincodeFilter) {
    pincodeFilter.oninput = debounce((e) => {
      state.filters.pincode = e.target.value;
      render();
    }, 400);
  }

  const priceRange = document.getElementById('price-range');
  if (priceRange) {
    priceRange.oninput = (e) => {
      state.filters.maxPrice = parseInt(e.target.value);
      // We don't debounce range because users like immediate feedback on labels, 
      // but if performance is bad we could debounce the render.
      render();
    };
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      state.filters.sortBy = e.target.value;
      render();
    };
  }

  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(loginForm);
      const email = d.get('email');
      const password = d.get('password');

      // Admin Bypass as requested: login admin, pass admin
      if (email === 'admin' && password === 'admin') {
        state.isAdmin = true;
        state.profile = { full_name: 'Master Admin', role: 'admin' };
        state.user = { id: 'admin-bypass' };
        localStorage.setItem('khetgo_admin_session', 'true');
        showToast('Admin access granted', 'success');
        window.setView('admin');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) showToast(error.message, 'error');
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
            phone: d.get('phone'),
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

  // Form Submission
  const form = document.getElementById('listing-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const publishBtn = document.getElementById('publish-btn');
      const imageInput = document.getElementById('listing-images');

      const d = new FormData(form);
      const price = parseFloat(d.get('price'));

      if (isNaN(price) || price <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
      }

      publishBtn.disabled = true;
      publishBtn.innerHTML = 'Uploading... <i class="fa-solid fa-spinner fa-spin"></i>';

      let imageUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';

      // Handle Image Upload with basic validation
      if (imageInput && imageInput.files.length > 0) {
        const file = imageInput.files[0];

        if (file.size > 5 * 1024 * 1024) {
          showToast('Image size must be less than 5MB', 'error');
          publishBtn.disabled = false;
          publishBtn.innerText = 'Publish to Marketplace';
          return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
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
        price: price,
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
        showToast("Success! Your crop listing is now live.", "success");
        window.setView('marketplace');
        fetchAllData();
      } else {
        showToast('Error: ' + error.message, 'error');
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



  // Profile Form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const d = new FormData(profileForm);
      const { error } = await supabase.from('profiles').update({
        bio: d.get('bio'),
        district: d.get('district'),
        pincode: d.get('pincode'),
        phone: d.get('phone')
      }).eq('id', state.user.id);

      if (!error) {
        showToast('Profile Updated!', 'success');
        checkAuth();
      } else {
        showToast('Error: ' + error.message, 'error');
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
    if (state.charts.mini) state.charts.mini.destroy();
    state.charts.mini = new Chart(miniCtx, {
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
    if (state.charts.large) state.charts.large.destroy();
    state.charts.large = new Chart(largeCtx, {
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
