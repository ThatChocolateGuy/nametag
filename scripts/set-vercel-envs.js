#!/usr/bin/env node
/**
 * Script to set Vercel environment variables from .env file
 * Uses child_process to run vercel env add commands
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse .env file
function parseEnvFile(filePath) {
  const envVars = {};
  const content = fs.readFileSync(filePath, 'utf-8');

  content.split('\n').forEach(line => {
    line = line.trim();
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  });

  return envVars;
}

// Set environment variable in Vercel
function setVercelEnv(name, value, environment) {
  console.log(`Setting ${name} for ${environment}...`);

  try {
    // Create a temporary file with the value
    const tmpFile = path.join(__dirname, `.tmp_${name}_${Date.now()}`);
    fs.writeFileSync(tmpFile, value, 'utf-8');

    // Use type command to pipe the value (Windows compatible)
    const command = `type "${tmpFile}" | vercel env add ${name} ${environment}`;
    execSync(command, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: 'cmd.exe',
      cwd: path.join(__dirname, '..')
    });

    // Clean up temp file
    fs.unlinkSync(tmpFile);

    console.log(`✓ ${name} set successfully for ${environment}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to set ${name} for ${environment}`);
    console.error(error.message);
    return false;
  }
}

// Main function
function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Vercel Environment Setup Script      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  const envFilePath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envFilePath)) {
    console.error('Error: .env file not found!');
    process.exit(1);
  }

  console.log('Loading environment variables from .env...');
  const envVars = parseEnvFile(envFilePath);

  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'MENTRAOS_API_KEY',
    'PACKAGE_NAME',
    'OPENAI_API_KEY'
  ];

  const optionalVars = [
    'OPENAI_MODEL',
    'COOKIE_SECRET',
    'ASSEMBLYAI_API_KEY',
    'ENABLE_DIARIZATION'
  ];

  // Check required variables
  const missing = requiredVars.filter(v => !envVars[v]);
  if (missing.length > 0) {
    console.error(`Error: Missing required variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✓ All required variables found');
  console.log('');
  console.log('Setting variables in Vercel (production environment)...');
  console.log('');

  const environments = ['production'];
  let successCount = 0;
  let failCount = 0;

  // Set required variables
  for (const varName of requiredVars) {
    for (const env of environments) {
      if (setVercelEnv(varName, envVars[varName], env)) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  // Set optional variables
  for (const varName of optionalVars) {
    if (envVars[varName]) {
      for (const env of environments) {
        if (setVercelEnv(varName, envVars[varName], env)) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }
  }

  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║          Setup Complete!               ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Successfully set: ${successCount} variable(s)`);
  if (failCount > 0) {
    console.log(`✗ Failed to set: ${failCount} variable(s)`);
  }
  console.log('');
  console.log('Next step: Deploy with "vercel --prod"');
  console.log('');
}

main();
