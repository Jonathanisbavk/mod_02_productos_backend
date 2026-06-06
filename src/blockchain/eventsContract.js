/**
 * Modulo de conexion con la blockchain (Ganache) usando ethers v6.
 *
 * Encapsula TODA la logica web3 del backend en un unico lugar (buena practica:
 * una sola fuente de verdad). El resto de la app (controllers/services) no sabe
 * de ethers ni de RPC: solo llama a las funciones exportadas aqui.
 *
 * Datos que se guardan ON-CHAIN (solo lo que NUNCA cambia):
 *   - organizador:   la wallet que firma la transaccion.
 *   - fechaRegistro: el instante del registro (lo pone el contrato con block.timestamp).
 *   - hashDatos:     huella keccak256 de los datos originales (lugar, fecha, precio,
 *                    capacidad). Sirve de prueba anti-manipulacion.
 * Los datos editables (precio, lugar, fecha, aforo) permanecen en la base de datos.
 *
 * Degradacion elegante: si BLOCKCHAIN_ENABLED no es "true", o si falta la
 * configuracion, o si Ganache esta apagado, las funciones NO rompen el flujo:
 * registran un aviso y devuelven null para que el CRUD siga funcionando solo-BD.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bandera maestra para activar/desactivar la escritura on-chain.
const ENABLED = process.env.BLOCKCHAIN_ENABLED === 'true';

// Ruta del JSON que genera scripts/deploy.cjs (direccion + ABI del contrato).
const CONTRACT_INFO_PATH = path.join(__dirname, 'contract-info.json');

/**
 * Inicializa (de forma perezosa) el contrato con ethers.
 * @returns {ethers.Contract|null} instancia del contrato lista para usar, o null.
 */
function initContrato() {
    if (!ENABLED) {
        console.warn('[blockchain] BLOCKCHAIN_ENABLED != true -> se omite la escritura on-chain.');
        return null;
    }

    const rpcUrl = process.env.GANACHE_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        console.warn('[blockchain] Falta GANACHE_RPC_URL o BLOCKCHAIN_PRIVATE_KEY en .env.');
        return null;
    }
    if (!fs.existsSync(CONTRACT_INFO_PATH)) {
        console.warn('[blockchain] No existe contract-info.json. Ejecuta "npm run deploy" primero.');
        return null;
    }

    try {
        const { address, abi } = JSON.parse(fs.readFileSync(CONTRACT_INFO_PATH, 'utf-8'));
        // Provider (conexion RPC) -> Wallet (firma con la private key) -> Contract.
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        return new ethers.Contract(address, abi, wallet);
    } catch (e) {
        console.warn('[blockchain] No se pudo inicializar el contrato:', e.message);
        return null;
    }
}

/**
 * Registra on-chain un evento con sus datos legibles (lugar, fecha, precio, capacidad).
 * El organizador lo pone el contrato como msg.sender (la wallet que firma).
 *
 * @param {Object} datos
 * @param {string}        datos.lugar      Lugar del evento.
 * @param {string|Date}   datos.fecha      Fecha del evento (ISO o Date).
 * @param {string|number} datos.precio_eth Precio del boleto en ETH.
 * @param {number}        datos.capacidad  Aforo maximo.
 * @returns {Promise<{onchainId:number, txHash:string}|null>}
 */
export async function registrarEventoOnChain({ lugar, fecha, precio_eth, capacidad }) {
    const contrato = initContrato();
    if (!contrato) return null;

    try {
        // Conversion de tipos al formato que espera Solidity:
        const precioWei = ethers.parseEther(String(precio_eth));          // ETH -> wei
        const fechaUnix = Math.floor(new Date(fecha).getTime() / 1000);   // ms -> segundos

        // Enviar la transaccion y esperar a que se mine (1 confirmacion en Ganache).
        const tx = await contrato.crearEvento(lugar, fechaUnix, precioWei, capacidad);
        const receipt = await tx.wait();

        // El id on-chain es el nuevo valor de `total` tras crear el evento.
        const onchainId = Number(await contrato.total());

        console.log(`[blockchain] Evento on-chain id=${onchainId} tx=${receipt.hash}`);
        return { onchainId, txHash: receipt.hash };
    } catch (e) {
        // Best-effort: nunca rompemos el flujo del CRUD por un fallo de blockchain.
        console.warn('[blockchain] Error registrando evento on-chain:', e.message);
        return null;
    }
}

/**
 * Lee los datos legibles de un evento desde la blockchain (util para verificacion/demo).
 * @param {number} id id on-chain del evento.
 * @returns {Promise<Object|null>} datos on-chain normalizados o null.
 */
export async function getEventoOnChain(id) {
    const contrato = initContrato();
    if (!contrato) return null;

    try {
        const e = await contrato.getEvento(id);
        return {
            id: Number(e.id),
            lugar: e.lugar,
            fecha: Number(e.fecha),
            precioEth: ethers.formatEther(e.precioWei),
            capacidad: Number(e.capacidad),
            organizador: e.organizador,
        };
    } catch (err) {
        console.warn('[blockchain] Error leyendo evento on-chain:', err.message);
        return null;
    }
}
