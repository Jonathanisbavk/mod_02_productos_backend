import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { create } from 'kubo-rpc-client';
import { IPFS_URL, IPFS_GATEWAY } from '../config/ipfs.js';
import EventoService from './eventoService.js';

const PDFS_DIR = 'pdfs';

// Colores del "boleto" (mismo espiritu que el tema Box Office del frontend)
const TINTA  = '#1c1813';
const ORO    = '#d9a441';
const GRIS   = '#6b6154';
const VERDE  = '#4a7a5c';

function asegurarDirectorio() {
    const dir = path.join(process.cwd(), PDFS_DIR);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// URL que codifica el QR: apunta al detalle del evento en la API, para que al
// escanearlo se pueda contrastar lo impreso en el PDF contra la base de datos
// (y desde ahi contra la blockchain via txHash / onchainId).
function urlVerificacion(evento) {
    const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${base}/api/eventos/${evento.id}`;
}

function formatearFecha(fecha) {
    try {
        return new Date(fecha).toLocaleString('es-CO', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return String(fecha);
    }
}

// Carpeta del MFS donde se "montan" los PDFs para que se vean en IPFS Desktop.
const MFS_DIR = '/ticketchain';

// Sube un archivo al nodo IPFS local (Kubo). Es best-effort, igual que el registro
// on-chain: si el nodo no esta corriendo devolvemos null y el flujo continua con
// el PDF local. Nunca lanzar desde aqui.
async function subirAIpfs(filePath) {
    try {
        const ipfs = create({ url: IPFS_URL });
        const contenido = fs.readFileSync(filePath);
        const resultado = await ipfs.add(contenido);
        const ipfsHash = resultado.cid.toString();

        // ipfs.add() solo pinea el archivo; la pestaña "Files" de IPFS Desktop
        // muestra el MFS. Copiamos el CID al MFS (con el nombre real del PDF)
        // para que aparezca en la app. Si ya existia una version anterior, se
        // reemplaza. Cualquier fallo aqui no invalida la subida (el CID ya existe).
        try {
            const nombre = path.basename(filePath);
            const destino = `${MFS_DIR}/${nombre}`;
            await ipfs.files.mkdir(MFS_DIR, { parents: true }).catch(() => {});
            await ipfs.files.rm(destino).catch(() => {});
            await ipfs.files.cp(`/ipfs/${ipfsHash}`, destino);
            console.log(`Visible en IPFS Desktop (Files): ${destino}`);
        } catch (mfsError) {
            console.error('No se pudo copiar al MFS (el CID sigue publicado):', mfsError.message);
        }

        return { ipfsHash, ipfsUrl: `${IPFS_GATEWAY}/${ipfsHash}` };
    } catch (error) {
        console.error('IPFS no disponible (se conserva el PDF local):', error.message);
        return null;
    }
}

const EventoPdfService = {

    // Genera el PDF del boleto/certificado del evento (datos + pruebas blockchain +
    // QR de verificacion), lo guarda en pdfs/evento_<id>.pdf y lo sube a IPFS.
    // Si la subida funciona, persiste el ipfs_hash en la BD.
    generarBoletoPDF: async (evento) => {
        const dir = asegurarDirectorio();
        const filePath = path.join(dir, `evento_${evento.id}.pdf`);

        const qrBuffer = await QRCode.toBuffer(urlVerificacion(evento), {
            margin: 1, width: 140
        });

        await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Cabecera estilo taquilla
            doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(22)
               .text('TICKETCHAIN · BOLETO DIGITAL', { align: 'center' });
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(10).fillColor(GRIS)
               .text('Certificado del evento con respaldo en blockchain e IPFS', { align: 'center' });
            doc.moveDown(0.8);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(ORO).lineWidth(2).stroke();
            doc.moveDown(1);

            // Datos del evento (los mismos que viven en la BD)
            doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(16).text(evento.name);
            if (evento.description) {
                doc.moveDown(0.2);
                doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(evento.description);
            }
            doc.moveDown(0.8);

            const campo = (etiqueta, valor) => {
                doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA)
                   .text(`${etiqueta}: `, { continued: true })
                   .font('Helvetica').fillColor(GRIS).text(String(valor ?? '—'));
                doc.moveDown(0.25);
            };

            campo('ID del evento', evento.id);
            campo('Fecha', formatearFecha(evento.fecha));
            campo('Lugar', evento.lugar);
            campo('Ciudad', evento.ciudad || '—');
            campo('Género', evento.genero || 'General');
            campo('Precio (ETH)', evento.precio_eth);
            campo('Aforo', evento.aforo);

            // Pruebas blockchain / NFT (pueden estar vacias si aun no se emitio on-chain)
            doc.moveDown(0.6);
            doc.font('Helvetica-Bold').fontSize(12).fillColor(VERDE)
               .text('Registro blockchain');
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(9).fillColor(GRIS);
            doc.text(`Tx hash (contrato Events): ${evento.tx_hash || 'Pendiente de emitir on-chain'}`);
            doc.text(`ID on-chain: ${evento.onchain_id ?? 'Pendiente'}`);
            doc.text(`Boleto NFT (tokenId): ${evento.nft_token_id ?? 'Sin acuñar'}`);
            doc.text(`Dueño del NFT: ${evento.nft_owner || '—'}`);

            // QR de verificacion: apunta al endpoint GET /api/eventos/:id
            const qrY = doc.y + 20;
            doc.image(qrBuffer, 50, qrY, { width: 120 });
            doc.font('Helvetica-Bold').fontSize(10).fillColor(TINTA)
               .text('Verificación', 185, qrY + 18);
            doc.font('Helvetica').fontSize(9).fillColor(GRIS)
               .text('Escanea el QR para consultar este evento en la API y contrastar los datos impresos con la base de datos y la blockchain.',
                     185, qrY + 34, { width: 350 });
            doc.font('Helvetica').fontSize(8).fillColor(VERDE)
               .text(urlVerificacion(evento), 185, qrY + 70, { width: 350 });

            // Pie
            doc.font('Helvetica').fontSize(8).fillColor(GRIS)
               .text(`Generado el ${new Date().toLocaleString('es-CO')} · mod_02_productos`,
                     50, 780, { align: 'center', width: 495 });

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        console.log(`PDF del evento ${evento.id} generado: ${filePath}`);

        // Subida a IPFS (best-effort) + persistencia del hash en la BD
        const ipfs = await subirAIpfs(filePath);
        if (ipfs) {
            await EventoService.updateIpfsHash(evento.id, ipfs.ipfsHash);
            console.log(`PDF subido a IPFS: ${ipfs.ipfsHash}`);
        }

        return {
            filePath: `/pdfs/evento_${evento.id}.pdf`,
            ipfsHash: ipfs ? ipfs.ipfsHash : null,
            ipfsUrl:  ipfs ? ipfs.ipfsUrl  : null
        };
    },

    // Genera el reporte final en PDF: una pagina de resumen y una ficha por evento,
    // cada una con su QR de verificacion (URL de IPFS si el boleto ya fue subido,
    // o URL de la API en su defecto). Devuelve la ruta absoluta del archivo.
    generarReportePDF: async (eventos) => {
        const dir = asegurarDirectorio();
        const filePath = path.join(dir, 'reporte_eventos.pdf');

        // Pre-generar los QR (uno por evento) antes de armar el documento
        const qrs = await Promise.all(eventos.map((ev) => {
            const destino = ev.ipfs_hash
                ? `${IPFS_GATEWAY}/${ev.ipfs_hash}`
                : urlVerificacion(ev);
            return QRCode.toBuffer(destino, { margin: 1, width: 100 })
                .then((buffer) => ({ buffer, destino }));
        }));

        await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Portada / resumen
            doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(22)
               .text('REPORTE FINAL DE EVENTOS', { align: 'center' });
            doc.moveDown(0.3);
            doc.font('Helvetica').fontSize(10).fillColor(GRIS)
               .text(`TicketChain · mod_02_productos · ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
            doc.moveDown(0.8);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(ORO).lineWidth(2).stroke();
            doc.moveDown(1);

            const total       = eventos.length;
            const onChain     = eventos.filter((e) => e.tx_hash).length;
            const conNft      = eventos.filter((e) => e.nft_token_id != null).length;
            const enIpfs      = eventos.filter((e) => e.ipfs_hash).length;
            const aforoTotal  = eventos.reduce((s, e) => s + Number(e.aforo || 0), 0);

            doc.font('Helvetica-Bold').fontSize(13).fillColor(TINTA).text('Resumen');
            doc.moveDown(0.4);
            doc.font('Helvetica').fontSize(11).fillColor(GRIS);
            doc.text(`Eventos registrados: ${total}`);
            doc.text(`Emitidos on-chain (contrato Events): ${onChain}`);
            doc.text(`Con boleto NFT acuñado (ERC-721): ${conNft}`);
            doc.text(`Con PDF publicado en IPFS: ${enIpfs}`);
            doc.text(`Aforo total: ${aforoTotal.toLocaleString('es-CO')}`);

            // Ficha por evento con su QR
            eventos.forEach((ev, i) => {
                const { buffer, destino } = qrs[i];

                // Nueva pagina si la ficha no cabe
                if (doc.y > 620) doc.addPage();

                doc.moveDown(1.2);
                const topY = doc.y;
                doc.moveTo(50, topY).lineTo(545, topY).strokeColor('#d8cdb8').lineWidth(1).stroke();
                doc.moveDown(0.6);

                const textoY = doc.y;
                doc.image(buffer, 455, textoY, { width: 90 });

                doc.font('Helvetica-Bold').fontSize(13).fillColor(TINTA)
                   .text(`#${ev.id} · ${ev.name}`, 50, textoY, { width: 390 });
                doc.font('Helvetica').fontSize(9).fillColor(GRIS);
                doc.text(`Fecha: ${formatearFecha(ev.fecha)}   ·   Lugar: ${ev.lugar}${ev.ciudad ? ' (' + ev.ciudad + ')' : ''}`, { width: 390 });
                doc.text(`Precio: ${ev.precio_eth} ETH   ·   Aforo: ${ev.aforo}   ·   Género: ${ev.genero || 'General'}`, { width: 390 });
                doc.text(`Tx hash: ${ev.tx_hash || 'Sin emitir on-chain'}`, { width: 390 });
                doc.text(`NFT tokenId: ${ev.nft_token_id ?? 'Sin acuñar'}   ·   IPFS: ${ev.ipfs_hash || 'Sin publicar'}`, { width: 390 });
                doc.font('Helvetica').fontSize(7).fillColor(VERDE)
                   .text(`QR: ${destino}`, { width: 390 });

                // Continuar debajo del bloque mas alto (texto o QR)
                doc.y = Math.max(doc.y, textoY + 95);
                doc.x = 50;
            });

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        console.log(`Reporte PDF generado: ${filePath}`);
        return filePath;
    }
};

export default EventoPdfService;
