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

// Rutas del boleto NFT (contrato EventoNFT). Van ANTES de las rutas con :id para que
// "nft" no sea interpretado como un id (mismo cuidado que en el lab de facturas).
router.get('/nft/config', EventoController.getNftConfig);
router.get('/nft/verify-complete/:eventoId/:address', EventoController.verifyNftComplete);

// Reporte final en PDF (con QR por evento). Tambien va ANTES de /:id para que
// "reporte" no se interprete como un id.
router.get('/reporte/pdf', EventoController.generarReporte);

router.get('/', EventoController.getAll);
router.get('/:id', EventoController.getById);
router.post('/', upload.single('banner'), EventoController.create);
router.put('/:id', upload.single('banner'), EventoController.update);
router.put('/:id/tx-hash', EventoController.updateTxHash);        // flujo MetaMask: guardar txHash
router.put('/:id/nft', EventoController.updateNftToken);          // guardar tokenId tras mint NFT
router.put('/:id/nft/transfer', EventoController.transferNft);   // guardar nuevo dueño tras transferir
router.get('/:id/pdf', EventoController.generarPdf);              // generar PDF del boleto + subir a IPFS
router.delete('/:id', EventoController.remove);

export default router;
