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
