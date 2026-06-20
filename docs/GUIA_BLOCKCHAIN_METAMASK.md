# Guía — Flujo MetaMask (Enviar a Blockchain) · mod_02_productos + frontend_productos

Esta guía implementa el patrón del **Lab08 (facturas)** sobre el módulo de eventos:
el usuario firma la transacción **desde el navegador con MetaMask** y el `txHash`
queda guardado en la base de datos como prueba on-chain.

> Resultado esperado: en el dashboard, cada evento sin registrar muestra un botón
> **⚡ (Enviar a blockchain)**. Al pulsarlo, MetaMask pide firmar; al confirmar, el
> evento muestra el badge verde **On-chain ✓** con el hash de la transacción.

---

## 1. Cambios realizados

### Backend (`mod_02_productos`)
- **`src/db/schema.sql`** — corregido el nombre de la BD: `tickets_db` → **`data_productos`**
  (coincide con `.env`).
- **Migración aplicada** a la tabla `eventos` (faltaban columnas): se añadieron
  `tx_hash VARCHAR(66)` y `onchain_id INT`.
- **`src/service/eventoService.js`** — nuevo método `updateTxHash(id, txHash, onchainId)`.
- **`src/controllers/eventoController.js`** — nuevo handler `updateTxHash` (valida `txHash`,
  responde 404 si el evento no existe).
- **`src/routes/eventoRoutes.js`** — nueva ruta **`PUT /api/eventos/:id/tx-hash`**.

### Frontend (`frontend_productos`)
- Nueva dependencia: **`ethers` v6** (firma con MetaMask, mismo motor que el backend).
- **`lib/contract.ts`** — ABI recortado del contrato `Events` + dirección desde
  `NEXT_PUBLIC_CONTRACT_ADDRESS`.
- **`lib/blockchain.ts`** — `connectWallet()`, `getConnectedAccount()` y
  `enviarEventoOnChain()` (convierte ETH→wei y fecha→timestamp, firma `crearEvento`).
- **`lib/useWallet.ts`** — hook de wallet (cuenta conectada + evento `accountsChanged`).
- **`lib/api.ts`** — nueva función `updateTxHash(id, txHash, onchainId)`.
- **`app/dashboard/page.tsx`** — chip "Conectar wallet" / cuenta conectada en el header.
- **`components/dashboard/EventsTable.tsx`** — botón **⚡ Enviar a blockchain** por fila
  (desktop y móvil), solo visible cuando el evento aún no tiene `txHash`.
- **`.env.local`** — nueva variable `NEXT_PUBLIC_CONTRACT_ADDRESS` (pendiente de pegar
  la dirección del contrato tras el deploy).

---

## 2. Requisitos (una sola vez)

| Herramienta | Para qué | Verificar |
|---|---|---|
| Node.js 18+ | backend y frontend | `node -v` |
| MariaDB/MySQL | base de datos | servicio activo en `localhost:3306` |
| Ganache (GUI) | blockchain local | https://archive.trufflesuite.com/ganache/ |
| Extensión MetaMask | firmar transacciones | en el navegador |

Instalar dependencias (si no estuvieran):
```bash
cd mod_02_productos      && npm install
cd ../frontend_productos && npm install
```

---

## 3. Base de datos (MariaDB)

Con el servidor de MariaDB encendido, crea la BD y la tabla:
```bash
mysql -h127.0.0.1 -uroot -proot < mod_02_productos/src/db/schema.sql
```
> El `schema.sql` ya crea `data_productos` con la tabla `eventos` (incluidas las
> columnas `tx_hash` y `onchain_id`). Si tu BD ya existía sin esas columnas, ejecuta:
> ```sql
> ALTER TABLE eventos
>   ADD COLUMN IF NOT EXISTS tx_hash    VARCHAR(66) NULL,
>   ADD COLUMN IF NOT EXISTS onchain_id INT         NULL;
> ```

Revisa que `mod_02_productos/.env` apunte a esa BD:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=data_productos
```

---

## 4. Ganache (blockchain local)

1. Abre **Ganache** → **Quickstart** (o un Workspace nuevo).
2. Confirma en *Settings → Server*:
   - **RPC Server:** `HTTP://127.0.0.1:7545`
   - **Network ID / Chain ID:** `1337`
3. Verás 10 cuentas con 100 ETH cada una. Deja Ganache abierto.
4. Copia la **private key** de la primera cuenta (icono de la llave 🔑) — la usarás
   para el deploy con Hardhat y/o para importar la cuenta en MetaMask.

> El proyecto ya está configurado para Ganache: `hardhat.config.cjs` usa el RPC
> `7545`, `chainId 1337` y fija `evmVersion: "paris"` (Ganache no soporta el opcode
> PUSH0 de "shanghai"; sin esto el deploy falla con `CALL_EXCEPTION`).

---

## 5. Desplegar el contrato `Events`

Tienes **dos opciones**. Para el flujo MetaMask del frontend basta con obtener la
**dirección** del contrato desplegado.

### Opción A — Hardhat (recomendada, ya está montada)

1. En `mod_02_productos/.env`, pega la private key copiada de Ganache:
   ```
   GANACHE_RPC_URL=http://127.0.0.1:7545
   BLOCKCHAIN_PRIVATE_KEY=0x...   # la llave de la cuenta 1 de Ganache
   BLOCKCHAIN_ENABLED=true
   ```
2. Compila y despliega:
   ```bash
   cd mod_02_productos
   npm run compile
   npm run deploy
   ```
3. La consola imprime `Contrato Events desplegado en: 0x....` y se genera
   `src/blockchain/contract-info.json` (dirección + ABI) que el backend lee solo.
4. **Copia esa dirección** `0x...` para el paso 6.

### Opción B — Remix IDE (como en el lab)

1. Abre https://remix.ethereum.org
2. Crea `Events.sol` y pega el contenido de `mod_02_productos/contracts/Events.sol`.
3. **Solidity Compiler:** versión `0.8.20`. En *Advanced Configurations* pon
   **EVM Version = `paris`** (importante para Ganache). Compila.
4. **Deploy & Run Transactions:**
   - *Environment:* **Injected Provider - MetaMask** (con MetaMask en la red Ganache,
     ver paso 7), o **External HTTP Provider** con URL `http://127.0.0.1:7545`.
   - Pulsa **Deploy** y confirma.
5. Copia la dirección del contrato desplegado (sección *Deployed Contracts*) para el
   paso 6.

> Con la Opción B el backend no genera `contract-info.json`, pero **no es necesario**
> para el flujo MetaMask: el frontend ya trae el ABI embebido en `lib/contract.ts` y
> solo necesita la dirección. (El registro automático server-side, si lo quieres,
> requiere la Opción A.)

---

## 6. Configurar la dirección en el frontend

Edita `frontend_productos/.env.local` y pega la dirección del paso 5:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CONTRACT_ADDRESS=0xLaDireccionDeTuContrato
```
> Si cambias esta variable con el frontend ya corriendo, **reinicia** `npm run dev`
> (las variables `NEXT_PUBLIC_*` se inyectan al arrancar).

---

## 7. MetaMask → red Ganache

1. Abre MetaMask → **Redes → Agregar red manualmente**:
   - **Nombre:** Ganache Local
   - **RPC URL:** `http://127.0.0.1:7545`
   - **Chain ID:** `1337`
   - **Símbolo:** ETH
2. **Importar cuenta** → pega la **private key** de una cuenta de Ganache (paso 4).
   Verás el saldo de 100 ETH.
3. Selecciona esa cuenta y la red **Ganache Local** como activas.

---

## 8. Arrancar todo

En dos terminales:
```bash
# Terminal 1 — backend (API en http://localhost:3000)
cd mod_02_productos
npm run dev

# Terminal 2 — frontend (http://localhost:3001 normalmente)
cd frontend_productos
npm run dev
```
> El frontend llama a la API vía `rewrites` en `next.config.ts` (`/api/* → :3000`),
> así que no hay problemas de CORS.

---

## 9. Probar el flujo "Enviar a blockchain"

1. Abre el dashboard (la URL que imprime `next dev`, p. ej. `http://localhost:3001/dashboard`).
2. Pulsa **Conectar wallet** en el header → autoriza en MetaMask. Verás la cuenta
   `0x1234…abcd` en verde.
3. Crea un evento (o usa uno existente sin badge On-chain).
4. En la fila del evento, pulsa el botón **⚡ (Enviar a blockchain)**.
5. MetaMask abre el popup para **firmar** la transacción `crearEvento(...)` → **Confirmar**.
6. Al minarse (instantáneo en Ganache), aparece el toast *On-chain ✓* y la fila muestra
   el badge verde con el hash. Clic en el badge para **copiar el hash completo**.

### Verificación
- **Ganache → pestaña Transactions:** verás la transacción recién creada.
- **Ganache → pestaña Contracts** (o Blocks): el contrato y la llamada.
- **BD:** `SELECT id, name, tx_hash, onchain_id FROM eventos;` → la fila tiene el hash.
- **Remix** (si lo usaste): en *Deployed Contracts*, llama a `getEvento(onchainId)` o
  `getTodos()` para leer los datos guardados on-chain.

---

## 10. Problemas frecuentes

| Síntoma | Causa / Solución |
|---|---|
| `Falta NEXT_PUBLIC_CONTRACT_ADDRESS` | No pegaste la dirección en `.env.local` o no reiniciaste `npm run dev`. |
| `MetaMask no está instalado` | Instala la extensión MetaMask y recarga la página. |
| MetaMask error "wrong network" / nonce | Asegúrate de estar en la red **Ganache (1337)**. Si reiniciaste Ganache, en MetaMask: *Configuración avanzada → Borrar datos de actividad/nonce*. |
| Deploy falla `CALL_EXCEPTION` / PUSH0 | El compilador no usó `evmVersion: paris`. En Hardhat ya está; en Remix selecciónalo a mano. |
| `Error conectando a MariaDB` | Servicio MariaDB apagado o credenciales/`DB_NAME` incorrectos en `.env`. |
| El badge no aparece | El backend no guardó el `txHash`: revisa que `PUT /api/eventos/:id/tx-hash` responda 200 en la consola del backend. |

---

## 11. Estado de verificación (lo ya probado)

- ✅ Backend arranca y conecta a `data_productos`; `GET /api/eventos` responde.
- ✅ `PUT /api/eventos/:id/tx-hash` guarda y persiste `tx_hash` + `onchain_id`.
- ✅ Contrato `Events.sol` compila con Hardhat (`evm target: paris`).
- ✅ Frontend compila sin errores (`npm run build`: TypeScript + lint OK).
- ⏳ Firma real con MetaMask + Ganache: requiere abrir Ganache y el navegador (pasos 4–9).
