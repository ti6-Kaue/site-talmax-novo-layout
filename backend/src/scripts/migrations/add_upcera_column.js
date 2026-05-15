/**
 * Adiciona a coluna is_upcera na tabela produtos.
 * Essa flag marca quais produtos aparecem na secao especial da Upcera.
 */
const db = require('./db');

async function updateTable() {
    try {
        console.log("Adicionando coluna is_upcera à tabela produtos...");
        await db.query('ALTER TABLE produtos ADD COLUMN is_upcera BOOLEAN DEFAULT FALSE');
        console.log("Coluna adicionada com sucesso!");
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log("A coluna is_upcera já existe.");
            process.exit(0);
        } else {
            console.error("Erro ao atualizar tabela:", err);
            process.exit(1);
        }
    }
}

updateTable();
