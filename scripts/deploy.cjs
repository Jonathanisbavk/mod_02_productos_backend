/**
 * Script de despliegue del contrato Events sobre la red Ganache.
 *
 * Uso:  npm run deploy   (equivale a: hardhat run scripts/deploy.cjs --network ganache)
 *
 * Que hace:
 *   1. Compila/obtiene la factory del contrato Events.
 *   2. Lo despliega en Ganache (aqui es "donde se crea el contrato"; veras la tx de
 *      creacion en la GUI de Ganache, pestañas Transactions y Contracts).
 *   3. Guarda la direccion desplegada + el ABI en src/blockchain/contract-info.json
 *      para que el backend lo lea automaticamente, sin editar el .env a mano.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  // Cuenta que firma el despliegue (la primera de las `accounts` del network Ganache).
  const [deployer] = await hre.ethers.getSigners();
  console.log('Desplegando con la cuenta (organizador):', deployer.address);

  // 1) Obtener la factory y 2) desplegar el contrato.
  const Events = await hre.ethers.getContractFactory('Events');
  const contrato = await Events.deploy();
  await contrato.waitForDeployment();

  const address = await contrato.getAddress();
  console.log('Contrato Events desplegado en:', address);

  // 3) Persistir direccion + ABI para que el backend lo consuma.
  const artifact = await hre.artifacts.readArtifact('Events');
  const outDir = path.join(__dirname, '..', 'src', 'blockchain');
  fs.mkdirSync(outDir, { recursive: true });

  const info = {
    address,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outPath = path.join(outDir, 'contract-info.json');
  fs.writeFileSync(outPath, JSON.stringify(info, null, 2), 'utf-8');
  console.log('Info del contrato guardada en:', outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
