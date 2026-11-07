const BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Converts raw backend API errors, Pydantic 422 validations,
 * or network failures into friendly, user-readable error messages.
 */
function formatApiError(res, errJson, fallbackStatusText) {
  if (errJson) {
    // 1. FastAPI / Pydantic validation errors (array of field errors)
    if (Array.isArray(errJson.detail)) {
      const fieldLabels = {
        title: 'Review title',
        body: 'Review description',
        rating: 'Star rating',
        customer_name: 'Customer name',
        customer_email: 'Email address',
        sku: 'Product SKU',
        product_name: 'Product name',
        channel: 'Sales channel',
        images: 'Uploaded photos',
        image_url: 'Photo URL'
      };

      const messages = errJson.detail.map((item) => {
        const rawField = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : '';
        const fieldName = fieldLabels[rawField] || (rawField ? rawField.replace(/_/g, ' ') : '');
        let msg = item.msg || 'is invalid';

        // Translate typical pydantic messages into user-friendly prose
        msg = msg.replace(/^String should have at least (\d+) characters/, 'must be at least $1 characters long');
        msg = msg.replace(/^String should have at most (\d+) characters/, 'must be under $1 characters');
        msg = msg.replace(/^Input should be a valid string/, 'must be valid text');
        msg = msg.replace(/^Field required/, 'is required');
        msg = msg.replace(/^Value error, /, '');

        return fieldName ? `${fieldName} ${msg}` : msg;
      });

      return messages.join('. ');
    }

    // 2. Direct string detail from backend (e.g., HTTPException(status_code=400, detail="..."))
    if (typeof errJson.detail === 'string' && errJson.detail.trim()) {
      return errJson.detail;
    }

    // 3. Message property
    if (typeof errJson.message === 'string' && errJson.message.trim()) {
      return errJson.message;
    }
  }

  // 4. Meaningful fallbacks based on HTTP status code
  if (res) {
    if (res.status === 400) return 'Invalid submission. Please review your details and try again.';
    if (res.status === 404) return 'The requested review or product was not found.';
    if (res.status === 413) return 'The uploaded photos are too large. Please upload smaller images (under 4MB each).';
    if (res.status === 422) return 'Please check the review fields and correct any highlighted errors.';
    if (res.status === 500) return 'A server error occurred while processing your review. Please try again in a moment.';
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return 'The backend service is currently unreachable. Please make sure the backend server is running on port 8001.';
    }
  }

  return fallbackStatusText || 'Something went wrong while processing your request. Please try again.';
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let friendlyMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        friendlyMessage = formatApiError(res, errJson, res.statusText);
      } catch (_) {
        friendlyMessage = formatApiError(res, null, res.statusText);
      }
      throw new Error(friendlyMessage);
    }
    return await res.json();
  } catch (err) {
    // Catch browser-level connection failures (e.g. backend server offline or CORS issue)
    if (err.name === 'TypeError' && typeof err.message === 'string' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to connect to the backend server. Please verify the server is running on http://localhost:8001.');
    }
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Reviews
  getReviews: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.rating) q.append('rating', params.rating);
    if (params.search) q.append('search', params.search);
    if (params.sku) q.append('sku', params.sku);
    if (params.channel) q.append('channel', params.channel);
    if (params.sort) q.append('sort', params.sort);
    if (params.limit) q.append('limit', params.limit);
    return request(`/api/reviews?${q.toString()}`);
  },

  submitReview: (reviewData) => {
    return request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  voteReview: (id, voteType) => {
    return request(`/api/reviews/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_type: voteType })
    });
  },

  updateReview: (id, updateData) => {
    return request(`/api/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  // Moderation
  getModerationQueue: (params = {}) => {
    const q = new URLSearchParams();
    if (params.tab) q.append('tab', params.tab);
    if (params.search) q.append('search', params.search);
    if (params.sku) q.append('sku', params.sku);
    if (params.min_toxicity) q.append('min_toxicity', params.min_toxicity);
    return request(`/api/moderation/queue?${q.toString()}`);
  },

  executeAction: (reviewId, action, note = '', moderatorName = 'Eleanor Vance') => {
    return request(`/api/moderation/reviews/${reviewId}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, note, moderator_name: moderatorName })
    });
  },

  executeBulkAction: (reviewIds, action, note = '', moderatorName = 'Eleanor Vance') => {
    return request('/api/moderation/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ review_ids: reviewIds, action, note, moderator_name: moderatorName })
    });
  },

  getRules: () => {
    return request('/api/moderation/rules');
  },

  updateRules: (rulesData) => {
    return request('/api/moderation/rules', {
      method: 'PUT',
      body: JSON.stringify(rulesData)
    });
  },

  // Analytics
  getAnalyticsOverview: () => {
    return request('/api/analytics/overview');
  },

  // Products
  getProducts: () => {
    return request('/api/products');
  },

  createProduct: (productData) => {
    return request('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  // Tags & Channels from MongoDB
  getTags: () => {
    return request('/api/tags');
  },

  getChannels: () => {
    return request('/api/channels');
  }
};
