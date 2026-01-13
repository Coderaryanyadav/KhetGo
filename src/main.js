import './style.css'
import { supabase } from './supabase'

/**
 * SQL SCHEMA FOR SUPABASE:
 * 
 * -- Listings table
 * create table listings (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text not null,
 *   price numeric not null,
 *   unit text not null,
 *   pincode text not null,
 *   location text,
 *   farmer text default 'Ram Singh',
 *   image_url text,
 *   category text,
 *   is_verified boolean default true,
 *   created_at timestamp with time zone default timezone('utc'::text, now())
 * );
 * 
 * -- Bookings table
 * create table bookings (
 *   id uuid default uuid_generate_v4() primary key,
 *   item_name text not null,
 *   item_type text,
 *   price_per_unit numeric,
 *   user_name text default 'Ram Singh',
 *   booking_date timestamp with time zone default timezone('utc'::text, now())
 * );
 */

// --- App State ---
let state = {
  currentView: 'dashboard',
  searchQuery: '',
  filters: {
    pincode: '',
    distance: 25,
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
  isLoading: false
};

// --- Data Fetching ---
async function fetchAllData() {
  state.isLoading = true;
  render();

  try {
    // 1. Fetch Crop Listings
    const { data: listings, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (listingError) throw listingError;
    state.cropListings = listings || [];

    // 2. Fetch My Bookings
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false });

    if (bookingError) throw bookingError;
    state.myBookings = bookings || [];

  } catch (err) {
    console.error('Error fetching data:', err.message);
    // Fallback if Supabase is not connected
    if (!state.cropListings.length) {
      state.cropListings = [
        { id: 1, name: 'Organic Bell Peppers', farmer: 'Ram Singh', location: 'Nagpur, MH', pincode: '440001', price: 40, unit: 'kg', image_url: 'https://images.unsplash.com/photo-1563513123303-aa514210e721?auto=format&fit=crop&q=80&w=400', is_verified: true, category: 'Fruits & Veggies' },
        { id: 2, name: 'Premium Alphonso Mangoes', farmer: 'Vikas Patil', location: 'Ratnagiri, MH', pincode: '415612', price: 800, unit: 'box', image_url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=400', is_verified: true, category: 'Fruits & Veggies' },
      ];
    }
  } finally {
    state.isLoading = false;
    render();
  }
}

// --- View Helpers ---
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
          <i class="fa-solid fa-check-circle"></i> Verified Farmer
        </div>
        <img src="https://ui-avatars.com/api/?name=Ram+Singh&background=1B4332&color=fff" style="width: 40px; border-radius: 50%;">
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
    <ul class="nav-links">
      <li class="nav-item">
        <a class="nav-link ${state.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
          <i class="fa-solid fa-house"></i>
          <span>Dashboard</span>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${state.currentView === 'marketplace' ? 'active' : ''}" data-view="marketplace">
          <i class="fa-solid fa-store"></i>
          <span>Marketplace</span>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${state.currentView === 'add-listing' ? 'active' : ''}" data-view="add-listing">
          <i class="fa-solid fa-plus-circle"></i>
          <span>Add Listing</span>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${state.currentView === 'services' ? 'active' : ''}" data-view="services">
          <i class="fa-solid fa-truck-tractor"></i>
          <span>Agri Services</span>
        </a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${state.currentView === 'my-activity' ? 'active' : ''}" data-view="my-activity">
          <i class="fa-solid fa-user-clock"></i>
          <span>My Activity</span>
        </a>
      </li>
    </ul>
  </aside>
`;

// --- Views ---
const DashboardView = () => `
  <div class="fade-in">
    ${Header('Farming Command Center')}
    <div class="dashboard-grid">
      <section class="main-stats">
        <div class="glass-card" style="margin-bottom: 2rem; background: linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%); color: white;">
          <h3>Welcome back, Ram Singh!</h3>
          <p style="opacity: 0.8; margin-top: 10px;">The market is currently showing a strong demand for Basmati Rice. Consider listing your produce.</p>
          <button class="btn-primary" style="margin-top: 20px; background: var(--accent); color: var(--primary);" onclick="window.setView('add-listing')">Publish New Listing</button>
        </div>
        
        <div class="section-title">
          <h2>Trending Crops</h2>
          <a href="#" style="color: var(--primary-light); font-weight: 600; text-decoration: none;" onclick="window.setView('marketplace')">Explore More</a>
        </div>
        <div class="marketplace-grid">
          ${state.cropListings.slice(0, 4).map(crop => `
            <div class="crop-card">
              <img src="${crop.image_url}" class="crop-image">
              <div class="crop-details">
                <div class="crop-name">${crop.name}</div>
                <div class="crop-location"><i class="fa-solid fa-location-dot"></i> ${crop.location || 'Local'}</div>
                <div class="crop-footer">
                  <span class="price">₹${crop.price}/${crop.unit}</span>
                  <button class="btn-primary" onclick="alert('Inquiry sent to ${crop.farmer}!')">Connect</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      
      <aside class="side-panel">
        <div class="glass-card">
          <div class="section-title">
            <h2>Mandi Prices</h2>
          </div>
          <div class="mandi-list">
            ${state.mandiPrices.map(item => `
              <div class="mandi-item">
                <div class="crop-info">
                  <div class="crop-icon" style="background: #f0f7f3; padding: 8px; border-radius: 8px; color: var(--primary);">
                    <i class="fa-solid fa-seedling"></i>
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${item.crop}</div>
                    <div style="font-size: 0.75rem; color: #888;">${item.unit}</div>
                  </div>
                </div>
                <div class="price-stats">
                  <div class="price">${item.price}</div>
                  <div class="trend ${item.trend}" style="font-size: 0.8rem; font-weight: 600;">
                    ${item.trend === 'up' ? '▲' : '▼'} ${item.change}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </aside>
    </div>
  </div>
`;

const MarketplaceView = () => {
  const filteredCrops = state.cropListings.filter(crop => {
    const matchesSearch = crop.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (crop.location && crop.location.toLowerCase().includes(state.searchQuery.toLowerCase()));
    const matchesPincode = state.filters.pincode ? crop.pincode.startsWith(state.filters.pincode) : true;
    return matchesSearch && matchesPincode;
  });

  return `
    <div class="fade-in">
      ${Header('Marketplace')}
      <div style="display: grid; grid-template-columns: 250px 1fr; gap: 2rem;">
        <aside class="filters glass-card" style="height: fit-content;">
          <h3>Filters</h3>
          <div style="margin-top: 1.5rem;">
            <label style="display: block; font-size: 0.9rem; margin-bottom: 8px; font-weight: 600;">Location (Pincode Pref)</label>
            <input type="text" id="filter-pincode" placeholder="e.g. 44" value="${state.filters.pincode}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd; outline: none;">
          </div>
        </aside>
        <section>
          <div class="marketplace-grid">
            ${filteredCrops.length > 0 ? filteredCrops.map(crop => `
              <div class="crop-card">
                <img src="${crop.image_url}" class="crop-image">
                <div class="crop-details">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="crop-name">${crop.name}</div>
                    ${crop.is_verified ? '<i class="fa-solid fa-certificate" style="color: #2D6A4F;" title="Verified Farmer"></i>' : ''}
                  </div>
                  <div class="crop-location"><i class="fa-solid fa-location-dot"></i> ${crop.location || 'Local'} (${crop.pincode})</div>
                  <div class="crop-footer">
                    <span class="price">₹${crop.price}/${crop.unit}</span>
                    <button class="btn-primary" onclick="alert('Inquiry sent to ${crop.farmer}!')">Connect</button>
                  </div>
                </div>
              </div>
            `).join('') : '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #888;">No crops found matching your search.</p>'}
          </div>
        </section>
      </div>
    </div>
  `;
};

const AddListingView = () => `
  <div class="fade-in">
    ${Header('Add New Listing')}
    <div class="glass-card" style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 24px;">
      <h2 style="margin-bottom: 1.5rem;">List Your Crop</h2>
      <form id="listing-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 600;">Crop Name</label>
          <input type="text" name="name" required placeholder="e.g. Organic Wheat" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #ddd;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Price (₹)</label>
            <input type="number" name="price" required placeholder="per unit" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #ddd;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Unit</label>
            <select name="unit" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #ddd;">
              <option value="kg">kg</option>
              <option value="quintal">quintal</option>
              <option value="ton">ton</option>
              <option value="box">box</option>
            </select>
          </div>
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 600;">Pincode</label>
          <input type="text" name="pincode" required placeholder="Enter 6-digit pincode" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #ddd;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: 600;">Image URL</label>
          <input type="url" name="image_url" placeholder="Paste image link" value="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #ddd;">
        </div>
        <button type="submit" class="btn-primary" style="padding: 15px;">Publish to KhetGo</button>
      </form>
    </div>
  </div>
`;

const ServicesView = () => `
  <div class="fade-in">
    ${Header('Agri Services')}
    <div class="section-title">
      <h2>Rent Machinery</h2>
    </div>
    <div class="marketplace-grid">
      <div class="crop-card">
        <img src="https://images.unsplash.com/photo-1530267981375-f0de937f5f13?auto=format&fit=crop&q=80&w=400" class="crop-image">
        <div class="crop-details">
          <div class="crop-name">Mahindra Arjun 555</div>
          <div class="crop-location">Tractor</div>
          <div class="crop-footer">
            <span class="price">₹1,500/day</span>
            <button class="btn-primary" onclick="window.bookService('Mahindra Arjun', 'Tractor', 1500)">Book Now</button>
          </div>
        </div>
      </div>
      <!-- Add more items directly or from loop -->
    </div>
  </div>
`;

const MyActivityView = () => `
  <div class="fade-in">
    ${Header('My Activity')}
    <div class="dashboard-grid">
      <section>
        <div class="section-title"><h2>Active Listings</h2></div>
        <div class="mandi-list">
          ${state.cropListings.filter(c => c.farmer === 'Ram Singh').map(listing => `
            <div class="mandi-item">
              <div class="crop-info">
                <i class="fa-solid fa-leaf" style="color: var(--primary);"></i>
                <span>${listing.name} - ₹${listing.price}/${listing.unit}</span>
              </div>
              <button style="border:none; color: red; background: none; cursor: pointer;" onclick="window.deleteListing('${listing.id}')">Delete</button>
            </div>
          `).join('') || '<p>No listings found.</p>'}
        </div>
      </section>
      <section>
        <div class="section-title"><h2>Service Bookings</h2></div>
        <div class="mandi-list">
          ${state.myBookings.map(b => `
            <div class="mandi-item">
              <div class="crop-info">
                <i class="fa-solid fa-truck" style="color: var(--primary);"></i>
                <span>${b.item_name} (${b.item_type})</span>
              </div>
              <div style="font-size: 0.8rem; color: #888;">${new Date(b.booking_date).toLocaleDateString()}</div>
            </div>
          `).join('') || '<p>No bookings found.</p>'}
        </div>
      </section>
    </div>
  </div>
`;

// --- Actions ---
window.setView = (view) => {
  state.currentView = view;
  render();
};

window.bookService = async (name, type, price) => {
  try {
    const { error } = await supabase.from('bookings').insert([{
      item_name: name,
      item_type: type,
      price_per_unit: price
    }]);
    if (error) throw error;
    alert('Booking confirmed!');
    fetchAllData();
  } catch (err) {
    alert('Error booking: ' + err.message);
  }
};

window.deleteListing = async (id) => {
  if (!confirm('Are you sure you want to delete this listing?')) return;
  try {
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) throw error;
    fetchAllData();
  } catch (err) {
    alert('Error deleting: ' + err.message);
  }
};

// --- Main Render Function ---
function render() {
  const app = document.querySelector('#app');
  if (state.isLoading && !state.cropListings.length) {
    app.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; width:100%;"><h2>Syncing with KhetGo...</h2></div>';
    return;
  }

  let content = '';
  switch (state.currentView) {
    case 'dashboard': content = DashboardView(); break;
    case 'marketplace': content = MarketplaceView(); break;
    case 'add-listing': content = AddListingView(); break;
    case 'services': content = ServicesView(); break;
    case 'my-activity': content = MyActivityView(); break;
    default: content = DashboardView();
  }

  app.innerHTML = `
    ${Sidebar()}
    <main class="main-content">
      ${content}
    </main>
  `;

  attachHandlers();
}

function attachHandlers() {
  // Navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      window.setView(e.currentTarget.getAttribute('data-view'));
    });
  });

  // Search
  const search = document.getElementById('global-search');
  if (search) {
    search.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      render();
      document.getElementById('global-search').focus();
    });
  }

  // Filter
  const pincode = document.getElementById('filter-pincode');
  if (pincode) {
    pincode.addEventListener('input', (e) => {
      state.filters.pincode = e.target.value;
      render();
      document.getElementById('filter-pincode').focus();
    });
  }

  // Listing Form
  const form = document.getElementById('listing-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const newListing = {
        name: formData.get('name'),
        price: parseFloat(formData.get('price')),
        unit: formData.get('unit'),
        pincode: formData.get('pincode'),
        image_url: formData.get('image_url'),
        farmer: 'Ram Singh',
        is_verified: true
      };

      try {
        const { error } = await supabase.from('listings').insert([newListing]);
        if (error) throw error;
        alert('Listing Published Successfully!');
        window.setView('marketplace');
        fetchAllData();
      } catch (err) {
        alert('Error publishing: ' + err.message);
      }
    });
  }
}

// Initial Data Load
fetchAllData();
render();
