const router = require('express').Router();
const { searchDoctors, getAvailableSlots } = require('../controllers/doctorController');
const { protect } = require('../middleware/auth');

router.get('/', protect, searchDoctors);
router.get('/:id/slots', protect, getAvailableSlots);

module.exports = router;
