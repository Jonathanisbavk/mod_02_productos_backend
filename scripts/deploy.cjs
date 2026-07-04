/**
 * Script de despliegue de los contratos sobre la red Ganache.
 *
 * Uso:  npm run deploy   (equivale a: hardhat run scripts/deploy.cjs --network ganache)
 *
 * Despliega DOS contratos:
 *   1. Events    -> registro on-chain de los datos legibles del evento.
 *   2. EventoNFT -> boleto NFT (ERC-721) que representa la propiedad del boleto.
 *
 * Que hace:
 *   - Compila/obtiene la factory de cada contrato y lo despliega en Ganache
 *     (veras las tx de creacion en la GUI de Ganache -> pestañas Transactions y Contracts).
 *   - Guarda direccion + ABI de cada contrato en:
 *       src/blockchain/contract-info.json   (Events)
 *       src/blockchain/nft-info.json         (EventoNFT)
 *     para que el backend los lea automaticamente, sin editar el .env a mano.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function desplegar(nombreContrato) {
  const Factory = await hre.ethers.getContractFactory(nombreContrato);
  const contrato = await Factory.deploy();
  await contrato.waitForDeployment();
  const address = await contrato.getAddress();
  console.log(`Contrato ${nombreContrato} desplegado en:`, address);
  return address;
}

function guardarInfo(nombreArchivo, address, nombreContrato, deployer, abi) {
  const outDir = path.join(__dirname, '..', 'src', 'blockchain');
  fs.mkdirSync(outDir, { recursive: true });
  const info = {
    address,
    contract: nombreContrato,
    network: hre.network.name,
    deployer,
    deployedAt: new Date().toISOString(),
    abi,
  };
  const outPath = path.join(outDir, nombreArchivo);
  fs.writeFileSync(outPath, JSON.stringify(info, null, 2), 'utf-8');
  console.log('Info del contrato guardada en:', outPath);
}

async function main() {
  // Cuenta que firma el despliegue (la primera de las `accounts` del network Ganache).
  const [deployer] = await hre.ethers.getSigners();
  console.log('Desplegando con la cuenta (organizador):', deployer.address);

  // 1) Contrato Events (registro de datos legibles on-chain).
  const eventsAddress = await desplegar('Events');
  const eventsAbi = (await hre.artifacts.readArtifact('Events')).abi;
  guardarInfo('contract-info.json', eventsAddress, 'Events', deployer.address, eventsAbi);

  // 2) Contrato EventoNFT (boleto NFT ERC-721).
  const nftAddress = await desplegar('EventoNFT');
  const nftAbi = (await hre.artifacts.readArtifact('EventoNFT')).abi;
  guardarInfo('nft-info.json', nftAddress, 'EventoNFT', deployer.address, nftAbi);

  console.log('\n Despliegue completo.');
  console.log('   Events    ->', eventsAddress, '  (pega en NEXT_PUBLIC_CONTRACT_ADDRESS)');
  console.log('   EventoNFT ->', nftAddress,    '  (el frontend lo lee de /api/eventos/nft/config)');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
