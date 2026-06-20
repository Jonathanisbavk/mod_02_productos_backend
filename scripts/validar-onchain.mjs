// Validación rápida: ¿el contrato Events está realmente desplegado en Ganache
// en la dirección configurada, y responde? Uso: node scripts/validar-onchain.mjs
import { ethers } from 'ethers';

const RPC = process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545';
const ADDRESS = process.argv[2] || '0x521420ECcDB306eB0E2266ad38F65F41831BED48';

const ABI = [
  'function total() view returns (uint256)',
  'function getEvento(uint256 id) view returns (tuple(uint256 id,string lugar,uint256 fecha,uint256 precioWei,uint256 capacidad,address organizador))',
];

const provider = new ethers.JsonRpcProvider(RPC);

console.log('RPC:      ', RPC);
console.log('Dirección:', ADDRESS);

// 1) ¿Hay código (bytecode) en esa dirección? Si devuelve "0x" -> NO hay contrato ahí.
const code = await provider.getCode(ADDRESS);
if (code === '0x') {
  console.error('\n❌ NO hay contrato en esa dirección. Revisa que sea la de "Deployed Contracts" de Remix y que Ganache no se haya reiniciado.');
  process.exit(1);
}
console.log('\n✅ Hay un contrato desplegado (bytecode de', code.length, 'caracteres).');

// 2) ¿Responde a la ABI de Events? Llamamos total().
const contrato = new ethers.Contract(ADDRESS, ABI, provider);
const total = await contrato.total();
console.log('✅ total() respondió:', total.toString(), 'eventos registrados on-chain.');

// 3) Si ya hay eventos, leemos el último para mostrar los datos guardados on-chain.
if (total > 0n) {
  const e = await contrato.getEvento(total);
  console.log('\nÚltimo evento on-chain:');
  console.log('  id:         ', e.id.toString());
  console.log('  lugar:      ', e.lugar);
  console.log('  fecha(unix):', e.fecha.toString());
  console.log('  precio(ETH):', ethers.formatEther(e.precioWei));
  console.log('  capacidad:  ', e.capacidad.toString());
  console.log('  organizador:', e.organizador);
} else {
  console.log('\nℹ️  Aún no hay eventos on-chain (total=0). Usa el botón ⚡ en el dashboard para crear el primero.');
}

console.log('\n✅ Validación on-chain OK.');
