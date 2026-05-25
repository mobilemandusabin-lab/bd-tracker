const CONFIG = {
  API_BASE_URL: 'http://localhost:5000/api/v1',
  HEARTBEAT_INTERVAL: 5 * 60 * 1000,
  VERSION_CHECK_INTERVAL: 60 * 60 * 1000,
  API_PATTERNS: {
    LISTING: {
      method: 'POST',
      pattern: '/api/vendor/products',
      event_type: 'listing_created'
    },
    PRODUCT_DETAIL: {
      method: 'GET',
      pattern: '/api/vendor/products/',
      event_type: 'product_created'
    },
    PRODUCT_UPDATE: {
      method: 'PUT',
      pattern: '/api/vendor/products/',
      event_type: 'product_updated'
    },
    QC_APPROVE: {
      method: 'POST',
      pattern: '/api/quality-check/products/',
      suffix: '/approve',
      event_type: 'qc_approved'
    },
    QC_REJECT: {
      method: 'POST',
      pattern: '/api/quality-check/products/',
      suffix: '/reject',
      event_type: 'qc_rejected'
    }
  }
};
