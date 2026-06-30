const express = require('express');
const { authenticate, requireRole } = require('../../middleware/authentication');
const authController = require('../../controllers/authController');
const modalityStructureController = require('../../controllers/modalityStructureController');
const enrolmentPlanController = require('../../controllers/enrolmentPlanController');
const clubSettingsController = require('../../controllers/clubSettingsController');
const uploadController = require('../../controllers/uploadController');

const router = express.Router();
const internalOnly = [authenticate, requireRole('Funcionario')];

router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logoutUser);

router.get('/club-settings/load', internalOnly, clubSettingsController.getSettings);
router.get('/modalities/load', internalOnly, modalityStructureController.list);
router.get('/modalities/load-featured', internalOnly, modalityStructureController.featured);
router.get('/enrolment-plans/load', internalOnly, enrolmentPlanController.list);
router.get('/enrolment-plans/load-featured', internalOnly, enrolmentPlanController.featured);
router.get('/enrolment-plans/load/:id', internalOnly, enrolmentPlanController.getById);
router.get('/images/load/:id', internalOnly, uploadController.getImage);
router.get('/uploads/images/:id', internalOnly, uploadController.getImage);
router.get('/documents/load/:id', internalOnly, uploadController.getDocument);

module.exports = router;
