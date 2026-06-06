// eventoRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import EventoController from '../controllers/eventoController.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `banner-${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imagenes'), false);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const router = express.Router();

router.get('/', EventoController.getAll);
router.get('/:id', EventoController.getById);
router.post('/', upload.single('banner'), EventoController.create);
router.put('/:id', upload.single('banner'), EventoController.update);
router.delete('/:id', EventoController.remove);

export default router;
