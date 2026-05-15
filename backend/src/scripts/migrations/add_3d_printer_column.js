/**
 * Adiciona a coluna is_3d_printer na tabela produtos.
 * Essa flag marca os produtos que devem aparecer na secao de impressoras 3D.
 */
const db = require('./db');

async function updateTable() {
    try {
        console.log("Adicionando coluna is_3d_printer à tabela produtos...");
        await db.query('ALTER TABLE produtos ADD COLUMN is_3d_printer BOOLEAN DEFAULT FALSE');
        console.log("Coluna adicionada com sucesso!");
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log("A coluna is_3d_printer já existe.");
            process.exit(0);
        } else {
            console.error("Erro ao atualizar tabela:", err);
            process.exit(1);
        }
    }
}

updateTable();
