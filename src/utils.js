/**
 * Security Utilities for KhetGo
 * Sanitization and validation functions
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} Sanitized text safe for HTML injection
 */
export function sanitizeHTML(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.body.textContent || "";
}

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHTML(str) {
    if (!str) return '';

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return String(str).replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function validatePhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
}

/**
 * Validate pincode (Indian format)
 * @param {string} pincode - Pincode to validate
 * @returns {boolean} True if valid
 */
export function validatePincode(pincode) {
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    return pincodeRegex.test(pincode);
}

/**
 * Validate price
 * @param {string|number} price - Price to validate
 * @returns {boolean} True if valid
 */
export function validatePrice(price) {
    const num = parseFloat(price);
    return !isNaN(num) && num > 0 && num < 1000000;
}

/**
 * Validate quantity
 * @param {string} quantity - Quantity to validate
 * @returns {boolean} True if valid
 */
export function validateQuantity(quantity) {
    return quantity && quantity.trim().length > 0 && quantity.length < 100;
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateImageFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'Image size must be less than 5MB' };
    }

    return { valid: true };
}

/**
 * Debounce function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 1000) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
export function generateUniqueId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type: success, error, warning, info
 */
export function showToast(message, type = 'info') {
    // Remove existing toasts
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Handle API errors gracefully
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 */
export function handleError(error, context = 'Operation') {
    console.error(`[${context}]`, error);

    let message = 'An unexpected error occurred. Please try again.';

    if (error.message) {
        message = error.message;
    }

    if (error.code === 'PGRST116') {
        message = 'No data found';
    } else if (error.code === '23505') {
        message = 'This item already exists';
    } else if (error.message.includes('network')) {
        message = 'Network error. Please check your internet connection.';
    }

    showToast(message, 'error');
    return message;
}

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise<any>} Result of function
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

/**
 * Check if user is authenticated
 * @param {object} user - User object
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated(user) {
    return user !== null && user !== undefined && user.id;
}

/**
 * Safe JSON parse
 * @param {string} str - JSON string
 * @param {any} fallback - Fallback value
 * @returns {any} Parsed object or fallback
 */
export function safeJSONParse(str, fallback = null) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
