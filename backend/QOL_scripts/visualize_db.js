const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const mermaidContent = `
erDiagram
    Users ||--o{ Attempts : "has"
    MerchantApiKey ||--o{ Attempts : "validates"
    MerchantApiKey ||--o{ Rules : "defines"

    Users {
        TEXT cchash PK
        TEXT email
        TEXT phone
        TEXT otp
        TEXT biometric
        TEXT HardwareToken
    }

    MerchantApiKey {
        TEXT MerchantApiKey PK
    }

    Attempts {
        INTEGER id PK
        TEXT cchash FK
        REAL transaction_amount
        TEXT location
        TEXT merchantapikey FK
        INTEGER status "0-Fail_1-Success_2-Auth"
        DATETIME timestamp
    }

    Rules {
        INTEGER rule_id PK
        TEXT merchantapikey FK
        INTEGER priority
        REAL amount
        TEXT location
        TEXT time_start
        TEXT time_end
        TEXT condition "EQUAL_GREATER_LESS_THAN_NOT_IS"
        INTEGER success_status "0_1_2"
    }
`;

const mmdPath = path.join(__dirname, 'schema.mmd');
const pngPath = path.join(__dirname, 'db_schema.png');

// Write Mermaid file
fs.writeFileSync(mmdPath, mermaidContent);

// Generate PNG using mermaid-cli
exec(`npx mmdc -i "${mmdPath}" -o "${pngPath}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }

  console.log('✓ Database schema diagram generated: QOL_scripts/db_schema.png');

  // Clean up .mmd file
  fs.unlinkSync(mmdPath);
});
