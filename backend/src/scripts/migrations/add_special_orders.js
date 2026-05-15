/**
 * Adiciona colunas de ordenacao para secoes especiais.
 * Permite definir a ordem de exibicao de produtos em areas destacadas do site.
 */
const db = require('./db');

async function addOrderColumns() {
    try {
        console.log("Adicionando colunas de ordenação especial...");
        
        const columns = [
            'ALTER TABLE produtos ADD COLUMN upcera_order INT DEFAULT 0',
            'ALTER TABLE produtos ADD COLUMN scanner_order INT DEFAULT 0',
            'ALTER TABLE produtos ADD COLUMN printer_order INT DEFAULT 0'
        ];

        for (const sql of columns) {
            try {
                await db.query(sql);
                console.log(`Sucesso: ${sql}`);
            } catch (err) {
                if (err.code === 'ER_DUP_COLUMN_NAME') {
                    console.log(`Coluna já existe: ${sql.split('ADD COLUMN ')[1]}`);
                } else {
                    throw err;
                }
            }
        }

        console.log("Processo concluído!");
        process.exit(0);
    } catch (err) {
        console.error("Erro ao atualizar tabela:", err);
        process.exit(1);
    }
}

addOrderColumns();
