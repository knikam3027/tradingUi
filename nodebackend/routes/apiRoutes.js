const router = require('express').Router();
const authController = require('../controllers/authController');
const marketController = require('../controllers/marketController');

router.get('/auth/status', authController.status);
router.get('/market/nifty-price', marketController.niftyPrice);
router.get('/market/strikes', marketController.niftyStrikes);
router.get('/market/strikes/translate/self-test', marketController.translateStraddleSeriesSelfTest);
router.post('/market/strikes/translate', marketController.translateStraddleSeries);

module.exports = router;
