import pool from '../config/db.js';

const EventoService = {
    findAll: async () => {
        const [rows] = await pool.query('SELECT * FROM eventos ORDER BY id DESC');
        return rows;
    },

    findById: async (id) => {
        const [rows] = await pool.query('SELECT * FROM eventos WHERE id = ?', [id]);
        return rows[0] || null;
    },

    create: async (data) => {
        const [result] = await pool.query(
            `INSERT INTO eventos
             (name, description, fecha, lugar, genero, ciudad, precio_eth, aforo, banner, metadata_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.name, data.description, data.fecha, data.lugar,
             data.genero, data.ciudad, data.precio_eth, data.aforo,
             data.banner, data.metadata_path]
        );
        return EventoService.findById(result.insertId);
    },

    updateMetadataPath: async (id, metadata_path) => {
        await pool.query('UPDATE eventos SET metadata_path = ? WHERE id = ?', [metadata_path, id]);
    },

    // Guarda la prueba on-chain (hash de la tx + id dentro del contrato) tras registrar
    // el evento en la blockchain.
    updateOnchain: async (id, tx_hash, onchain_id) => {
        await pool.query(
            'UPDATE eventos SET tx_hash = ?, onchain_id = ? WHERE id = ?',
            [tx_hash, onchain_id, id]
        );
    },

    // Igual que updateOnchain pero pensado para el flujo MetaMask: el frontend firma la
    // transaccion en el navegador y nos manda el txHash (y el onchainId si lo tiene).
    // Devuelve el evento ya actualizado para responder al cliente.
    updateTxHash: async (id, tx_hash, onchain_id = null) => {
        await pool.query(
            'UPDATE eventos SET tx_hash = ?, onchain_id = ? WHERE id = ?',
            [tx_hash, onchain_id, id]
        );
        return EventoService.findById(id);
    },

    // Guarda el tokenId del boleto NFT (contrato EventoNFT) y su dueño inicial tras
    // acunarlo con MetaMask.
    updateNftToken: async (id, nft_token_id, nft_owner = null) => {
        await pool.query(
            'UPDATE eventos SET nft_token_id = ?, nft_owner = ? WHERE id = ?',
            [nft_token_id, nft_owner, id]
        );
        return EventoService.findById(id);
    },

    // Guarda el CID de IPFS del PDF del boleto (se llena al generar el PDF y
    // subirlo al nodo IPFS local; queda como prueba de publicacion descentralizada).
    updateIpfsHash: async (id, ipfs_hash) => {
        await pool.query(
            'UPDATE eventos SET ipfs_hash = ? WHERE id = ?',
            [ipfs_hash, id]
        );
        return EventoService.findById(id);
    },

    // Actualiza SOLO el dueño del NFT (tras una transferencia entre wallets).
    updateNftOwner: async (id, nft_owner) => {
        await pool.query(
            'UPDATE eventos SET nft_owner = ? WHERE id = ?',
            [nft_owner, id]
        );
        return EventoService.findById(id);
    },

    update: async (id, data) => {
        await pool.query(
            `UPDATE eventos SET
             name=?, description=?, fecha=?, lugar=?, genero=?,
             ciudad=?, precio_eth=?, aforo=?, banner=?, metadata_path=?
             WHERE id=?`,
            [data.name, data.description, data.fecha, data.lugar, data.genero,
             data.ciudad, data.precio_eth, data.aforo, data.banner, data.metadata_path, id]
        );
        return EventoService.findById(id);
    },

    remove: async (id) => {
        const evento = await EventoService.findById(id);
        if (!evento) return null;
        await pool.query('DELETE FROM eventos WHERE id = ?', [id]);
        return evento;
    }
};

export default EventoService;
