/**
 * Configuracion de Hardhat (toolchain para compilar y desplegar el contrato).
 *
 * IMPORTANTE: este proyecto usa ESM ("type": "module" en package.json), por eso la
 * configuracion y los scripts de Hardhat usan la extension .cjs (CommonJS).
 *
 * Red objetivo: GANACHE (nodo local con GUI).
 *   - RPC por defecto de Ganache GUI:  http://127.0.0.1:7545
 *   - chainId por defecto de Ganache:  1337
 * Se desplega usando una de las private keys que Ganache entrega al abrir el workspace.
 */
require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

// Private key del organizador/deployer (copiada desde Ganache).
// Solo la usamos si tiene formato valido (0x + 64 hex). Asi `npm run compile` funciona
// aunque el .env aun tenga el placeholder; el deploy real si exige una key valida.
const RAW_PK = process.env.BLOCKCHAIN_PRIVATE_KEY || '';
const PK = /^0x[0-9a-fA-F]{64}$/.test(RAW_PK) ? RAW_PK : null;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // Version del compilador de Solidity que coincide con `pragma ^0.8.20`.
  // IMPORTANTE: fijamos evmVersion a "paris" porque Ganache NO soporta el opcode
  // PUSH0 (introducido en el EVM "shanghai"). Sin esto, el bytecode con PUSH0 falla
  // al desplegarse en Ganache con "missing revert data / CALL_EXCEPTION".
  solidity: {
    version: '0.8.20',
    settings: {
      evmVersion: 'paris',
    },
  },

  // El contrato vive en ./contracts (convencion de Hardhat).
  paths: {
    sources: './contracts',
  },

  networks: {
    // Red local de Ganache. Todo es configurable por variables de entorno.
    ganache: {
      url: process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545',
      chainId: 1337,
      accounts: PK ? [PK] : [],
    },
  },
};
