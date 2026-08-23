const router = require('express').Router();
const {
  holdSlot, confirmBooking, myAppointments, doctorQueue, cancelAppointment, submitPostVisit,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

router.post('/hold', protect, authorize('patient'), holdSlot);
router.post('/confirm', protect, authorize('patient'), confirmBooking);
router.get('/my', protect, authorize('patient'), myAppointments);
router.get('/doctor/queue', protect, authorize('doctor'), doctorQueue);
router.post('/:id/cancel', protect, cancelAppointment);
router.post('/:id/post-visit', protect, authorize('doctor'), submitPostVisit);

module.exports = router;
