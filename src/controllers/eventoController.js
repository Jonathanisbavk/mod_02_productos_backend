import fs from 'fs';
import path from 'path';
import EventoService from '../service/eventoService.js';
import EventoPdfService from '../service/eventoPdfService.js';
import { registrarEventoOnChain } from '../blockchain/eventsContract.js';
import { getNftConfig as readNftConfig, verifyNFTComplete } from '../blockchain/eventoNftContract.js';

const METADATA_DIR = 'metadata';
const UPLOADS_DIR = 'uploads';

function generarMetadata(evento) {
    const metadata = {
        id: evento.id,
        name: evento.name,
        description: evento.description,
        image: evento.banner,
        fecha: evento.fecha,
        lugar: evento.lugar,
        precio_eth: evento.precio_eth,
        aforo: evento.aforo,
        attributes: [
            { trait_type: 'Género',       value: evento.genero  || 'General' },
            { trait_type: 'Ciudad',       value: evento.ciudad  || evento.lugar },
            { trait_type: 'Lugar',        value: evento.lugar },
            { trait_type: 'Fecha',        value: evento.fecha },
            { trait_type: 'Aforo',        value: Number(evento.aforo) },
            { trait_type: 'Precio (ETH)', value: evento.precio_eth }
        ]
    };

    const filePath = path.join(METADATA_DIR, `${evento.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
    return `/metadata/${evento.id}.json`;
}

function borrarArchivo(rutaRelativa) {
    if (!rutaRelativa) return;
    const absoluta = path.join('.', rutaRelativa.replace(/^\//, ''));
    if (fs.existsSync(absoluta)) fs.unlinkSync(absoluta);
}

function toResponse(row) {
    return {
        id:           row.id,
        name:         row.name,
        description:  row.description,
        fecha:        row.fecha,
        lugar:        row.lugar,
        genero:       row.genero,
        ciudad:       row.ciudad,
        precio_eth:   row.precio_eth,
        aforo:        row.aforo,
        banner:       row.banner,
        metadataPath: row.metadata_path,
        txHash:       row.tx_hash,       // prueba on-chain: hash de la transaccion
        onchainId:    row.onchain_id,    // id del evento dentro del contrato Events
        nftTokenId:   row.nft_token_id,  // tokenId del boleto NFT acunado (contrato EventoNFT)
        nftOwner:     row.nft_owner,     // wallet dueña actual del NFT (cambia al transferir)
        ipfsHash:     row.ipfs_hash,     // CID del PDF del boleto publicado en IPFS
        createdAt:    row.created_at
    };
}

const EventoController = {
    getAll: async (req, res) => {
        const rows = await EventoService.findAll();
        res.json(rows.map(toResponse));
    },

    getById: async (req, res) => {
        const { id } = req.params;
        const row = await EventoService.findById(Number(id));
        if (!row) return res.status(404).json({ error: 'Evento no encontrado' });
        res.json(toResponse(row));
    },

    create: async (req, res) => {
        const { name, description, fecha, lugar, precio_eth, aforo, genero, ciudad } = req.body;

        if (!name || !fecha || !lugar || !precio_eth || !aforo) {
            if (req.file) borrarArchivo(`/${UPLOADS_DIR}/${req.file.filename}`);
            return res.status(400).json({
                error: 'Faltan campos obligatorios: name, fecha, lugar, precio_eth, aforo'
            });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Falta el banner (imagen del evento)' });
        }

        const banner = `/uploads/${req.file.filename}`;
        const row = await EventoService.create({
            name,
            description: description || '',
            fecha,
            lugar,
            genero:     genero  || '',
            ciudad:     ciudad  || '',
            precio_eth,
            aforo:      Number(aforo),
            banner,
            metadata_path: null
        });

        const metadataPath = generarMetadata(row);
        await EventoService.updateMetadataPath(row.id, metadataPath);

        // --- Registro on-chain (blockchain) ---
        // En la blockchain guardamos los datos legibles del evento: lugar, fecha, precio,
        // capacidad y el organizador (la wallet que firma). El resto vive en la BD.
        // Es best-effort: si Ganache esta apagado o la cadena falla, el evento ya quedo
        // guardado en BD y la API responde igual (sin txHash).
        let txHash = null;
        let onchainId = null;
        const onchain = await registrarEventoOnChain({
            lugar:      row.lugar,
            fecha:      row.fecha,
            precio_eth: row.precio_eth,
            capacidad:  row.aforo
        });
        if (onchain) {
            txHash = onchain.txHash;
            onchainId = onchain.onchainId;
            await EventoService.updateOnchain(row.id, txHash, onchainId);
        }

        res.status(201).json(toResponse({
            ...row,
            metadata_path: metadataPath,
            tx_hash: txHash,
            onchain_id: onchainId
        }));
    },

    update: async (req, res) => {
        const { id } = req.params;
        const actual = await EventoService.findById(Number(id));
        if (!actual) {
            if (req.file) borrarArchivo(`/${UPLOADS_DIR}/${req.file.filename}`);
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        const { name, description, fecha, lugar, precio_eth, aforo, genero, ciudad } = req.body;

        if (req.file) {
            borrarArchivo(actual.banner);
            actual.banner = `/uploads/${req.file.filename}`;
        }

        actual.name        = name        ?? actual.name;
        actual.description = description ?? actual.description;
        actual.fecha       = fecha       ?? actual.fecha;
        actual.lugar       = lugar       ?? actual.lugar;
        actual.genero      = genero      ?? actual.genero;
        actual.ciudad      = ciudad      ?? actual.ciudad;
        actual.precio_eth  = precio_eth  ?? actual.precio_eth;
        actual.aforo       = aforo != null ? Number(aforo) : actual.aforo;

        const metadataPath = generarMetadata(actual);
        actual.metadata_path = metadataPath;

        const updated = await EventoService.update(Number(id), actual);
        res.json(toResponse(updated));
    },

    remove: async (req, res) => {
        const { id } = req.params;
        const removed = await EventoService.remove(Number(id));
        if (!removed) return res.status(404).json({ error: 'Evento no encontrado' });

        borrarArchivo(removed.banner);
        borrarArchivo(removed.metadata_path);
        res.json(toResponse(removed));
    },

    // Flujo MetaMask (como en el lab de facturas): el frontend firma la transaccion en el
    // navegador con la wallet del usuario y nos envia el txHash (y el onchainId opcional)
    // para guardarlo como prueba on-chain del evento.
    updateTxHash: async (req, res) => {
        const { id } = req.params;
        const { txHash, onchainId } = req.body;

        if (!txHash) {
            return res.status(400).json({ error: 'Falta el campo txHash' });
        }

        const actual = await EventoService.findById(Number(id));
        if (!actual) return res.status(404).json({ error: 'Evento no encontrado' });

        const updated = await EventoService.updateTxHash(
            Number(id),
            txHash,
            onchainId != null ? Number(onchainId) : null
        );
        res.json(toResponse(updated));
    },

    // --- Boleto NFT (contrato EventoNFT / ERC-721) ---
    // Equivalente a los endpoints NFT del Lab 12 de facturas.

    // Config del contrato NFT (address + abi) para que el frontend acune firmando
    // con MetaMask. GET /api/eventos/nft/config
    getNftConfig: (req, res) => {
        const config = readNftConfig();
        if (!config) {
            return res.status(503).json({
                error: 'Config NFT no disponible. Ejecuta "npm run deploy" para desplegar EventoNFT.'
            });
        }
        res.json(config);
    },

    // Guarda en la BD el tokenId del boleto (y su dueño inicial) tras acunarlo con MetaMask.
    // PUT /api/eventos/:id/nft  body: { tokenId, owner }
    updateNftToken: async (req, res) => {
        const { id } = req.params;
        const { tokenId, owner } = req.body;

        if (tokenId == null) {
            return res.status(400).json({ error: 'Falta el campo tokenId' });
        }
        const actual = await EventoService.findById(Number(id));
        if (!actual) return res.status(404).json({ error: 'Evento no encontrado' });

        const updated = await EventoService.updateNftToken(
            Number(id),
            Number(tokenId),
            owner || null
        );
        res.json(toResponse(updated));
    },

    // Registra en la BD el nuevo dueño del NFT tras una transferencia entre wallets.
    // La transferencia real (safeTransferFrom) la firma el dueño con MetaMask en el
    // navegador; aqui solo persistimos quien es el nuevo propietario.
    // PUT /api/eventos/:id/nft/transfer  body: { owner }
    transferNft: async (req, res) => {
        const { id } = req.params;
        const { owner } = req.body;

        if (!owner) {
            return res.status(400).json({ error: 'Falta el campo owner (nueva wallet)' });
        }
        const actual = await EventoService.findById(Number(id));
        if (!actual) return res.status(404).json({ error: 'Evento no encontrado' });
        if (!actual.nft_token_id) {
            return res.status(400).json({ error: 'Este evento aun no tiene un NFT acuñado' });
        }

        const updated = await EventoService.updateNftOwner(Number(id), owner);
        res.json(toResponse(updated));
    },

    // --- PDF + IPFS (Lab 14) ---

    // Genera el PDF del boleto del evento (datos + pruebas blockchain + QR de
    // verificacion), lo guarda en pdfs/ y lo sube al nodo IPFS local. Si IPFS esta
    // disponible persiste el CID en la BD y devuelve la URL del gateway; si no,
    // devuelve solo la ruta local (best-effort, como el registro on-chain).
    // GET /api/eventos/:id/pdf
    generarPdf: async (req, res) => {
        const { id } = req.params;
        try {
            const evento = await EventoService.findById(Number(id));
            if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

            const result = await EventoPdfService.generarBoletoPDF(evento);
            res.json(result);
        } catch (error) {
            console.error('Error al generar el PDF:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Reporte final en PDF con todos los eventos, cada uno con su QR (URL de IPFS
    // si el boleto ya fue publicado, o URL de la API en su defecto). Se descarga
    // directamente como archivo. GET /api/eventos/reporte/pdf
    generarReporte: async (req, res) => {
        try {
            const eventos = await EventoService.findAll();
            const filePath = await EventoPdfService.generarReportePDF(eventos);
            res.download(filePath, 'reporte_eventos.pdf');
        } catch (error) {
            console.error('Error al generar el reporte PDF:', error);
            res.status(500).json({ error: error.message });
        }
    },

    // Verificacion completa del NFT (tokenId + metadata + propiedad), de solo lectura.
    // GET /api/eventos/nft/verify-complete/:eventoId/:address
    verifyNftComplete: async (req, res) => {
        const { eventoId, address } = req.params;
        try {
            const result = await verifyNFTComplete(eventoId, address);
            res.json(result);
        } catch (error) {
            console.error('Error al verificar el NFT:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

export default EventoController;
