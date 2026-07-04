// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// EventoNFT es el "boleto NFT" del sistema de tickets. Es un contrato ERC-721
// (estandar de NFTs) adaptado del contrato FacturaNFT del Lab 12 de facturas:
//   - En el lab se acunaba un NFT por FACTURA (id, cliente, monto).
//   - Aqui se acuna un NFT por EVENTO/boleto (id, nombre, lugar, precio).
//
// Diferencia con el contrato `Events` (que ya existia):
//   - Events.sol  -> guarda los DATOS legibles del evento on-chain (registro/prueba).
//   - EventoNFT.sol -> emite un TOKEN transferible (ERC-721) que representa la
//                      PROPIEDAD del boleto y guarda su metadata + un hash anti-manipulacion.
//
// Usa OpenZeppelin 4.9.6 (misma version que el lab) para ERC721 + Ownable.
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EventoNFT is ERC721, Ownable {
    // Contador interno de tokenIds. Empieza en 1 (el 0 se reserva como "sin NFT").
    uint256 private _tokenIdCounter;

    // Custom errors: mas baratos en gas que require(string). Igual que en el lab.
    error NFTYaExiste(uint eventoId);
    error DireccionInvalida();
    error CampoRequerido(string campo);
    error TokenNoExiste(uint256 tokenId);

    // Metadata del boleto que se guarda on-chain junto al NFT.
    struct EventoMetadata {
        uint    eventoId;   // id del evento en la base de datos del backend
        string  name;       // nombre del evento (ej: "Rock de los 90s")
        string  lugar;      // recinto (ej: "Coliseo Nacional")
        string  precio;     // precio del boleto en ETH, como texto (ej: "0.08")
        bytes32 hash;       // huella keccak256 de los datos: prueba anti-manipulacion
        uint256 timestamp;  // instante de acunacion (block.timestamp)
    }

    // tokenId => metadata del boleto.
    mapping(uint256 => EventoMetadata) public eventoMetadata;
    // eventoId (de la BD) => tokenId. Evita acunar dos NFTs para el mismo evento.
    mapping(uint256 => uint256) public eventoToTokenId;

    // Se emite al acunar un boleto NFT.
    event NFTMinted(uint256 indexed tokenId, uint eventoId, address indexed to);

    constructor() ERC721("EventoNFT", "TCKT") {
        _tokenIdCounter = 1; // primer tokenId = 1
    }

    /// @notice Acuna (mint) un boleto NFT para un evento y guarda su metadata.
    /// @dev    Es `public`: el propio usuario firma la acunacion con MetaMask, igual
    ///         que en el lab de facturas. Devuelve el tokenId asignado.
    function mintEventoNFT(
        uint eventoId,
        string memory name,
        string memory lugar,
        string memory precio,
        bytes32 hash,
        address to
    ) public returns (uint256) {
        if (eventoToTokenId[eventoId] != 0) revert NFTYaExiste(eventoId);
        if (to == address(0))               revert DireccionInvalida();
        if (bytes(name).length == 0)        revert CampoRequerido("name");
        if (bytes(lugar).length == 0)       revert CampoRequerido("lugar");

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);

        eventoMetadata[tokenId] = EventoMetadata({
            eventoId:  eventoId,
            name:      name,
            lugar:     lugar,
            precio:    precio,
            hash:      hash,
            timestamp: block.timestamp
        });

        eventoToTokenId[eventoId] = tokenId;
        emit NFTMinted(tokenId, eventoId, to);

        return tokenId;
    }

    /// @notice Devuelve la metadata on-chain de un boleto por su tokenId.
    function getMetadata(uint256 tokenId) public view returns (EventoMetadata memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNoExiste(tokenId);
        return eventoMetadata[tokenId];
    }

    /// @notice Dado el id de un evento (BD) devuelve su tokenId (0 si aun no tiene NFT).
    function getTokenId(uint eventoId) public view returns (uint256) {
        return eventoToTokenId[eventoId];
    }
}
