#!/usr/bin/env node

/**
 * Automated Vercel Deployment Testing Script
 *
 * This script automatically tests your Vercel deployment and reports
 * whether it's working correctly or what needs to be fixed.
 *
 * Usage: node test-deployment.js <your-vercel-url>
 * Example: node test-deployment.js https://nametag-web.vercel.app
 */

const https = require('https');
const http = require('http');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, colors.bold);
  log(message, colors.bold);
  log('='.repeat(60), colors.bold);
}

// Make HTTP/HTTPS request
function makeRequest(url, path = '/') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url + path);
    const lib = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Nametag-Deployment-Test/1.0'
      }
    };

    const req = lib.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Test functions
async function testHealthEndpoint(baseUrl) {
  logHeader('Testing /health Endpoint');

  try {
    const response = await makeRequest(baseUrl, '/health');

    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.body);
        if (data.status === 'ok') {
          logSuccess('Health endpoint responded correctly');
          logInfo(`Response: ${JSON.stringify(data, null, 2)}`);
          return { success: true, data };
        } else {
          logWarning('Health endpoint returned unexpected data');
          logInfo(`Response: ${response.body}`);
          return { success: false, error: 'Unexpected response format' };
        }
      } catch (e) {
        logError('Health endpoint returned invalid JSON');
        logInfo(`Response: ${response.body.substring(0, 200)}`);
        return { success: false, error: 'Invalid JSON response' };
      }
    } else {
      logError(`Health endpoint returned status ${response.statusCode}`);
      logInfo(`Response: ${response.body.substring(0, 200)}`);
      return { success: false, error: `HTTP ${response.statusCode}` };
    }
  } catch (error) {
    logError(`Failed to connect to health endpoint: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testRootEndpoint(baseUrl) {
  logHeader('Testing Root Endpoint (/)');

  try {
    const response = await makeRequest(baseUrl, '/');

    // 401 is actually success (auth working)
    // 200 might mean auth is bypassed
    // 500 means server crash (bad)

    if (response.statusCode === 401) {
      logSuccess('Root endpoint requires authentication (correct!)');
      logInfo('MentraOS auth middleware is working');
      return { success: true, requiresAuth: true };
    } else if (response.statusCode === 200) {
      logWarning('Root endpoint returned 200 (auth might be bypassed)');
      logInfo('Check if authentication is properly configured');
      return { success: true, requiresAuth: false };
    } else if (response.statusCode === 500) {
      logError('Root endpoint returned 500 Internal Server Error');
      logInfo('This indicates a server crash - check Vercel function logs');
      logInfo(`Response: ${response.body.substring(0, 300)}`);
      return { success: false, error: 'Server error (500)' };
    } else {
      logWarning(`Root endpoint returned status ${response.statusCode}`);
      logInfo(`Response: ${response.body.substring(0, 200)}`);
      return { success: true, status: response.statusCode };
    }
  } catch (error) {
    logError(`Failed to connect to root endpoint: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testAPIEndpoint(baseUrl) {
  logHeader('Testing /api/stats Endpoint');

  try {
    const response = await makeRequest(baseUrl, '/api/stats');

    // Should return 401 without auth
    if (response.statusCode === 401) {
      logSuccess('API endpoint requires authentication (correct!)');
      return { success: true, requiresAuth: true };
    } else if (response.statusCode === 500) {
      logError('API endpoint returned 500 Internal Server Error');
      logInfo(`Response: ${response.body.substring(0, 300)}`);
      return { success: false, error: 'Server error (500)' };
    } else {
      logWarning(`API endpoint returned status ${response.statusCode}`);
      logInfo(`Response: ${response.body.substring(0, 200)}`);
      return { success: true, status: response.statusCode };
    }
  } catch (error) {
    logError(`Failed to connect to API endpoint: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function checkESMErrors(baseUrl) {
  logHeader('Checking for ESM/CommonJS Errors');

  try {
    // Try to trigger any potential errors
    const response = await makeRequest(baseUrl, '/');

    if (response.statusCode === 500) {
      const body = response.body.toLowerCase();

      if (body.includes('err_require_esm')) {
        logError('ERR_REQUIRE_ESM detected!');
        logError('The chalk/boxen ESM issue is NOT fixed');
        logInfo('Check Vercel function logs for details');

        if (body.includes('chalk')) {
          logInfo('Issue: chalk module');
        }
        if (body.includes('boxen')) {
          logInfo('Issue: boxen module');
        }

        return { success: false, error: 'ERR_REQUIRE_ESM' };
      } else {
        logWarning('500 error but not ERR_REQUIRE_ESM');
        logInfo(`Error: ${response.body.substring(0, 200)}`);
        return { success: false, error: 'Other server error' };
      }
    } else {
      logSuccess('No ESM/CommonJS errors detected');
      logInfo('The Yarn dependency fix is working!');
      return { success: true };
    }
  } catch (error) {
    logWarning(`Could not check for ESM errors: ${error.message}`);
    return { success: true }; // Connection error doesn't mean ESM issue
  }
}

// Main test runner
async function runTests(baseUrl) {
  log('\n' + '🚀 '.repeat(30), colors.cyan);
  log('Nametag Companion UI - Vercel Deployment Test', colors.bold + colors.cyan);
  log('🚀 '.repeat(30) + '\n', colors.cyan);

  logInfo(`Testing URL: ${baseUrl}`);
  logInfo(`Timestamp: ${new Date().toISOString()}\n`);

  const results = {
    url: baseUrl,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Health endpoint
  results.tests.health = await testHealthEndpoint(baseUrl);

  // Test 2: Root endpoint
  results.tests.root = await testRootEndpoint(baseUrl);

  // Test 3: API endpoint
  results.tests.api = await testAPIEndpoint(baseUrl);

  // Test 4: ESM errors
  results.tests.esm = await checkESMErrors(baseUrl);

  // Summary
  logHeader('Test Summary');

  const allSuccess = Object.values(results.tests).every(t => t.success);

  if (allSuccess) {
    logSuccess('All tests passed! ✨');
    log('\n📱 Next steps:', colors.bold);
    log('1. Configure Webview URL in MentraOS console:', colors.cyan);
    log(`   ${baseUrl}`, colors.cyan);
    log('2. Test on mobile via MentraOS app', colors.cyan);
    log('3. Verify authentication flow works', colors.cyan);
  } else {
    logError('Some tests failed');
    log('\n🔍 Troubleshooting steps:', colors.bold);

    if (!results.tests.esm.success) {
      log('❌ ESM/CommonJS issue detected:', colors.red);
      log('   1. Check that yarn.lock is in the repository', colors.yellow);
      log('   2. Verify Vercel is using Yarn (not npm)', colors.yellow);
      log('   3. Check function logs in Vercel dashboard', colors.yellow);
      log('   4. Try redeploying: git commit --allow-empty -m "redeploy" && git push', colors.yellow);
    }

    if (!results.tests.health.success) {
      log('❌ Health endpoint issue:', colors.red);
      log('   1. Check environment variables in Vercel', colors.yellow);
      log('   2. Verify all dependencies installed correctly', colors.yellow);
      log('   3. Check Vercel function logs for startup errors', colors.yellow);
    }

    if (!results.tests.root.success || !results.tests.api.success) {
      log('❌ Server error detected:', colors.red);
      log('   1. Check Vercel function logs for errors', colors.yellow);
      log('   2. Verify environment variables are set', colors.yellow);
      log('   3. Check for runtime errors in logs', colors.yellow);
    }
  }

  // Results JSON
  logHeader('Detailed Results (JSON)');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  log('Usage: node test-deployment.js <vercel-url>', colors.red);
  log('Example: node test-deployment.js https://nametag-web.vercel.app', colors.cyan);
  process.exit(1);
}

const baseUrl = args[0].replace(/\/$/, ''); // Remove trailing slash

// Run tests
runTests(baseUrl)
  .then(results => {
    const success = Object.values(results.tests).every(t => t.success);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
