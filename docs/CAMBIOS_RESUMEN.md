# Resumen de cambios — Integración MetaMask (Enviar a Blockchain)

Tabla de todo lo que se cambió/añadió, qué es, qué hace y un ejemplo.

---

## Backend · `mod_02_productos`

| Archivo / cambio | Qué es | Qué hace | Ejemplo |
|---|---|---|---|
| `src/db/schema.sql` | Script SQL de la base de datos | Se corrigió el nombre de la BD de `tickets_db` a **`data_productos`** para que coincida con `.env`. | `CREATE DATABASE IF NOT EXISTS data_productos;` |
| **Migración a la tabla `eventos`** | Cambio en la BD real (no solo el script) | Se añadieron 2 columnas que faltaban para guardar la prueba blockchain: `tx_hash` y `onchain_id`. | `ALTER TABLE eventos ADD COLUMN tx_hash VARCHAR(66), ADD COLUMN onchain_id INT;` |
| `src/service/eventoService.js` → `updateTxHash()` | Método de la capa de servicio (acceso a datos) | Actualiza en la BD el `tx_hash` + `onchain_id` de un evento y devuelve el evento actualizado. | `EventoService.updateTxHash(5, "0xabc…", 3)` |
| `src/controllers/eventoController.js` → `updateTxHash` | Controlador (recibe la petición HTTP) | Lee `txHash`/`onchainId` del body, valida que venga `txHash` (400 si no), 404 si el evento no existe, y llama al servicio. | Recibe `PUT /api/eventos/5/tx-hash` con `{ "txHash": "0xabc…" }` |
| `src/routes/eventoRoutes.js` → nueva ruta | Definición de la ruta REST | Expone el endpoint **`PUT /api/eventos/:id/tx-hash`** que conecta con el controlador. | `router.put('/:id/tx-hash', EventoController.updateTxHash)` |

---

## Frontend · `frontend_productos`

| Archivo / cambio | Qué es | Qué hace | Ejemplo |
|---|---|---|---|
| `package.json` → `ethers` v6 | Nueva dependencia (librería web3) | Permite hablar con MetaMask y el contrato desde el navegador (firmar, convertir ETH↔wei). | `import { BrowserProvider } from 'ethers'` |
| `lib/contract.ts` *(nuevo)* | Config del contrato | Guarda el **ABI** (lista de funciones del contrato) y la **dirección** del contrato (desde `NEXT_PUBLIC_CONTRACT_ADDRESS`). | `CONTRACT_ADDRESS = "0x5FbDB..."` |
| `lib/blockchain.ts` *(nuevo)* | Capa web3 del frontend | `connectWallet()` conecta MetaMask; `enviarEventoOnChain()` firma la transacción `crearEvento(...)` y devuelve el `txHash`. | `await enviarEventoOnChain(evento) // → { txHash, onchainId }` |
| `lib/useWallet.ts` *(nuevo)* | Hook de React | Mantiene la cuenta conectada en estado, la recupera al recargar y escucha cambios de cuenta. | `const { account, connect } = useWallet()` |
| `lib/api.ts` → `updateTxHash()` | Función cliente de la API | Llama al backend (`PUT /:id/tx-hash`) para guardar el hash tras firmar. | `await updateTxHash(5, "0xabc…", 3)` |
| `app/dashboard/page.tsx` | Página del dashboard | Añade el chip **“Conectar wallet” / cuenta conectada** en el header (verde con el `0x…`). | Muestra `0x1234…abcd` cuando conectas |
| `components/dashboard/EventsTable.tsx` | Tabla de eventos | Añade el botón **⚡ Enviar a blockchain** por fila (solo si el evento aún no tiene `txHash`). Al pulsarlo ejecuta todo el flujo. | Clic en ⚡ → MetaMask → badge `On-chain ✓` |
| `.env.local` → `NEXT_PUBLIC_CONTRACT_ADDRESS` | Variable de entorno | Dirección del contrato desplegado; la lee `lib/contract.ts`. | `NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB...` |

---

## Glosario rápido

| Término | Significado simple |
|---|---|
| **MetaMask** | Billetera (wallet) en el navegador que firma transacciones. |
| **Ganache** | Blockchain local de pruebas (10 cuentas con 100 ETH cada una). |
| **Contrato `Events`** | Programa en la blockchain que guarda eventos (`crearEvento`, `getEvento`). |
| **ABI** | “Manual” del contrato: lista sus funciones para poder llamarlas. |
| **wei** | Unidad mínima de ETH. `1 ETH = 1e18 wei`. El contrato trabaja en wei. |
| **txHash** | Identificador único de una transacción (la “prueba” on-chain). |
| **onchainId** | Id que el contrato asigna al evento dentro de la blockchain. |

---

# Resumen de cambios — Boleto NFT (ERC-721)

Segunda tanda de cambios: se portó la parte **NFT** del Lab 12 (facturas) al módulo de
eventos. Guía completa en [`GUIA_NFT_ERC721.md`](./GUIA_NFT_ERC721.md).

## Backend · `mod_02_productos`

| Archivo / cambio | Qué es | Qué hace |
|---|---|---|
| `contracts/EventoNFT.sol` *(nuevo)* | Contrato ERC-721 (OpenZeppelin 4.9.6) | Acuña un boleto NFT por evento con metadata (`name`, `lugar`, `precio`, `hash`, `timestamp`) y evita duplicados. |
| `scripts/deploy.cjs` | Script de despliegue | Ahora despliega **Events + EventoNFT** y guarda `contract-info.json` y `nft-info.json`. |
| `src/blockchain/eventoNftContract.js` *(nuevo)* | Módulo blockchain NFT | `getNftConfig()` (abi+address) y `verifyNFTComplete()` (lee tokenId + metadata + propiedad on-chain). |
| `src/service/eventoService.js` → `updateNftToken()` | Capa de servicio | Guarda el `tokenId` del boleto NFT en la BD. |
| `src/controllers/eventoController.js` | Controlador | Handlers `getNftConfig`, `updateNftToken`, `verifyNftComplete`; `toResponse` expone `nftTokenId`. |
| `src/routes/eventoRoutes.js` | Rutas REST | `GET /nft/config`, `GET /nft/verify-complete/:eventoId/:address`, `PUT /:id/nft`. |
| `src/db/schema.sql` | Esquema BD | Nueva columna `nft_token_id INT NULL` en `eventos`. |
| `package.json` | Dependencia | `@openzeppelin/contracts@^4.9.6`. |

## Frontend · `frontend_productos`

| Archivo / cambio | Qué es | Qué hace |
|---|---|---|
| `lib/nft.ts` *(nuevo)* | Capa web3 del NFT | `mintEventoNFT()` (firma con MetaMask → `{txHash, tokenId}`) y `verificarNFT()`. |
| `lib/api.ts` | Cliente API | `getNftConfig()` y `updateNftToken(id, tokenId)`. |
| `lib/types.ts` | Tipos | Nuevo campo `nftTokenId` en `Evento`. |
| `components/dashboard/EventsTable.tsx` | Tabla de eventos | Botones **✨ Acuñar NFT** / **✔ Verificar NFT** (desktop y móvil); nueva prop `account`. |
| `app/dashboard/page.tsx` | Dashboard | Pasa la wallet conectada (`account`) a `EventsTable`. |

## Glosario NFT

| Término | Significado simple |
|---|---|
| **ERC-721** | Estándar de NFTs: token único con dueño (`ownerOf`). |
| **Mint / Acuñar** | Crear un NFT nuevo y asignarlo a una wallet. |
| **tokenId** | Id único del NFT dentro del contrato (empieza en 1). |
| **EventoNFT** | Contrato del boleto NFT (`mintEventoNFT`, `getMetadata`, `getTokenId`). |

---

# Resumen de cambios — Transferencia del NFT + guardado del dueño

Tercera tanda: el boleto NFT ahora se puede **transferir entre cuentas** de MetaMask/Ganache,
se **guarda el tokenId y el dueño**, y hay 3 botones NFT en el dashboard (Mint, Validar, Transferir).

## Backend · `mod_02_productos`

| Archivo / cambio | Qué hace |
|---|---|
| `src/db/schema.sql` | Nueva columna `nft_owner VARCHAR(42)` (dueño actual del NFT). Migración: `ALTER TABLE eventos ADD COLUMN nft_owner VARCHAR(42) NULL;` |
| `src/service/eventoService.js` | `updateNftToken(id, tokenId, owner)` guarda tokenId + dueño; nuevo `updateNftOwner(id, owner)`. |
| `src/controllers/eventoController.js` | `updateNftToken` acepta `owner`; nuevo handler `transferNft`; `toResponse` expone `nftOwner`. |
| `src/routes/eventoRoutes.js` | Nueva ruta `PUT /api/eventos/:id/nft/transfer`. |
| `scripts/verificar-nft.cjs` | Verifica también `safeTransferFrom` (transferencia entre 2 cuentas y cambio de `ownerOf`). |

## Frontend · `frontend_productos`

| Archivo / cambio | Qué hace |
|---|---|
| `lib/nft.ts` → `transferirNFT()` | Firma `safeTransferFrom(from, to, tokenId)` con MetaMask (valida que la cuenta conectada es la dueña). |
| `lib/api.ts` | `updateNftToken(id, tokenId, owner)` y nuevo `transferNftOwner(id, owner)`. |
| `lib/swal.ts` → `promptText()` | Diálogo para pedir/confirmar la wallet destino. |
| `lib/types.ts` | Nuevo campo `nftOwner` en `Evento`. |
| `components/dashboard/EventsTable.tsx` | Botón **➤ Transferir** (junto a **✔ Validar**) cuando ya hay NFT; el mint guarda el dueño. |
| `app/globals.css` | Estilo `.swal-tc-input` para el campo de la wallet destino. |

## Corrección de puerto (bug "no conecta a la API")

| Archivo | Qué hace |
|---|---|
| `frontend_productos/package.json` | `dev`/`start` fijan el **puerto 3001** (`next dev -p 3001`) para no chocar con el backend (3000). |
