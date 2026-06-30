const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../../middleware/authentication');
const adminOnly = require('../../middleware/adminOnly');
const auditController = require('../../controllers/auditController');
const authController = require('../../controllers/authController');
const modalityStructureController = require('../../controllers/modalityStructureController');
const enrolmentRequestController = require('../../controllers/enrolmentRequestController');
const enrolmentPlanController = require('../../controllers/enrolmentPlanController');
const clubSettingsController = require('../../controllers/clubSettingsController');
const uploadController = require('../../controllers/uploadController');
const userController = require('../../controllers/userController');

const router = express.Router();
const employeeOnly = requireRole('Funcionario');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 }, fileFilter(req, file, callback) {
    if (!file.mimetype?.startsWith('image/')) {
      return callback(new Error('Apenas são permitidos ficheiros de imagem.'));
    } callback(null, true);
  }
});

const documentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter(req, file, callback) {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('Apenas são permitidos documentos PDF ou imagens.'));
    }
    callback(null, true);
  }
});
router.use(authenticate);

router.get('/auth/load-session', authController.me);

router.get('/audit/load', adminOnly, auditController.list);

router.post('/modalities/create', employeeOnly, modalityStructureController.create);
router.put('/modalities/update/:id', employeeOnly, modalityStructureController.update);
router.delete('/modalities/remove/:id', employeeOnly, modalityStructureController.remove);

router.get('/enrolments/load', employeeOnly, enrolmentRequestController.list);
router.get('/enrolments/load-club-stats', employeeOnly, enrolmentRequestController.storeStats);
router.post('/enrolments/create', employeeOnly, enrolmentRequestController.create);
router.patch('/enrolments/update-status/:id', employeeOnly, enrolmentRequestController.updateStatus);

router.post('/enrolment-plans/create', employeeOnly, enrolmentPlanController.create);
router.put('/enrolment-plans/update-images/:id', employeeOnly, enrolmentPlanController.updateImages);
router.put('/enrolment-plans/update/:id', employeeOnly, enrolmentPlanController.update);
router.delete('/enrolment-plans/remove/:id', employeeOnly, enrolmentPlanController.remove);

router.put('/club-settings/update', employeeOnly, adminOnly, clubSettingsController.updateSettings);
router.patch('/club-settings/update', employeeOnly, adminOnly, clubSettingsController.patchSettings);

router.post('/images/create', employeeOnly, upload.single('image'), uploadController.uploadImage);
router.post('/documents/create', employeeOnly, documentUpload.single('document'), uploadController.uploadDocument);
router.get('/documents/load/:id', employeeOnly, uploadController.getDocument);

router.get('/users/load', employeeOnly, userController.list);
router.post('/users/create-athlete', employeeOnly, userController.createAthlete);
router.post('/users/create-employee', adminOnly, userController.createEmployee);
router.put('/users/update-employee/:id', adminOnly, userController.updateEmployeeAccount);
router.patch('/users/update-status/:id', adminOnly, userController.toggleActive);
router.delete('/users/remove/:id', adminOnly, userController.removeUser);
router.put('/users/update-athlete-files/:id', employeeOnly, userController.updateAthleteFiles);
router.put('/users/update-profile', userController.updateOwnProfile);
router.put('/users/update-password', userController.changePassword);
router.put('/users/update-initial-password', userController.changeInitialPassword);
router.put('/users/update-personal-data', userController.savePersonalData);

module.exports = router;
