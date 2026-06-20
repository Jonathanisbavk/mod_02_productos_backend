// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  Events - Registro on-chain de eventos para el sistema de tickets
/// @author mod_02_productos
/// @notice Guarda EN LA BLOCKCHAIN los datos importantes del evento de forma LEGIBLE:
///         lugar, fecha (dia), precio, capacidad y organizador. Asi pueden leerse
///         directamente desde Remix o cualquier cliente con getEvento()/getTodos(),
///         sin necesidad de descifrar hashes.
/// @dev    El resto de la informacion (nombre, descripcion, banner, genero, ciudad,
///         metadata) permanece en la base de datos del backend, fuera de la cadena.
/// Controlar las clausulas del evento.
contract Events {

    /// @notice Datos del evento que se almacenan on-chain (+ id tecnico).
    struct Evento {
        uint256 id;          // id tecnico autoincremental on-chain
        string  lugar;       // LUGAR del evento (ej: "Jardin de la Cerveza")
        uint256 fecha;       // DIA del evento como timestamp UNIX (segundos)
        uint256 precioWei;   // PRECIO del boleto en wei (1 ETH = 1e18 wei)
        uint256 capacidad;   // CAPACIDAD / aforo maximo
        address organizador; // ORGANIZADOR: la wallet que registro el evento (msg.sender)
    }

    /// @notice Cantidad total de eventos registrados (tambien es el ultimo id usado).
    uint256 public total;

    /// @notice Mapa id => Evento. El id 0 no se usa (los ids empiezan en 1).
    mapping(uint256 => Evento) private _eventos;

    /// @notice Se emite al registrar un evento on-chain.
    event EventoCreado(
        uint256 indexed id,
        address indexed organizador,
        string  lugar,
        uint256 fecha,
        uint256 precioWei,
        uint256 capacidad
    );

    /// @notice Registra un evento guardando sus datos legibles on-chain.
    /// @param  lugar     Lugar del evento (no puede estar vacio).
    /// @param  fecha     Fecha del evento como timestamp UNIX.
    /// @param  precioWei Precio del boleto en wei.
    /// @param  capacidad Aforo maximo; debe ser mayor que 0.
    /// @return id        Identificador on-chain asignado al evento.
    function crearEvento(
        string calldata lugar,
        uint256 fecha,
        uint256 precioWei,
        uint256 capacidad
    ) external returns (uint256 id) {
        require(bytes(lugar).length > 0, "Events: lugar vacio");
        require(capacidad > 0,           "Events: capacidad debe ser > 0");

        total += 1;
        id = total;

        _eventos[id] = Evento({
            id:          id,
            lugar:       lugar,
            fecha:       fecha,
            precioWei:   precioWei,
            capacidad:   capacidad,
            organizador: msg.sender // el organizador se captura solo, no se pasa por parametro
        });

        emit EventoCreado(id, msg.sender, lugar, fecha, precioWei, capacidad);
    }

    /// @notice Devuelve los datos on-chain de un evento por su id.
    function getEvento(uint256 id) external view returns (Evento memory) {
        require(id > 0 && id <= total, "Events: id inexistente");
        return _eventos[id];
    }

    /// @notice Devuelve el catalogo completo de eventos registrados on-chain.
    function getTodos() external view returns (Evento[] memory lista) {
        lista = new Evento[](total);
        for (uint256 i = 1; i <= total; i++) {
            lista[i - 1] = _eventos[i];
        }
    }
}
