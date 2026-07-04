/**
 * Modulo blockchain del backend para el boleto NFT (contrato EventoNFT / ERC-721).
 *
 * Equivalente al `facturaNFTService.js` del Lab 12, pero con ethers v6 (mismo motor
 * que el resto del backend) en vez de web3.js.
 *
 * Responsabilidades:
 *   1. Exponer la CONFIG del contrato NFT (address + abi) para que el frontend pueda
 *      acunar el boleto firmando con MetaMask  ->  getNftConfig().
 *   2. VERIFICAR de solo-lectura el NFT de un evento (tokenId, metadata y propiedad)
 *      sin gastar gas ni abrir MetaMask                 ->  verifyNFTComplete().
 *
 * Degradacion elegante: si falta la config (no se ejecuto el deploy) o Ganache esta
 * apagado, las funciones no rompen el flujo; devuelven null / lanzan un error claro.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// JSON que genera scripts/deploy.cjs con la direccion + ABI del contrato EventoNFT.
const NFT_INFO_PATH = path.join(__dirname, 'nft-info.json');

/** Lee address + abi del contrato NFT desde nft-info.json (o null si no existe). */
function leerNftInfo() {
    if (!fs.existsSync(NFT_INFO_PATH)) {
        console.warn('[nft] No existe nft-info.json. Ejecuta "npm run deploy" primero.');
        return null;
    }
    try {
        const { address, abi } = JSON.parse(fs.readFileSync(NFT_INFO_PATH, 'utf-8'));
        return { address, abi };
    } catch (e) {
        console.warn('[nft] No se pudo leer nft-info.json:', e.message);
        return null;
    }
}

/**
 * Devuelve la config del contrato NFT (address + abi) para el frontend.
 * @returns {{address:string, abi:object[]}|null}
 */
export function getNftConfig() {
    return leerNftInfo();
}

/** Instancia de solo-lectura del contrato NFT (provider, sin wallet), o null. */
function initContratoNFTLectura() {
    const info = leerNftInfo();
    if (!info) return null;

    const rpcUrl = process.env.GANACHE_RPC_URL;
    if (!rpcUrl) {
        console.warn('[nft] Falta GANACHE_RPC_URL en .env.');
        return null;
    }
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        return new ethers.Contract(info.address, info.abi, provider);
    } catch (e) {
        console.warn('[nft] No se pudo inicializar el contrato NFT:', e.message);
        return null;
    }
}

/**
 * Verificacion completa del NFT de un evento: existencia (tokenId), metadata y propiedad.
 * Todo es de solo-lectura (no firma ni gasta gas). Equivalente a `verifyNFTComplete`
 * del lab de facturas.
 *
 * @param {number|string} eventoId id del evento (BD) cuyo NFT se quiere verificar.
 * @param {string}        address  wallet contra la que comprobar la propiedad.
 * @returns {Promise<{hasNFT:boolean, tokenId:string|number, metadata:object|null, ownership:object|null}>}
 */
export async function verifyNFTComplete(eventoId, address) {
    const contrato = initContratoNFTLectura();
    if (!contrato) {
        throw new Error('Contrato NFT no disponible. Ejecuta "npm run deploy" y arranca Ganache.');
    }

    // 1) tokenId del evento (0 => aun no tiene NFT acunado).
    const tokenId = await contrato.getTokenId(eventoId);
    if (tokenId.toString() === '0') {
        return { hasNFT: false, tokenId: 0, metadata: null, ownership: null };
    }

    // 2) metadata on-chain del boleto.
    const m = await contrato.getMetadata(tokenId);

    // 3) propiedad: ¿la wallet indicada es la dueña del token?
    const owner = await contrato.ownerOf(tokenId);
    const isOwner = address ? owner.toLowerCase() === String(address).toLowerCase() : false;

    return {
        hasNFT: true,
        tokenId: tokenId.toString(),
        metadata: {
            eventoId:  m.eventoId.toString(),
            name:      m.name,
            lugar:     m.lugar,
            precio:    m.precio,
            hash:      m.hash,
            timestamp: m.timestamp.toString(),
        },
        ownership: { owner, isOwner },
    };
}
