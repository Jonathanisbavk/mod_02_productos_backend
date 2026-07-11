// Configuracion de IPFS (nodo local Kubo + gateway publico para leer los archivos).
// El PDF del boleto se sube al nodo IPFS local (API en :5001) y se comparte con la
// URL del gateway. Si el nodo no esta corriendo, la subida es best-effort y el PDF
// queda disponible solo de forma local en /pdfs (mismo criterio que la blockchain).
export const IPFS_URL     = process.env.IPFS_URL     || 'http://127.0.0.1:5001';
export const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs';
