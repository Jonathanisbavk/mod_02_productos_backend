# Guía — Boleto NFT (ERC-721) · mod_02_productos + frontend_productos

Esta guía documenta la integración del **boleto NFT** portando el patrón del
**Lab 12 (facturas NFT)** al módulo de eventos/tickets. Ahora, además de *registrar*
los datos del evento on-chain (contrato `Events`), el sistema puede **acuñar (mint) un
NFT ERC-721** que representa la **propiedad transferible** del boleto y guarda su
metadata + un hash anti-manipulación en la cadena.

> Resultado esperado: en el dashboard, cada evento sin NFT muestra el botón
> **✨ (Acuñar boleto NFT)**. Al pulsarlo, MetaMask pide firmar la acuñación; al
> confirmar, el botón cambia a **✔ NFT #N** y el evento queda con su `nftTokenId`.
> El botón de verificación lee el contrato on-chain y muestra tokenId, metadata y
> quién es el propietario.

---

## 0. ¿Por qué "los NFTs"? — Mapeo Lab 12 → este proyecto

El Lab 12 tenía **dos** contratos: uno que guardaba la factura on-chain
(`FacturaStorage.sol`) y otro **ERC-721** que acuñaba un NFT por factura
(`FacturaNFT.sol`). Este proyecto ya tenía el primero (`Events.sol`) y generaba la
metadata estilo NFT, **pero le faltaba el segundo**: el minteo real del NFT. Esta
integración añade justamente esa pieza.

| Lab 12 (facturas) | Este proyecto (eventos/tickets) | Rol |
|---|---|---|
| `FacturaStorage.sol` → `createFactura` | `Events.sol` → `crearEvento` *(ya existía)* | Registro de datos legibles on-chain |
| `FacturaNFT.sol` (ERC-721) | **`EventoNFT.sol` (ERC-721)** *(nuevo)* | Boleto NFT: propiedad + metadata + hash |
| `mintFacturaNFT(id, cliente, monto, hash, to)` | `mintEventoNFT(id, name, lugar, precio, hash, to)` | Acuñar el NFT |
| `getMetadata` / `getTokenId` | `getMetadata` / `getTokenId` | Leer el NFT |
| `facturaNFTService.js` (web3.js) | **`eventoNftContract.js` (ethers v6)** *(nuevo)* | Verificación backend (solo lectura) |
| `GET /api/facturas/nft/config` | `GET /api/eventos/nft/config` *(nuevo)* | ABI + address del NFT para el frontend |
| `GET /:nft/verify-complete/:id/:address` | `GET /api/eventos/nft/verify-complete/:eventoId/:address` *(nuevo)* | Verificar tokenId + metadata + propiedad |
| `facturas.js` → `mintNFT()` / `verificarNFT()` | **`lib/nft.ts`** *(nuevo)* | Capa web3 del frontend |
| Botones "MINT NFT" / "VERIFICAR NFT" | Botones **✨ / ✔** en `EventsTable.tsx` | UI |

**Diferencias técnicas respecto al lab:** se usa **ethers v6** (no web3.js) para unificar
con el resto del proyecto, y la config del NFT se obtiene del backend en runtime
(`/nft/config`), de modo que tras cada `npm run deploy` el frontend usa la nueva
dirección sin editar variables de entorno.

---

## 1. Cambios realizados

### Backend (`mod_02_productos`)
- **`contracts/EventoNFT.sol`** *(nuevo)* — contrato **ERC-721** (OpenZeppelin 4.9.6) que
  acuña un boleto NFT por evento con su metadata (`eventoId`, `name`, `lugar`, `precio`,
  `hash`, `timestamp`) y evita duplicados (`eventoToTokenId`).
- **`package.json`** — nueva dependencia `@openzeppelin/contracts@^4.9.6`.
- **`scripts/deploy.cjs`** — ahora despliega **dos** contratos: `Events` y `EventoNFT`,
  y guarda cada uno en `src/blockchain/contract-info.json` y `src/blockchain/nft-info.json`.
- **`src/blockchain/eventoNftContract.js`** *(nuevo)* — `getNftConfig()` (address + abi) y
  `verifyNFTComplete(eventoId, address)` (lectura on-chain: tokenId + metadata + propiedad).
- **`src/service/eventoService.js`** — nuevo método `updateNftToken(id, tokenId)`.
- **`src/controllers/eventoController.js`** — handlers `getNftConfig`, `updateNftToken`,
  `verifyNftComplete`; el `toResponse` ahora expone `nftTokenId`.
- **`src/routes/eventoRoutes.js`** — nuevas rutas:
  - `GET  /api/eventos/nft/config`
  - `GET  /api/eventos/nft/verify-complete/:eventoId/:address`
  - `PUT  /api/eventos/:id/nft`
- **`src/db/schema.sql`** — nueva columna `nft_token_id INT NULL` en la tabla `eventos`.

### Frontend (`frontend_productos`)
- **`lib/nft.ts`** *(nuevo)* — `mintEventoNFT()` (firma la acuñación con MetaMask y devuelve
  `{ txHash, tokenId }`) y `verificarNFT()` (consulta el backend).
- **`lib/api.ts`** — nuevas funciones `getNftConfig()` y `updateNftToken(id, tokenId)`.
- **`lib/types.ts`** — nuevo campo `nftTokenId?: number | null` en `Evento`.
- **`components/dashboard/EventsTable.tsx`** — botones **✨ Acuñar NFT** / **✔ Verificar NFT**
  por fila (desktop y móvil), y `account` como nueva prop.
- **`app/dashboard/page.tsx`** — pasa la wallet conectada (`account`) a `EventsTable`.

---

## 2. Puesta en marcha

Requisitos: los mismos de la [guía MetaMask](./GUIA_BLOCKCHAIN_METAMASK.md) (Node 18+,
MariaDB/MySQL, Ganache GUI en `http://127.0.0.1:7545`, extensión MetaMask conectada a
Ganache).

```bash
# 1) Backend: instalar OpenZeppelin (si no está) y compilar
cd mod_02_productos
npm install                 # trae @openzeppelin/contracts
npm run compile             # compila Events.sol + EventoNFT.sol

# 2) Migrar la BD (una sola vez, si la tabla ya existía)
#    ALTER TABLE eventos ADD COLUMN nft_token_id INT NULL;
#    (o reejecuta src/db/schema.sql en una BD nueva)

# 3) Desplegar AMBOS contratos en Ganache
npm run deploy
#    -> imprime la dirección de Events (para NEXT_PUBLIC_CONTRACT_ADDRESS)
#    -> genera src/blockchain/contract-info.json  (Events)
#    -> genera src/blockchain/nft-info.json        (EventoNFT)

# 4) Arrancar el backend
npm run dev                 # http://localhost:3000
```

```bash
# 5) Frontend
cd ../frontend_productos
#    Pega la dirección de Events en .env.local -> NEXT_PUBLIC_CONTRACT_ADDRESS
#    (la del NFT NO hace falta: el frontend la pide a /api/eventos/nft/config)
npm run dev                 # http://localhost:3001
```

---

## 3. Flujo de uso (dashboard)

1. **Conectar wallet** (chip verde arriba a la derecha) — necesario para acuñar.
2. En una fila de evento, pulsar **✨** → MetaMask pide firmar `mintEventoNFT(...)`.
3. Al minarse, el `tokenId` se guarda en la BD (`PUT /api/eventos/:id/nft`) y el botón
   pasa a **✔ NFT #N**.
4. Pulsar **✔ Validar** para verificar: el backend lee el contrato y muestra tokenId,
   metadata on-chain y si el boleto **te pertenece** (compara `ownerOf` con tu wallet).
5. Pulsar **➤ Transferir** para enviar el boleto a otra wallet (ver sección 4).

> Nota: acuñar un segundo NFT para el mismo evento revierte con `NFTYaExiste` (un evento
> = un boleto NFT, igual que en el lab una factura = un NFT).

Los tres botones NFT del dashboard:

| Botón | Cuándo aparece | Qué hace |
|---|---|---|
| **✨ Mint NFT** | el evento aún no tiene NFT | Acuña el boleto (firma con MetaMask) y guarda `tokenId` + dueño en la BD. |
| **✔ Validar** | el evento ya tiene NFT | Lee el contrato y muestra tokenId, metadata y dueño actual. |
| **➤ Transferir** | el evento ya tiene NFT | Transfiere el boleto a otra wallet (`safeTransferFrom`) y guarda el nuevo dueño. |

---

## 4. Transferir el boleto NFT entre cuentas (MetaMask + Ganache)

La transferencia es un **`safeTransferFrom(from, to, tokenId)`** del estándar ERC-721: mueve
la propiedad del token de una wallet a otra. Ambas cuentas deben estar **importadas en
MetaMask desde Ganache**.

**Preparar la segunda cuenta (una sola vez):**
1. Abre Ganache y copia la **private key** de otra de las 10 cuentas.
2. En MetaMask: *Selector de cuenta → Importar cuenta → pega la private key*.
3. Asegúrate de que MetaMask está en la red de Ganache (RPC `http://127.0.0.1:7545`, chainId `1337`).

**Transferir:**
1. Conecta en MetaMask la wallet **dueña actual** del boleto (la que lo acuñó).
2. Pulsa **➤ Transferir** en la fila del evento.
3. Pega/confirma la **wallet destino** (otra cuenta importada) y acepta.
4. Firma en MetaMask. Al minarse, el backend guarda el nuevo dueño (`PUT /:id/nft/transfer`).
5. Verifica con **✔ Validar**: ahora `ownerOf` (y `nftOwner` en la BD) muestran la nueva wallet.

> El frontend valida antes de firmar que la cuenta conectada es realmente la dueña
> (`ownerOf`); si no, avisa para que conectes la wallet propietaria. La clave privada
> **nunca** se guarda en el código: la transferencia la firma MetaMask en el navegador.

---

## 5. Endpoints nuevos (referencia rápida)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET`  | `/api/eventos/nft/config` | Devuelve `{ address, abi }` del contrato `EventoNFT`. |
| `GET`  | `/api/eventos/nft/verify-complete/:eventoId/:address` | `{ hasNFT, tokenId, metadata, ownership }`. |
| `PUT`  | `/api/eventos/:id/nft` | Guarda `{ tokenId, owner }` en la BD tras acuñar. |
| `PUT`  | `/api/eventos/:id/nft/transfer` | Guarda `{ owner }` (nuevo dueño) tras transferir. |

---

## 6. Glosario (además del de la guía MetaMask)

| Término | Significado simple |
|---|---|
| **ERC-721** | Estándar de NFTs: cada token es único y tiene un dueño (`ownerOf`). |
| **Mint / Acuñar** | Crear un NFT nuevo y asignarlo a una wallet. |
| **tokenId** | Identificador único del NFT dentro del contrato (empieza en 1). |
| **OpenZeppelin** | Librería de contratos seguros y auditados (aquí, la base ERC-721). |
| **Metadata on-chain** | Datos del boleto guardados en el propio contrato (no en un JSON externo). |
| **hash (keccak256)** | Huella de los datos del boleto; prueba de que no fueron alterados. |
| **safeTransferFrom** | Función ERC-721 que transfiere la propiedad de un token de una wallet a otra. |
| **Importar cuenta** | Añadir a MetaMask una cuenta de Ganache usando su private key. |
