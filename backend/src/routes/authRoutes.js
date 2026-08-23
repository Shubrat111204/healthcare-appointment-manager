const router = require('express').Router();
const { registerPatient, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerPatient);
router.post('/login', login);
router.get('/me', protect, me);

module.exports = router;
