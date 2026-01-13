import { supabase } from './supabase'
import './style.css'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables);

/**
 * KhetGo - Re-engineered for Stability & Premium UI
 */

// --- App State ---
let state = {
  user: null, // Stores auth data
  profile: null, // Stores DB profile data
  currentView: 'dashboard',
  searchQuery: '',
  filters: {
    pincode: '',
  },
  mandiPrices: [
    { id: 1, crop: 'Wheat (Lokan)', price: '₹2,450', unit: 'Quintal', trend: 'up', change: '+2.4%' },
    { id: 2, crop: 'Basmati Rice', price: '₹6,800', unit: 'Quintal', trend: 'up', change: '+1.2%' },
    { id: 3, crop: 'Cotton', price: '₹7,200', unit: 'Quintal', trend: 'down', change: '-0.8%' },
    { id: 4, crop: 'Soybean', price: '₹4,600', unit: 'Quintal', trend: 'up', change: '+3.1%' },
    { id: 5, crop: 'Onion', price: '₹1,800', unit: 'Quintal', trend: 'down', change: '-5.2%' },
  ],
  cropListings: [],
  myBookings: [],
  messages: [],
  activeChat: null, // User profile we are chatting with
  isLoading: false
};

// --- Auth Handling ---
async function checkAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  state.user = user;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    state.profile = profile;
    subscribeToMessages();
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

// --- Data Fetching ---
async function fetchAllData() {
  state.isLoading = true;
  render();

  try {
    const [listingsRes, bookingsRes] = await Promise.all([
      supabase.from('listings').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').order('booking_date', { ascending: false })
    ]);

    if (listingsRes.error) throw listingsRes.error;
    if (bookingsRes.error) throw bookingsRes.error;

    state.cropListings = listingsRes.data || [];
    state.myBookings = bookingsRes.data || [];
  } catch (err) {
    console.warn('Sync failed, using offline cache:', err.message);
    // Silent fallback to avoid breaking UI flow
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
          <i class="fa-solid fa-circle-check"></i> Verified
        </div>
        <img class="profile-img" src="https://ui-avatars.com/api/?name=Ram+Singh&background=1B4332&color=fff&rounded=true" alt="User">
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
        <span>Dashboard</span>
      </div>
      <div class="nav-link ${state.currentView === 'marketplace' ? 'active' : ''}" data-view="marketplace">
        <i class="fa-solid fa-shop"></i>
        <span>Marketplace</span>
      </div>
      <div class="nav-link ${state.currentView === 'add-listing' ? 'active' : ''}" data-view="add-listing">
        <i class="fa-solid fa-circle-plus"></i>
        <span>Add Listing</span>
      </div>
      <div class="nav-link ${state.currentView === 'services' ? 'active' : ''}" data-view="services">
        <i class="fa-solid fa-truck-pickup"></i>
        <span>Rentals</span>
      </div>
      <div class="nav-link ${state.currentView === 'agri-store' ? 'active' : ''}" data-view="agri-store">
        <i class="fa-solid fa-bag-shopping"></i>
        <span>Agri Store</span>
      </div>
      <div class="nav-link ${state.currentView === 'mandi-markets' ? 'active' : ''}" data-view="mandi-markets">
        <i class="fa-solid fa-chart-line"></i>
        <span>Mandi Prices</span>
      </div>
      <div class="nav-link ${state.currentView === 'news' ? 'active' : ''}" data-view="news">
        <i class="fa-solid fa-newspaper"></i>
        <span>Agri-Buzz</span>
      </div>
      <div class="nav-link ${state.currentView === 'inbox' ? 'active' : ''}" data-view="inbox">
        <i class="fa-solid fa-message"></i>
        <span>Messages</span>
      </div>
      <div class="nav-link ${state.currentView === 'forum' ? 'active' : ''}" data-view="forum">
        <i class="fa-solid fa-users"></i>
        <span>Community</span>
      </div>
      <div class="nav-link ${state.currentView === 'my-activity' ? 'active' : ''}" data-view="my-activity">
        <i class="fa-solid fa-chart-pie"></i>
        <span>Activity & Insights</span>
      </div>
      ${state.profile?.role === 'admin' ? `
        <div class="nav-link ${state.currentView === 'admin' ? 'active' : ''}" data-view="admin">
          <i class="fa-solid fa-user-shield"></i>
          <span>Admin Panel</span>
        </div>
      ` : ''}
    </nav>
    <div class="sidebar-footer" style="margin-top: auto; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <div style="margin-bottom: 1.5rem;">
        <div style="font-weight: 700; font-size: 0.95rem; color: var(--accent);">${state.profile?.full_name || 'User'}</div>
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
          <p style="opacity: 0.9; margin-bottom: 1.5rem;">Market prices for <strong>Wheat</strong> have increased by 2.4% today in your local mandi.</p>
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
          <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">Local Weather</h2>
          <div style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 10px;">
            ${['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'].map((day, i) => `
              <div style="text-align: center; min-width: 60px; padding: 10px; background: #f9f9f9; border-radius: 12px;">
                <div style="font-size: 0.8rem; color: grey;">${day}</div>
                <i class="fa-solid fa-${i % 3 === 0 ? 'sun' : i % 2 === 0 ? 'cloud-sun' : 'cloud-showers-heavy'}" style="margin: 8px 0; color: var(--primary);"></i>
                <div style="font-weight: 700; font-size: 0.9rem;">${24 + i}°</div>
              </div>
            `).join('')}
          </div>
          <p style="font-size: 0.75rem; color: #059669; margin-top: 10px;"><i class="fa-solid fa-circle-info"></i> Good conditions for harvest.</p>
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
  const services = [
    { title: 'Mahindra Arjun 555', type: 'Tractor', price: 1500, img: 'https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400' },
    { title: 'John Deere Harvester', type: 'Harvester', price: 5000, img: 'https://images.unsplash.com/photo-1594411133036-f6d28892ea58?auto=format&fit=crop&q=80&w=400' },
    { title: 'Water Pump 5HP', type: 'Irrigation', price: 300, img: 'https://images.unsplash.com/photo-1563911891283-da61972637a0?auto=format&fit=crop&q=80&w=400' },
    { title: 'Drip System Installation', type: 'Service', price: 10000, img: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?auto=format&fit=crop&q=80&w=400' }
  ];

  return `
    <div class="fade-in">
      ${Header('Agri Services & Rentals')}
      <div style="margin-bottom: 3rem;">
        <h2 style="margin-bottom: 1.5rem;">Equipment Rental</h2>
        <div class="marketplace-grid">
          ${services.map(s => `
            <div class="crop-card">
              <img src="${s.img}" class="crop-image">
              <div class="crop-details">
                <div style="display:flex; justify-content:space-between;">
                  <div class="crop-name">${s.title}</div>
                  <span style="font-size: 0.75rem; background: #f0fdf4; color: var(--primary); padding: 4px 8px; border-radius: 6px; height: fit-content;">${s.type}</span>
                </div>
                <div class="crop-location" style="margin-top: 4px;">Available in Nagpur Region</div>
                <div class="crop-footer">
                  <span class="price">₹${s.price.toLocaleString()}/day</span>
                  <button class="btn-primary" onclick="window.bookService('${s.title}', ${s.price})">Rent Now</button>
                </div>
              </div>
            </div>
          `).join('')}
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
  const products = [
    { id: 's1', name: 'High-Yield Wheat Seeds', brand: 'Mahyco', price: 1200, unit: '20kg Bag', category: 'Seeds', img: 'https://images.unsplash.com/photo-1574943320219-553eb213f721?auto=format&fit=crop&q=80&w=400' },
    { id: 'f1', name: 'Organic NPK Fertilizer', brand: 'IFFCO', price: 850, unit: '50kg Bag', category: 'Fertilizer', img: 'https://images.unsplash.com/photo-1628350210274-3c82b33b0394?auto=format&fit=crop&q=80&w=400' },
    { id: 'p1', name: 'Neem-based Pesticide', brand: 'AgroPlus', price: 450, unit: '1 Liter', category: 'Pesticide', img: 'https://images.unsplash.com/photo-1590650046871-92c887180603?auto=format&fit=crop&q=80&w=400' },
    { id: 's2', name: 'Hybrid Cotton Seeds', brand: 'UPL', price: 980, unit: 'Pkt', category: 'Seeds', img: 'https://images.unsplash.com/photo-1599307737691-893693fb58c1?auto=format&fit=crop&q=80&w=400' }
  ];

  return `
    <div class="fade-in">
      ${Header('Agri Store')}
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem; overflow-x: auto;">
        ${['All', 'Seeds', 'Fertilizer', 'Pesticides', 'Tools'].map(cat => `
          <button class="btn-primary" style="background: ${cat === 'All' ? 'var(--primary)' : 'white'}; color: ${cat === 'All' ? 'white' : 'var(--text-main)'}; border: 1px solid #eee; white-space: nowrap;">${cat}</button>
        `).join('')}
      </div>

      <div class="marketplace-grid">
        ${products.map(p => `
          <div class="crop-card">
            <img src="${p.img}" class="crop-image">
            <div class="crop-details">
              <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 600; text-transform: uppercase;">${p.brand}</div>
              <div class="crop-name" style="margin: 4px 0;">${p.name}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">${p.unit}</div>
              <div class="crop-footer">
                <span class="price">₹${p.price}</span>
                <button class="btn-primary" onclick="alert('Item added to cart!')">Buy Now</button>
              </div>
            </div>
          </div>
        `).join('')}
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
  const filtered = state.cropListings.filter(c =>
    c.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    (c.pincode && c.pincode.includes(state.filters.pincode))
  );

  return `
    <div class="fade-in">
      ${Header('Marketplace')}
      <div style="display: grid; grid-template-columns: 260px 1fr; gap: 2.5rem;">
        <aside class="glass-card" style="height: fit-content; position: sticky; top: 2.5rem;">
          <h3 style="margin-bottom: 1.5rem;">Filter Selection</h3>
          <div style="margin-bottom: 1.5rem;">
            <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom: 8px;">Area Pincode</label>
            <input type="text" id="filter-pincode" placeholder="e.g. 4400" value="${state.filters.pincode}" 
                   style="width:100%; padding:10px; border-radius:10px; border:1px solid #E5E7EB; outline:none;">
          </div>
          <button class="btn-primary" style="width:100%;" onclick="fetchAllData()">Reset Filters</button>
        </aside>
        
        <section class="marketplace-grid">
          ${filtered.map(crop => `
            <div class="crop-card">
              <img src="${crop.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'}" class="crop-image">
              <div class="crop-details">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="crop-name">${crop.name}</div>
                  ${crop.is_verified ? '<i class="fa-solid fa-certificate" style="color:#2D6A4F;" title="Verified"></i>' : ''}
                </div>
                <div class="crop-location"><i class="fa-solid fa-location-dot"></i> ${crop.location || 'Local'} (${crop.pincode})</div>
                <div class="crop-footer">
                  <span class="price">₹${crop.price}/${crop.unit}</span>
                  <button class="btn-primary" onclick="window.showListing('${crop.id}')">Details</button>
                </div>
              </div>
            </div>
          `).join('') || '<div style="grid-column:1/-1; text-align:center; padding:4rem;">No crops match your search.</div>'}
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
        <button type="submit" class="btn-primary" style="padding:16px; font-size:1rem; margin-top:1rem;">Publish to Marketplace</button>
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
            <div style="font-size: 1.75rem; font-weight: 800; color: #1E3A8A; margin: 8px 0;">1,284</div>
            <div style="font-size: 0.75rem; color: #2563EB;">64 new this week</div>
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

const ForumView = () => `
  <div class="fade-in">
    ${Header('Community Forum')}
    <div class="dashboard-grid">
      <section>
        <div class="glass-card" style="margin-bottom: 1.5rem; border-left: 5px solid var(--secondary);">
          <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
            <img src="https://ui-avatars.com/api/?name=JS&background=random" style="width: 40px; border-radius: 50%;">
            <div>
              <div style="font-weight:700;">Jagdish Sharma</div>
              <div style="font-size: 0.75rem; color: grey;">2 hours ago • <span style="color: var(--secondary);">Best Practices</span></div>
            </div>
          </div>
          <h3 style="margin-bottom: 0.5rem;">How to protect Wheat from early heat?</h3>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">With temperatures rising early this year, I recommend light irrigation during late evenings to keep the soil cool...</p>
          <div style="margin-top: 1rem; display: flex; gap: 1.5rem; font-size: 0.85rem; color: grey;">
            <span><i class="fa-solid fa-comment"></i> 14 Replies</span>
            <span><i class="fa-solid fa-heart"></i> 45 Likes</span>
          </div>
        </div>

        <div class="glass-card" style="margin-bottom: 1.5rem;">
          <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
            <img src="https://ui-avatars.com/api/?name=RP&background=random" style="width: 40px; border-radius: 50%;">
            <div>
              <div style="font-weight:700;">Rajesh Patel</div>
              <div style="font-size: 0.75rem; color: grey;">6 hours ago • <span style="color: var(--secondary);">Seeds Query</span></div>
            </div>
          </div>
          <h3 style="margin-bottom: 0.5rem;">Which hybrid seed is best for cotton this season?</h3>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">I am looking for BG2 variety that is resistant to pink bollworm. Any suggestions on reliable vendors in Maharashtra?</p>
          <div style="margin-top: 1rem; display: flex; gap: 1.5rem; font-size: 0.85rem; color: grey;">
            <span><i class="fa-solid fa-comment"></i> 8 Replies</span>
            <span><i class="fa-solid fa-heart"></i> 22 Likes</span>
          </div>
        </div>

        <button class="btn-primary" style="width: 100%; border-radius: 50px;">Start New Discussion</button>
      </section>

      <aside>
        <div class="glass-card">
          <h3 style="margin-bottom: 1rem;">Top Contributors</h3>
          ${['Amit Verma', 'Sanjay G.', 'Kavita Rao'].map(name => `
            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 15px;">
              <img src="https://ui-avatars.com/api/?name=${name}&background=1B4332&color=fff" style="width: 35px; border-radius: 8px;">
              <div>
                <div style="font-weight:600; font-size: 0.9rem;">${name}</div>
                <div style="font-size: 0.7rem; color: var(--secondary);">Expert Contributor</div>
              </div>
            </div>
          `).join('')}
        </div>
      </aside>
    </div>
  </div>
`;

const NewsView = () => {
  const articles = [
    { title: 'New MSP for Kharif Crops Announced', date: 'Jan 13', category: 'Policy', img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=400' },
    { title: '5 Tips to increase Soil Organic Carbon', date: 'Jan 12', category: 'Tips', img: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=400' },
    { title: 'Drip Irrigation Subsidy starting next month', date: 'Jan 10', category: 'Scheme', img: 'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?auto=format&fit=crop&q=80&w=400' }
  ];

  return `
    <div class="fade-in">
      ${Header('Agri-Buzz: Farming News')}
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
        ${articles.map(a => `
          <div class="crop-card">
            <img src="${a.img}" class="crop-image" style="height: 180px;">
            <div class="crop-details">
              <span style="font-size: 0.7rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">${a.category}</span>
              <h3 style="font-size: 1.1rem; margin: 8px 0;">${a.title}</h3>
              <div style="font-size: 0.8rem; color: grey; margin-top: auto;">Published ${a.date}, 2026</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
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
        <div style="color: grey; font-size: 0.8rem;">Pending KYC</div>
        <div style="font-size: 2rem; font-weight: 800;">12</div>
      </div>
      <div class="glass-card">
        <div style="color: grey; font-size: 0.8rem;">Platform Revenue</div>
        <div style="font-size: 2rem; font-weight: 800;">₹42.5k</div>
      </div>
    </div>
    <div class="glass-card">
      <h2 style="margin-bottom: 1.5rem;">User Verification Queue</h2>
      <div class="mandi-item">
        <div><strong>Ram Lakhan</strong> (Farmer) • Pincode: 440023</div>
        <div><button class="btn-primary" onclick="alert('Farmer Verified!')">Approve KYC</button></div>
      </div>
      <div class="mandi-item">
        <div><strong>Fresh Mart</strong> (Buyer) • GST Verified</div>
        <div><button class="btn-primary" onclick="alert('Business Verified!')">Verify Business</button></div>
      </div>
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
      state.searchQuery = e.target.value;
      render();
      document.getElementById('global-search').focus();
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
      const d = new FormData(form);
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
        image_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400'
      };

      const { error } = await supabase.from('listings').insert([payload]);
      if (!error) {
        alert('Listing live on KhetGo!');
        window.setView('marketplace');
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

  // Dashboard & Market Charts
  initCharts();
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
