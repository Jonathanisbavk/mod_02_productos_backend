CREATE DATABASE IF NOT EXISTS tickets_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tickets_db;

CREATE TABLE IF NOT EXISTS eventos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)   NOT NULL,
  description   TEXT           NULL,
  fecha         DATETIME       NOT NULL,
  lugar         VARCHAR(150)   NOT NULL,
  genero        VARCHAR(80)    NULL,
  ciudad        VARCHAR(80)    NULL,
  precio_eth    DECIMAL(20,8)  NOT NULL,
  aforo         INT            NOT NULL,
  banner        VARCHAR(255)   NULL,
  metadata_path VARCHAR(255)   NULL,
  tx_hash       VARCHAR(66)    NULL,   -- hash de la transaccion on-chain (prueba blockchain)
  onchain_id    INT            NULL,   -- id del evento dentro del contrato Events
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migracion para bases de datos ya existentes (ejecutar una sola vez):
-- ALTER TABLE eventos
--   ADD COLUMN tx_hash    VARCHAR(66) NULL,
--   ADD COLUMN onchain_id INT         NULL;
