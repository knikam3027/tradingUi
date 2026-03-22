const { HDFC_BASE_URL, HDFC_API_KEY, HDFC_API_SECRET, HDFC_ACCESS_TOKEN, USER_AGENT } = require('../config');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '..', 'data', 'access-token.json');

let accessToken = null;
let tokenId = null; // session token ID for multi-step login

// Check if a JWT token is expired (with 60s buffer)
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (payload.exp) return Date.now() / 1000 > payload.exp - 60;
  } catch (_) {}
  return false;
}

// Save token to persistent file (lives in Docker volume - survives restarts)
function persistToken(token) {
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken: token, savedAt: new Date().toISOString() }), 'utf8');
  } catch (err) {
    console.error('Failed to persist token:', err.message);
  }
}

// Load token on startup: try file first, then .env
function loadPersistedToken() {
  // 1. Token file (in Docker volume — survives container rebuilds)
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (data.accessToken && !isTokenExpired(data.accessToken)) {
        accessToken = data.accessToken;
        console.log('HDFC Sky: loaded token from persistent storage');
        return;
      } else if (data.accessToken) {
        console.warn('HDFC Sky: persisted token is expired');
        fs.unlinkSync(TOKEN_FILE);
      }
    }
  } catch (_) {}

  // 2. .env token
  if (HDFC_ACCESS_TOKEN) {
    if (!isTokenExpired(HDFC_ACCESS_TOKEN)) {
      accessToken = HDFC_ACCESS_TOKEN;
      console.log('HDFC Sky: loaded token from .env');
      // Persist it so future restarts use the file
      persistToken(HDFC_ACCESS_TOKEN);
    } else {
      console.warn('HDFC Sky: HDFC_ACCESS_TOKEN in .env is expired - visit /auth/login to re-authenticate');
    }
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };

function apiUrl(endpoint, extraParams = {}) {
  const params = new URLSearchParams({ api_key: HDFC_API_KEY, ...extraParams });
  return `${HDFC_BASE_URL}${endpoint}?${params}`;
}

async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Step 1: Get a tokenId for the login session
async function getTokenId() {
  const data = await safeFetch(apiUrl('/login'), { headers: { 'User-Agent': USER_AGENT } });
  if (data.tokenId) tokenId = data.tokenId;
  return data;
}

// Step 2: Validate username (sends OTP)
async function loginValidate(username, tid) {
  const id = tid || tokenId;
  if (!id) throw new Error('No tokenId - call getTokenId first');
  return safeFetch(apiUrl('/login-channel/validate', { token_id: id }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ username }),
  });
}

// Step 3: Validate OTP
async function validateOTP(otp, tid) {
  const id = tid || tokenId;
  if (!id) throw new Error('No tokenId');
  return safeFetch(apiUrl('/otp/validate', { token_id: id }), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ otp }),
  });
}

// Step 4: Validate 2FA PIN
async function validate2FA(pin, tid) {
  const id = tid || tokenId;
  if (!id) throw new Error('No tokenId');
  return safeFetch(apiUrl('/twofa/validate', { token_id: id }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ answer: pin }),
  });
}

// Step 5: Authorize and get final request token
async function authorize(requestToken, tid) {
  const id = tid || tokenId;
  if (!id) throw new Error('No tokenId');
  return safeFetch(
    apiUrl('/authorise', { token_id: id, consent: 'true', request_token: requestToken }),
    { headers: { 'User-Agent': USER_AGENT } }
  );
}

// Step 6: Exchange request token for access token
async function exchangeToken(requestToken) {
  const data = await safeFetch(
    apiUrl('/access-token', { request_token: requestToken }),
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ apiSecret: HDFC_API_SECRET }),
    }
  );
  if (data.accessToken) {
    accessToken = data.accessToken;
  }
  return data;
}

function getAccessToken() {
  return accessToken;
}

function setAccessToken(token) {
  accessToken = token;
  if (token) {
    persistToken(token);
  } else {
    // Clear persisted token on logout/expiry
    try { if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE); } catch (_) {}
  }
}

function getTokenIdValue() {
  return tokenId;
}

function isConnected() {
  if (!accessToken) return false;
  if (isTokenExpired(accessToken)) {
    console.warn('HDFC Sky: access token expired - clearing');
    setAccessToken(null);
    return false;
  }
  return true;
}

module.exports = {
  loadPersistedToken,
  getTokenId,
  loginValidate,
  validateOTP,
  validate2FA,
  authorize,
  exchangeToken,
  getAccessToken,
  setAccessToken,
  getTokenIdValue,
  isConnected,
};
