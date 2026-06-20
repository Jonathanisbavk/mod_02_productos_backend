# Guía de Exposición — Módulo de Eventos con Blockchain

Sistema de gestión de eventos (conciertos/tickets) que registra cada evento en una
**blockchain** como prueba de autenticidad, usando **MetaMask** para firmar desde el
navegador. Stack: **Next.js + Express + MySQL/MariaDB + Solidity (Ganache)**.

---

## 1. Objetivo del proyecto (qué decir al inicio)

> "Construimos un panel de administración de eventos. Además de guardar los eventos en
> una base de datos tradicional, registramos los datos importantes en la **blockchain**.
> Así obtenemos una **prueba inmodificable** de que el evento existió con ese lugar,
> fecha, precio y aforo — algo que una base de datos normal no garantiza, porque se
> puede editar."

---

## 2. Conceptos clave (explícalos en 1 frase cada uno)

| Concepto | Explicación simple para exponer |
|---|---|
| **Blockchain** | Un libro de registros compartido donde, una vez escrito algo, **no se puede borrar ni cambiar**. |
| **On-chain / Off-chain** | On-chain = guardado en la blockchain (inmutable). Off-chain = guardado en la base de datos (editable). |
| **Smart contract (`Events.sol`)** | Un programa que vive en la blockchain; tiene la función `crearEvento(...)` que guarda el evento. |
| **MetaMask** | La billetera del navegador; es quien **firma** la transacción con la identidad del usuario. |
| **Ganache** | Una blockchain **local de pruebas**; trae 10 cuentas con 100 ETH ficticios. |
| **txHash** | El “número de comprobante” único de cada transacción. Es la **prueba** on-chain. |
| **wei** | La unidad mínima de ETH (1 ETH = 10¹⁸ wei). El contrato trabaja en wei. |

---

## 3. Arquitectura (dibújala o descríbela)

```
┌────────────────────┐    HTTP/REST     ┌────────────────────┐     SQL      ┌──────────┐
│  FRONTEND (Next.js) │ ───────────────▶ │  BACKEND (Express)  │ ──────────▶ │  MySQL/   │
│  Dashboard + MetaMask│ ◀─────────────── │  API /api/eventos   │ ◀────────── │  MariaDB  │
└─────────┬──────────┘                   └────────────────────┘              └──────────┘
          │  firma con MetaMask (web3 / ethers)
          ▼
┌────────────────────┐
│   GANACHE (cadena)  │  contrato Events.sol  →  crearEvento(), getEvento()
└────────────────────┘
```

- **Frontend**: muestra los eventos, permite crearlos y tiene el botón **⚡ Enviar a blockchain**.
- **Backend**: CRUD de eventos + guarda la prueba (`txHash`) en la BD.
- **Contrato en Ganache**: almacena los datos del evento de forma inmutable.

---

## 4. Qué se guarda en cada lado (punto importante)

| Dato | Dónde vive | Por qué |
|---|---|---|
| Nombre, descripción, banner, género, ciudad, metadata | **Base de datos** (off-chain) | Cambian/pesan mucho; no necesitan ser inmutables. |
| Lugar, fecha, precio, aforo, organizador | **Blockchain** (on-chain) | Son los datos “contractuales” que deben ser **inalterables**. |
| `tx_hash`, `onchain_id` | **Base de datos** | Es el **puente**: la prueba de que ese evento está en la cadena. |

> Mensaje para el profesor: *"No guardamos TODO en la blockchain porque es caro y lento.
> Guardamos solo lo crítico on-chain y enlazamos con el hash."*

---

## 5. Demo en vivo (guion paso a paso)

**Antes de empezar (ten esto listo):**
1. MariaDB encendido y la BD `data_productos` creada.
2. **Ganache abierto** (RPC `127.0.0.1:7545`, Chain ID `1337`).
3. Contrato **desplegado** y su dirección pegada en `frontend_productos/.env.local`.
4. **MetaMask** en la red Ganache, con una cuenta **que tenga ETH** (importa una de Ganache).
5. Backend (`npm run dev`) y Frontend (`npm run dev`) corriendo.

**Durante la demo, di y haz esto:**

1. *"Este es el dashboard de eventos."* → muestra la tabla.
2. *"Conecto mi billetera."* → clic en **Conectar wallet** → confirmas en MetaMask → aparece tu cuenta `0x…` en verde.
3. *"Tengo un evento que solo está en la base de datos."* → señala una fila **sin** badge On-chain.
4. *"Lo voy a registrar en la blockchain."* → clic en **⚡ Enviar a blockchain**.
5. *"MetaMask me pide firmar la transacción."* → muestra el popup → **Confirmar**.
6. *"Listo, ya está en la cadena."* → aparece el badge verde **On-chain ✓** con el hash.
7. **Verificación (lo más importante):**
   - Clic en el badge → *"copio el hash, que es la prueba."*
   - Abre **Ganache → pestaña Transactions** → *"aquí está la transacción real que acabo de crear."*
   - (Opcional) En la BD: `SELECT id, name, tx_hash FROM eventos;` → *"y el hash quedó guardado."*
   - (Opcional, Remix) Llama a `getEvento(onchainId)` → *"así leo los datos guardados on-chain."*

---

## 6. Posibles preguntas del profesor (y respuestas)

| Pregunta | Respuesta corta |
|---|---|
| **¿Por qué no guardan todo en la blockchain?** | Porque es caro y lento; on-chain va solo lo crítico (datos contractuales), el resto en BD. |
| **¿Qué es el hash exactamente?** | El identificador único de la transacción; sirve de prueba de que el registro existe y no se puede falsificar. |
| **¿Quién firma la transacción?** | El usuario con su billetera MetaMask, no el servidor. Por eso el flujo es descentralizado. |
| **¿Por qué Ganache y no Ethereum real?** | Ganache es local y gratis para desarrollo; el mismo código funciona en una red real cambiando la configuración. |
| **¿Qué pasa si Ganache está apagado?** | El evento igual se guarda en la BD; solo no obtiene el sello on-chain (degradación elegante). |
| **¿Se puede editar un evento ya on-chain?** | En la BD sí; on-chain no — esa es justamente la garantía de inmutabilidad. |
| **¿Qué es `wei`?** | La unidad mínima de ETH; convertimos el precio de ETH a wei antes de mandarlo al contrato. |
| **¿Qué evita que registren dos veces el mismo?** | Mostramos el botón ⚡ solo si el evento aún no tiene `txHash`. |

---

## 7. Cierre (qué decir al final)

> "En resumen: combinamos lo mejor de los dos mundos. Una base de datos para la gestión
> ágil y una blockchain para garantizar que los datos clave del evento son auténticos e
> inmodificables. El usuario controla su identidad con MetaMask y cada registro queda
> respaldado por una transacción verificable mediante su hash."

---

## 8. Checklist final antes de exponer

- [ ] MariaDB encendido y BD `data_productos` lista.
- [ ] Ganache abierto (7545 / chainId 1337).
- [ ] Contrato desplegado y dirección en `.env.local`.
- [ ] MetaMask en red Ganache con cuenta **con ETH**.
- [ ] Backend y Frontend corriendo (`npm run dev`).
- [ ] Probaste el botón ⚡ una vez antes de exponer.
