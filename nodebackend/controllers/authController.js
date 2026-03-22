const { HDFC_BASE_URL, HDFC_API_KEY } = require('../config');
const {
  getTokenId, loginValidate, validateOTP, validate2FA, authorize,
  exchangeToken, setAccessToken, isConnected, getTokenIdValue,
} = require('../models/authModel');

exports.login = (req, res) => {
  const loginUrl = `${HDFC_BASE_URL}/login?api_key=${encodeURIComponent(HDFC_API_KEY)}`;
  res.redirect(loginUrl);
};

exports.callback = async (req, res) => {
  const requestToken = req.query.request_token || req.query.requestToken;
  if (!requestToken) {
    return res.status(400).json({ status: 'error', message: 'Missing request_token' });
  }

  try {
    const data = await exchangeToken(requestToken);
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      console.log('HDFC Sky access token obtained successfully');
      res.redirect('http://localhost:3000');
    } else {
      console.error('Failed to get access token:', data);
      res.status(401).json({ status: 'error', message: 'Failed to get access token', data });
    }
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.exchange = async (req, res) => {
  const requestToken = req.query.token;
  if (!requestToken) {
    return res.status(400).json({
      status: 'error',
      message: 'Usage: /auth/exchange?token=YOUR_REQUEST_TOKEN',
      hint: 'Copy the requestToken value from the cbamoon.com redirect URL',
    });
  }

  try {
    const data = await exchangeToken(requestToken);
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      console.log('HDFC Sky access token obtained via manual exchange');
      res.json({ status: 'success', message: 'Connected to HDFC Sky!', connected: true });
    } else {
      res.status(401).json({ status: 'error', message: 'Token exchange failed', data });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ── API-based login flow (no browser redirect needed) ───────────────────────

// Step 1: POST /auth/api/init → returns tokenId
exports.apiInit = async (req, res) => {
  try {
    const data = await getTokenId();
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Step 2: POST /auth/api/login { username }
exports.apiLogin = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ status: 'error', message: 'username required' });
    const data = await loginValidate(username);
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Step 3: POST /auth/api/otp { otp }
exports.apiOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ status: 'error', message: 'otp required' });
    const data = await validateOTP(otp);
    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// Step 4: POST /auth/api/pin { pin }
exports.apiPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ status: 'error', message: 'pin required' });
    const data = await validate2FA(pin);

    if (data.requestToken) {
      // Step 5 & 6: Authorize and exchange token automatically
      const authData = await authorize(data.requestToken);
      const finalToken = authData.requestToken || data.requestToken;
      const tokenData = await exchangeToken(finalToken);

      if (tokenData.accessToken) {
        setAccessToken(tokenData.accessToken);
        console.log('HDFC Sky connected via API login flow');
        return res.json({ status: 'success', connected: true, message: 'Connected to HDFC Sky!' });
      }
      return res.json({ status: 'partial', data: tokenData, message: 'Token exchange step - check data' });
    }

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.status = (req, res) => {
  res.json({
    status: 'success',
    connected: isConnected(),
    broker: 'HDFC Sky',
    tokenId: getTokenIdValue() ? 'active' : null,
  });
};
