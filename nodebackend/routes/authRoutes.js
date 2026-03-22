const router = require('express').Router();
const authController = require('../controllers/authController');

// Browser-based login flow
router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.get('/exchange', authController.exchange);

// API-based login flow (no browser redirect)
router.post('/api/init', authController.apiInit);       // Step 1: get tokenId
router.post('/api/login', authController.apiLogin);      // Step 2: validate username → sends OTP
router.post('/api/otp', authController.apiOTP);          // Step 3: validate OTP
router.post('/api/pin', authController.apiPin);          // Step 4: validate PIN → auto-authorize + exchange

module.exports = router;
