const { HDFC_BASE_URL, HDFC_API_KEY, HDFC_API_SECRET, HDFC_ACCESS_TOKEN, USER_AGENT } = require('../config');

let accessToken = HDFC_ACCESS_TOKEN;
let tokenId = null; // session token ID for multi-step login

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
}

function getTokenIdValue() {
  return tokenId;
}

function isConnected() {
  return !!accessToken;
}

module.exports = {
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
