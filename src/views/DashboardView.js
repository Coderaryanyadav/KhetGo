import { state, t } from '../state';
import { Header } from '../components/Header';
import { sanitizeHTML, formatCurrency } from '../utils';

export const DashboardView = () => `
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
              <button class="btn-primary" onclick="window.setView('add-listing')">Post Your Harvest</button>
              <button class="btn-outline" style="border-color: rgba(255,255,255,0.3); color: white;" onclick="window.setView('marketplace')">Explore Market</button>
            </div>
          </div>
        </div>
        
        <div class="section-title" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h2 style="font-size: 1.75rem; color: var(--text-main);">Market Trends</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time opportunities in your region</p>
          </div>
          <button class="btn-ghost" style="color: var(--secondary); display: flex; align-items: center; gap: 8px; font-weight: 800; cursor: pointer;" onclick="window.setView('marketplace')">
            Manage Global Ecosystem <i class="fa-solid fa-arrow-right-long"></i>
          </button>
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
              <button class="btn-primary" style="margin-top: 1.5rem; padding: 14px 40px;" onclick="window.setView('add-listing')">Initialize New Listing</button>
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

        <div class="glass-card" style="margin-top: 2rem;">
          <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">Price Trends (Wheat)</h2>
          <canvas id="mandi-mini-chart" style="max-height: 150px;"></canvas>
        </div>
      </aside>
    </div>
  </div>
`;
