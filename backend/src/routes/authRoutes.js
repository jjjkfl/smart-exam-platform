const router = require('express').Router();
const authCtrl = require('../controllers/authController');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/verify-reset-code', authCtrl.verifyResetCode);
router.post('/reset-password', authCtrl.resetPassword);

module.exports = router;