const router = require('express').Router();
const {
  createDoctor, updateDoctor, listDoctors, addLeave, allAppointments,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.post('/doctors', createDoctor);
router.get('/doctors', listDoctors);
router.patch('/doctors/:id', updateDoctor);
router.post('/doctors/:id/leave', addLeave);
router.get('/appointments', allAppointments);

module.exports = router;
