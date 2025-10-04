const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", async (err, tables) => {
  if (err) {
    console.error('Error fetching tables:', err);
    db.close();
    return;
  }

  const tableSchemas = [];
  const relationships = [];
  let processedTables = 0;

  tables.forEach((table) => {
    const tableName = table.name;

    // Get column info
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error(`Error fetching columns for ${tableName}:`, err);
        return;
      }

      // Build column definitions for mermaid
      let columnDefs = columns.map(col => {
        let type = col.type;
        let suffix = '';

        if (col.pk) suffix = ' PK';

        return `        ${type} ${col.name}${suffix}`;
      }).join('\n');

      tableSchemas.push(`    ${tableName} {\n${columnDefs}\n    }`);

      // Get foreign keys
      db.all(`PRAGMA foreign_key_list(${tableName})`, (err, fks) => {
        if (err) {
          console.error(`Error fetching foreign keys for ${tableName}:`, err);
          return;
        }

        fks.forEach(fk => {
          relationships.push(`    ${fk.table} ||--o{ ${tableName} : "${fk.from}"`);
        });

        processedTables++;

        // Once all tables are processed, generate the diagram
        if (processedTables === tables.length) {
          generateDiagram(tableSchemas, relationships);
        }
      });
    });
  });
});

function generateDiagram(tableSchemas, relationships) {
  const mermaidContent = `erDiagram
${relationships.join('\n')}

${tableSchemas.join('\n\n')}
`;

  const mmdPath = path.join(__dirname, 'schema.mmd');
  const pngPath = path.join(__dirname, 'db_schema.png');

  // Write Mermaid file
  fs.writeFileSync(mmdPath, mermaidContent);

  // Generate PNG using mermaid-cli
  exec(`npx mmdc -i "${mmdPath}" -o "${pngPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      db.close();
      return;
    }

    console.log('✓ Database schema diagram generated: QOL_scripts/db_schema.png');

    // Clean up .mmd file
    fs.unlinkSync(mmdPath);
    db.close();
  });
}
