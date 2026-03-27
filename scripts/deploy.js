const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// SECURITY: All sensitive values MUST come from environment - no defaults
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS;

if (!RPC_URL || !PRIVATE_KEY) {
  console.error('CRITICAL: Missing required environment variables');
  console.error('Required: RPC_URL, PRIVATE_KEY');
  console.error('Example: RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY PRIVATE_KEY=0x... node scripts/deploy.js');
  process.exit(1);
}

// Circuit configuration
const CIRCUIT_PATH = path.join(__dirname, '../circuits/dataMin.circom');
const BUILD_DIR = path.join(__dirname, '../circuits/build');
const ARTIFACTS_DIR = path.join(__dirname, '../circuits/artifacts');

// Contract configuration
const CONTRACT_NAME = 'DataMinVerifier';
const CONTRACT_PATH = path.join(__dirname, '../contracts/DataMinVerifier.sol');

// Testnet configuration
const SEPOLIA_CHAIN_ID = 11155111;
const DEPLOYMENT_TIMEOUT = 120000; // 2 minutes

// Proof generation parameters
const NUM_FIELDS = 15;
const BUDGET = 5;

// Mock patient data for integration testing
const MOCK_PATIENT_DATA = {
  patientId: 'patient_001',
  diagnosis: 'hypertension',
  fields: {
    BLOOD_PRESSURE: 120,
    HEART_RATE: 75,
    WEIGHT: 70,
    MEDICATION_LIST: ['Lisinopril']
  }
};

// Integration test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Valid Hypertension Query',
    queryMask: [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    recordMask: [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    expectedValid: true
  },
  {
    name: 'Valid Diabetes Query',
    queryMask: [0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    recordMask: [0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    expectedValid: true
  },
  {
    name: 'Invalid Over-Query (Accessing Allergy)',
    queryMask: [0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    recordMask: [0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    expectedValid: false
  }
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function compileCircuit() {
  log('Compiling ZK circuit...', 'info');
  
  try {
    // Check if circuit file exists
    if (!fs.existsSync(CIRCUIT_PATH)) {
      throw new Error(`Circuit file not found: ${CIRCUIT_PATH}`);
    }
    
    // Create build directory if it doesn't exist
    if (!fs.existsSync(BUILD_DIR)) {
      fs.mkdirSync(BUILD_DIR, { recursive: true });
    }
    
    // Create artifacts directory if it doesn't exist
    if (!fs.existsSync(ARTIFACTS_DIR)) {
      fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    }
    
    // Compile circuit using snarkjs
    const compileCmd = `snarkjs groth16 setup ${CIRCUIT_PATH} ${path.join(ARTIFACTS_DIR, 'verification_key.json')} ${path.join(ARTIFACTS_DIR, 'proving_key.json')}`;
    execSync(compileCmd, { stdio: 'inherit' });
    
    log('Circuit compiled successfully', 'success');
    return true;
  } catch (error) {
    log(`Circuit compilation failed: ${error.message}`, 'error');
    return false;
  }
}

async function compileContract() {
  log('Compiling Solidity contract...', 'info');
  
  try {
    // Check if contract file exists
    if (!fs.existsSync(CONTRACT_PATH)) {
      throw new Error(`Contract file not found: ${CONTRACT_PATH}`);
    }
    
    // Compile using hardhat
    const compileCmd = 'npx hardhat compile';
    execSync(compileCmd, { stdio: 'inherit' });
    
    log('Contract compiled successfully', 'success');
    return true;
  } catch (error) {
    log(`Contract compilation failed: ${error.message}`, 'error');
    return false;
  }
}

async function deployContract() {
  log('Deploying DataMinVerifier contract to Sepolia...', 'info');
  
  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceInEth = ethers.formatEther(balance);
  
  if (parseFloat(balanceInEth) < 0.01) {
    throw new Error(`Insufficient balance: ${balanceInEth} ETH. Please fund your wallet with Sepolia ETH.`);
  }
  
  log(`Deployer address: ${wallet.address}`, 'info');
  log(`Balance: ${balanceInEth} ETH`, 'info');
  
  // Get contract factory
  const ContractFactory = await ethers.getContractFactory(CONTRACT_NAME);
  
  // Deploy contract
  const contract = await ContractFactory.deploy();
  
  log('Waiting for deployment transaction...', 'info');
  const receipt = await contract.deployed();
  
  log(`Contract deployed to: ${contract.address}`, 'success');
  log(`Transaction hash: ${receipt.transactionHash}`, 'info');
  
  return {
    address: contract.address,
    receipt: receipt,
    wallet: wallet
  };
}

async function generateProof(queryMask, recordMask) {
  log('Generating ZK proof...', 'info');
  
  try {
    // Convert masks to arrays for snarkjs
    const queryMaskArray = queryMask.map(b => b.toString());
    const recordMaskArray = recordMask.map(b => b.toString());
    
    // Generate proof using snarkjs
    const proofPath = path.join(ARTIFACTS_DIR, 'proof.json');
    const publicSignalsPath = path.join(ARTIFACTS_DIR, 'public_signals.json');
    
    const generateCmd = `snarkjs groth16 fullproving ${CIRCUIT_PATH} ${path.join(ARTIFACTS_DIR, 'proving_key.json')} ${JSON.stringify({
      queryMask: queryMaskArray,
      recordMask: recordMaskArray
    })} ${proofPath} ${publicSignalsPath}`;
    
    execSync(generateCmd, { stdio: 'pipe' });
    
    // Read proof and public signals
    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
    const publicSignals = JSON.parse(fs.readFileSync(publicSignalsPath, 'utf8'));
    
    log('Proof generated successfully', 'success');
    
    return {
      proof: proof,
      publicSignals: publicSignals
    };
  } catch (error) {
    log(`Proof generation failed: ${error.message}`, 'error');
    throw error;
  }
}

async function verifyProof(contract, proof, publicSignals) {
  log('Verifying proof on-chain...', 'info');
  
  try {
    // Prepare proof data
    const proofData = {
      A: [proof.pi_a[0], proof.pi_a[1]],
      B: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      C: [proof.pi_c[0], proof.pi_c[1]],
      signal: publicSignals
    };
    
    // Verify proof
    const tx = await contract.verifyProof(
      proofData.A,
      proofData.B,
      proofData.C,
      proofData.signal
    );
    
    log('Waiting for verification transaction...', 'info');
    const receipt = await tx.wait();
    
    log('Proof verified successfully on-chain', 'success');
    log(`Transaction hash: ${receipt.transactionHash}`, 'info');
    
    return {
      verified: true,
      receipt: receipt
    };
  } catch (error) {
    log(`Proof verification failed: ${error.message}`, 'error');
    return {
      verified: false,
      error: error.message
    };
  }
}

async function runIntegrationTests(contract) {
  log('Running integration tests...', 'info');
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    log(`\nTesting: ${scenario.name}`, 'info');
    
    try {
      // Generate proof
      const { proof, publicSignals } = await generateProof(
        scenario.queryMask,
        scenario.recordMask
      );
      
      // Verify proof
      const result = await verifyProof(contract, proof, publicSignals);
      
      // Check if result matches expected
      const testPassed = result.verified === scenario.expectedValid;
      
      results.push({
        name: scenario.name,
        passed: testPassed,
        expectedValid: scenario.expectedValid,
        actualValid: result.verified,
        error: result.error || null
      });
      
      if (testPassed) {
        log(`✅ Test passed: ${scenario.name}`, 'success');
      } else {
        log(`❌ Test failed: ${scenario.name}`, 'error');
        log(`   Expected: ${scenario.expectedValid}, Got: ${result.verified}`, 'error');
      }
    } catch (error) {
      log(`❌ Test error: ${scenario.name}`, 'error');
      log(`   ${error.message}`, 'error');
      
      results.push({
        name: scenario.name,
        passed: false,
        expectedValid: scenario.expectedValid,
        actualValid: null,
        error: error.message
      });
    }
  }
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  log(`\nIntegration Test Results: ${passedCount}/${totalCount} passed`, 'info');
  
  return {
    results: results,
    passed: passedCount,
    total: totalCount
  };
}

async function updateDashboard(contractAddress) {
  log('Updating dashboard with deployment info...', 'info');
  
  const dashboardPath = path.join(__dirname, '../public/dashboard.html');
  
  try {
    let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Update contract address in dashboard
    dashboardContent = dashboardContent.replace(
      /const CONTRACT_ADDRESS = ".*?";/,
      `const CONTRACT_ADDRESS = "${contractAddress}";`
    );
    
    // Update deployment status
    dashboardContent = dashboardContent.replace(
      /const DEPLOYMENT_STATUS = ".*?";/,
      `const DEPLOYMENT_STATUS = "deployed";`
    );
    
    // Update deployment timestamp
    const timestamp = new Date().toISOString();
    dashboardContent = dashboardContent.replace(
      /const DEPLOYMENT_TIMESTAMP = ".*?";/,
      `const DEPLOYMENT_TIMESTAMP = "${timestamp}";`
    );
    
    fs.writeFileSync(dashboardPath, dashboardContent);
    
    log('Dashboard updated successfully', 'success');
  } catch (error) {
    log(`Failed to update dashboard: ${error.message}`, 'error');
  }
}

async function main() {
  log('='.repeat(60), 'info');
  log('MediChain Deployment Script', 'info');
  log('='.repeat(60), 'info');
  
  try {
    // Step 1: Compile circuit
    log('\n[Step 1/5] Compiling ZK Circuit', 'info');
    const circuitCompiled = await compileCircuit();
    if (!circuitCompiled) {
      throw new Error('Circuit compilation failed');
    }
    
    // Step 2: Compile contract
    log('\n[Step 2/5] Compiling Solidity Contract', 'info');
    const contractCompiled = await compileContract();
    if (!contractCompiled) {
      throw new Error('Contract compilation failed');
    }
    
    // Step 3: Deploy contract
    log('\n[Step 3/5] Deploying Contract to Sepolia', 'info');
    const deployment = await deployContract();
    const contractAddress = deployment.address;
    
    // Step 4: Run integration tests
    log('\n[Step 4/5] Running Integration Tests', 'info');
    const ContractFactory = await ethers.getContractFactory(CONTRACT_NAME);
    const contract = new ethers.Contract(contractAddress, ContractFactory.interface, deployment.wallet);
    
    const testResults = await runIntegrationTests(contract);
    
    if (testResults.passed !== testResults.total) {
      log('Some integration tests failed', 'error');
    }
    
    // Step 5: Update dashboard
    log('\n[Step 5/5] Updating Dashboard', 'info');
    await updateDashboard(contractAddress);
    
    // Final summary
    log('\n' + '='.repeat(60), 'info');
    log('DEPLOYMENT COMPLETE', 'success');
    log('='.repeat(60), 'info');
    log(`Contract Address: ${contractAddress}`, 'info');
    log(`Testnet: Sepolia (Chain ID: ${SEPOLIA_CHAIN_ID})`, 'info');
    log(`Integration Tests: ${testResults.passed}/${testResults.total} passed`, 'info');
    log(`Transaction Explorer: https://sepolia.etherscan.io/tx/${deployment.receipt.transactionHash}`, 'info');
    log(`Dashboard: http://localhost:3000/dashboard.html`, 'info');
    log('='.repeat(60), 'info');
    
    // Save deployment info
    const deploymentInfo = {
      contractAddress: contractAddress,
      transactionHash: deployment.receipt.transactionHash,
      timestamp: new Date().toISOString(),
      testResults: testResults,
      network: 'sepolia'
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../.deployed.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    log('Deployment info saved to .deployed.json', 'info');
    
  } catch (error) {
    log(`\nDeployment failed: ${error.message}`, 'error');
    log(error.stack, 'error');
    process.exit(1);
  }
}

// Run deployment
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});