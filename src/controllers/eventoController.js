import fs from 'fs';
import path from 'path';
import EventoService from '../service/eventoService.js';
import { registrarEventoOnChain } from '../blockchain/eventsContract.js';

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
        txHash:       row.tx_hash,     // prueba on-chain: hash de la transaccion
        onchainId:    row.onchain_id,  // id del evento dentro del contrato Events
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
    }
};

export default EventoController;
