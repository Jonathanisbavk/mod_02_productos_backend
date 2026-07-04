/**
 * Verificacion automatica de la LOGICA del contrato EventoNFT (boleto NFT ERC-721).
 *
 * NO necesita Ganache: usa la red en memoria de Hardhat (toolchain en segundo plano)
 * para PROBAR que el contrato funciona igual que lo hara sobre Ganache:
 *   1. Despliega EventoNFT.
 *   2. Acuna un boleto NFT (mintEventoNFT) y comprueba el evento NFTMinted.
 *   3. Lee tokenId (getTokenId), metadata (getMetadata) y propiedad (ownerOf).
 *   4. Comprueba las reglas: no se puede acunar dos veces el mismo evento (NFTYaExiste),
 *      ni con campos vacios (CampoRequerido), ni a la direccion 0 (DireccionInvalida).
 *
 * Uso:  npx hardhat run scripts/verificar-nft.cjs
 */
const assert = require('assert');
const hre = require('hardhat');

async function main() {
  const [organizador, comprador] = await hre.ethers.getSigners();
  console.log('Red de prueba:', hre.network.name);
  console.log('Organizador  :', organizador.address);
  console.log('Comprador    :', comprador.address, '\n');

  // 1) Deploy
  const EventoNFT = await hre.ethers.getContractFactory('EventoNFT');
  const nft = await EventoNFT.deploy();
  await nft.waitForDeployment();
  console.log('EventoNFT desplegado en:', await nft.getAddress());
  assert.equal(await nft.name(), 'EventoNFT', 'name() incorrecto');
  assert.equal(await nft.symbol(), 'TCKT', 'symbol() incorrecto');

  // 2) Mint de un boleto NFT para el evento id=1, propiedad del comprador
  const eventoId = 1;
  const nombre = 'Rock de los 90s';
  const lugar = 'Coliseo Nacional';
  const precio = '0.08';
  const hash = hre.ethers.solidityPackedKeccak256(
    ['uint256', 'string', 'string'],
    [eventoId, nombre, lugar],
  );

  const tx = await nft.mintEventoNFT(eventoId, nombre, lugar, precio, hash, comprador.address);
  const receipt = await tx.wait();
  console.log('\n mintEventoNFT OK  tx:', receipt.hash);

  // Comprobar el evento NFTMinted
  const ev = receipt.logs
    .map((l) => { try { return nft.interface.parseLog(l); } catch { return null; } })
    .find((p) => p && p.name === 'NFTMinted');
  assert.ok(ev, 'No se emitio el evento NFTMinted');
  console.log('   evento NFTMinted -> tokenId:', ev.args.tokenId.toString(),
    'eventoId:', ev.args.eventoId.toString());

  // 3) Lecturas
  const tokenId = await nft.getTokenId(eventoId);
  assert.equal(tokenId.toString(), '1', 'getTokenId deberia ser 1');

  const owner = await nft.ownerOf(tokenId);
  assert.equal(owner, comprador.address, 'El propietario deberia ser el comprador');
  console.log('   getTokenId       ->', tokenId.toString());
  console.log('   ownerOf          ->', owner, '(comprador ✓)');

  const m = await nft.getMetadata(tokenId);
  assert.equal(m.name, nombre);
  assert.equal(m.lugar, lugar);
  assert.equal(m.precio, precio);
  assert.equal(m.hash, hash);
  console.log('   getMetadata      -> name:', m.name, '| lugar:', m.lugar, '| precio:', m.precio);

  // getTokenId de un evento SIN NFT debe devolver 0
  assert.equal((await nft.getTokenId(999)).toString(), '0', 'Evento sin NFT deberia dar 0');
  console.log('   getTokenId(999)  -> 0 (evento sin NFT ✓)');

  // 3b) TRANSFERENCIA entre cuentas (safeTransferFrom). El dueño (comprador) firma y
  //     transfiere el boleto al organizador. Comprobamos que ownerOf cambia.
  const nftComprador = nft.connect(comprador);
  const txT = await nftComprador['safeTransferFrom(address,address,uint256)'](
    comprador.address, organizador.address, tokenId,
  );
  await txT.wait();
  const nuevoOwner = await nft.ownerOf(tokenId);
  assert.equal(nuevoOwner, organizador.address, 'Tras transferir, el dueño deberia ser el organizador');
  console.log('\n safeTransferFrom OK -> boleto', tokenId.toString(),
    'transferido de', comprador.address.slice(0,8) + '…', 'a', organizador.address.slice(0,8) + '…');
  console.log('   ownerOf ahora    ->', nuevoOwner, '(nuevo dueño ✓)');

  // 4) Reglas / errores esperados
  await assert.rejects(
    nft.mintEventoNFT(eventoId, nombre, lugar, precio, hash, comprador.address),
    /NFTYaExiste/,
    'Deberia revertir con NFTYaExiste al duplicar',
  );
  console.log('\n regla NFTYaExiste     ✓ (no se puede acunar 2 veces el mismo evento)');

  await assert.rejects(
    nft.mintEventoNFT(2, '', lugar, precio, hash, comprador.address),
    /CampoRequerido/,
    'Deberia revertir con CampoRequerido si name vacio',
  );
  console.log(' regla CampoRequerido  ✓ (name/lugar no pueden ir vacios)');

  await assert.rejects(
    nft.mintEventoNFT(3, nombre, lugar, precio, hash, hre.ethers.ZeroAddress),
    /DireccionInvalida/,
    'Deberia revertir con DireccionInvalida si to = 0x0',
  );
  console.log(' regla DireccionInvalida ✓ (no se acuna a la direccion 0)');

  console.log('\n====================================================');
  console.log(' TODAS LAS COMPROBACIONES DEL NFT PASARON CORRECTAMENTE');
  console.log(' El contrato funcionara igual al desplegarlo en Ganache.');
  console.log('====================================================');
}

main().catch((error) => {
  console.error('\n VERIFICACION FALLIDA:\n', error);
  process.exitCode = 1;
});
