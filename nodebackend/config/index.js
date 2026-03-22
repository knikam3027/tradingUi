const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  PORT: process.env.PORT || 8000,
  HDFC_BASE_URL: 'https://developer.hdfcsky.com/oapi/v1',
  HDFC_API_KEY: process.env.HDFC_API_KEY,
  HDFC_API_SECRET: process.env.HDFC_API_SECRET,
  HDFC_ACCESS_TOKEN: process.env.HDFC_ACCESS_TOKEN || null,
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  CORS_ORIGINS: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://cbamoon.com', 'https://www.cbamoon.com'],
};
