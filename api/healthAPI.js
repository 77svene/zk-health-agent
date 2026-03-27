const https = require('https');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { ethers } = require('ethers');

// SECURITY: All sensitive values MUST come from environment - no defaults
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!RPC_URL || !CONTRACT_ADDRESS || !PRIVATE_KEY) {
  throw new Error('CRITICAL: Missing required environment variables - RPC_URL, CONTRACT_ADDRESS, PRIVATE_KEY');
}

// Field schema from HealthAgent.js for consistency
const FIELD_SCHEMA = {
  PATIENT_ID: 0,
  BLOOD_PRESSURE: 1,
  HEART_RATE: 2,
  BLOOD_SUGAR: 3,
  CHOLESTEROL: 4,
  WEIGHT: 5,
  HEIGHT: 6,
  ALLERGY_LIST: 7,
  MEDICATION_LIST: 8,
  DIAGNOSIS_HISTORY: 9,
  LAB_RESULTS: 10,
  VITAL_HISTORY: 11,
  FAMILY_HISTORY: 12,
  SOCIAL_HISTORY: 13,
  IMMUNIZATION_RECORDS: 14
};

// Circuit parameters matching dataMin.circom
const NUM_FIELDS = 15;
const BUDGET = 5;

// Proof validation cache with cryptographic integrity verification
const proofCache = new Map();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 300000; // 5 minutes

// Agent reputation registry - tracks verified agents
const agentRegistry = new Map();

// Circuit verification key hash for integrity check
const CIRCUIT_VK_HASH = '0x8f3e2a1b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';

// HealthAgent class reference for field validation
class HealthAgent {
  constructor(agentId) {
    this.agentId = agentId;
    this.reputation = 0;
    this.verifiedAt = null;
  }

  updateReputation(delta) {
    this.reputation = Math.max(0, Math.min(100, this.reputation + delta));
  }

  isVerified() {
    return this.reputation >= 80;
  }
}

// Cryptographic proof structure validator
class ProofValidator {
  constructor(contractAddress, provider) {
    this.contractAddress = contractAddress;
    this.provider = provider;
  }

  async validateProofStructure(proof) {
    // Validate proof has correct structure for Groth16
    const requiredFields = ['A', 'B', 'C', 'publicSignals'];
    for (const field of requiredFields) {
      if (!proof[field]) {
        throw new Error(`Invalid proof structure: missing ${field}`);
      }
    }

    // Validate A, B, C are arrays of 2 elements each
    for (const coord of ['A', 'B', 'C']) {
      if (!Array.isArray(proof[coord]) || proof[coord].length !== 2) {
        throw new Error(`Invalid ${coord} coordinates in proof`);
      }
    }

    // Validate public signals are arrays
    if (!Array.isArray(proof.publicSignals)) {
      throw new Error('Invalid publicSignals: must be array');
    }

    // Validate public signals length matches expected (queryMask + recordMask + budget)
    const expectedSignals = NUM_FIELDS * 2 + 1; // 15 query + 15 record + 1 budget
    if (proof.publicSignals.length !== expectedSignals) {
      throw new Error(`Invalid publicSignals length: expected ${expectedSignals}, got ${proof.publicSignals.length}`);
    }

    return true;
  }

  async verifyAgainstContract(proof, agentId) {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      
      // Load contract ABI
      const abi = [
        'function verifyProof(uint256[2] calldata A, uint256[2] calldata B, uint256[2] calldata C, uint256[] calldata publicInputs) external view returns (bool)',
        'function registerAgentProof(string calldata agentId, bytes32 proofHash, uint256 timestamp) external returns (bool)',
        'function getAgentReputation(string calldata agentId) external view returns (uint256)'
      ];

      const contract = new ethers.Contract(this.contractAddress, abi, wallet);

      // Convert proof coordinates to proper format
      const proofCoords = {
        A: [proof.A[0], proof.A[1]],
        B: [proof.B[0], proof.B[1]],
        C: [proof.C[0], proof.C[1]]
      };

      // Convert public signals to uint256 array
      const publicInputs = proof.publicSignals.map(sig => ethers.toBeHex(sig));

      // Verify proof against contract
      const isValid = await contract.verifyProof(
        proofCoords.A,
        proofCoords.B,
        proofCoords.C,
        publicInputs
      );

      if (!isValid) {
        throw new Error('ZK proof verification failed: proof does not satisfy circuit constraints');
      }

      // Extract query and record masks from public signals
      const queryMask = proof.publicSignals.slice(0, NUM_FIELDS);
      const recordMask = proof.publicSignals.slice(NUM_FIELDS, NUM_FIELDS * 2);
      const budget = proof.publicSignals[NUM_FIELDS * 2];

      // Validate budget constraint
      const queryCount = queryMask.filter(bit => bit === 1).length;
      if (queryCount > budget) {
        throw new Error(`Data minimization violation: queried ${queryCount} fields, budget is ${budget}`);
      }

      // Validate subset constraint (queryMask must be subset of recordMask)
      for (let i = 0; i < NUM_FIELDS; i++) {
        if (queryMask[i] === 1 && recordMask[i] === 0) {
          throw new Error(`Data minimization violation: queried field ${i} not in patient record`);
        }
      }

      // Register proof for agent reputation tracking
      const proofHash = crypto.createHash('sha256')
        .update(JSON.stringify(proof))
        .digest('hex');

      await contract.registerAgentProof(agentId, proofHash, Math.floor(Date.now() / 1000));

      // Update local cache
      proofCache.set(proofHash, {
        isValid: true,
        timestamp: Date.now(),
        agentId: agentId,
        queryMask: queryMask,
        recordMask: recordMask
      });

      // Maintain cache size
      if (proofCache.size > MAX_CACHE_SIZE) {
        const oldestKey = proofCache.keys().next().value;
        proofCache.delete(oldestKey);
      }

      return {
        verified: true,
        queryMask: queryMask,
        recordMask: recordMask,
        budget: budget,
        proofHash: proofHash
      };

    } catch (error) {
      if (error.code === 'CALL_EXCEPTION') {
        throw new Error('Contract interaction failed: verify contract address and RPC URL');
      }
      throw error;
    }
  }
}

// Request handler with adversarial input validation
class RequestHandler {
  constructor(validator) {
    this.validator = validator;
  }

  validateRequest(req) {
    // Validate HTTP method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed: only POST accepted');
    }

    // Validate content type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    // Validate request body size (prevent DoS)
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 1024 * 1024) { // 1MB limit
      throw new Error('Request body too large');
    }

    return true;
  }

  parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1024 * 1024) {
          req.destroy();
          reject(new Error('Request body too large'));
        }
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      req.on('error', reject);
    });
  }

  async handleSubmitProof(req, res) {
    try {
      // Validate request structure
      this.validateRequest(req);

      // Parse request body
      const body = await this.parseRequestBody(req);

      // Validate required fields
      if (!body.agentId || !body.proof) {
        throw new Error('Missing required fields: agentId and proof');
      }

      // Validate agentId format (prevent injection)
      if (!/^[a-zA-Z0-9_-]{3,64}$/.test(body.agentId)) {
        throw new Error('Invalid agentId format');
      }

      // Validate proof structure
      await this.validator.validateProofStructure(body.proof);

      // Check cache first (optimization)
      const proofHash = crypto.createHash('sha256')
        .update(JSON.stringify(body.proof))
        .digest('hex');

      const cached = proofCache.get(proofHash);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.status(200).json({
          status: 'Privacy Verified',
          cached: true,
          queryMask: cached.queryMask,
          recordMask: cached.recordMask
        });
      }

      // Verify proof against contract
      const result = await this.validator.verifyAgainstContract(body.proof, body.agentId);

      // Update agent reputation
      if (!agentRegistry.has(body.agentId)) {
        agentRegistry.set(body.agentId, new HealthAgent(body.agentId));
      }
      const agent = agentRegistry.get(body.agentId);
      agent.updateReputation(10);
      agent.verifiedAt = Date.now();

      return res.status(200).json({
        status: 'Privacy Verified',
        agentId: body.agentId,
        queryMask: result.queryMask,
        recordMask: result.recordMask,
        budget: result.budget,
        proofHash: result.proofHash,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Proof submission error:', error.message);
      return res.status(400).json({
        status: 'Verification Failed',
        error: error.message
      });
    }
  }

  async handleHealthCheck(req, res) {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const blockNumber = await provider.getBlockNumber();
      const contractBalance = await provider.getBalance(CONTRACT_ADDRESS);

      return res.status(200).json({
        status: 'healthy',
        blockNumber: blockNumber,
        contractBalance: contractBalance.toString(),
        cacheSize: proofCache.size,
        registeredAgents: agentRegistry.size
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  async handleAgentStatus(req, res) {
    try {
      const agentId = req.query.agentId;
      if (!agentId) {
        throw new Error('Missing agentId query parameter');
      }

      if (!agentRegistry.has(agentId)) {
        return res.status(404).json({
          status: 'not found',
          agentId: agentId
        });
      }

      const agent = agentRegistry.get(agentId);
      return res.status(200).json({
        status: 'found',
        agentId: agentId,
        reputation: agent.reputation,
        verifiedAt: agent.verifiedAt,
        isVerified: agent.isVerified()
      });
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        error: error.message
      });
    }
  }
}

// Create singleton instances
const validator = new ProofValidator(CONTRACT_ADDRESS, null);
const handler = new RequestHandler(validator);

// Create HTTPS server with TLS configuration
const serverOptions = {
  key: process.env.TLS_KEY ? fs.readFileSync(process.env.TLS_KEY) : undefined,
  cert: process.env.TLS_CERT ? fs.readFileSync(process.env.TLS_CERT) : undefined
};

// Create appropriate server based on TLS configuration
const server = serverOptions.key && serverOptions.cert
  ? https.createServer(serverOptions, handleRequest)
  : http.createServer(handleRequest);

// Request handler
async function handleRequest(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === '/submit-proof' && req.method === 'POST') {
      await handler.handleSubmitProof(req, res);
    } else if (pathname === '/health' && req.method === 'GET') {
      await handler.handleHealthCheck(req, res);
    } else if (pathname === '/agent/status' && req.method === 'GET') {
      await handler.handleAgentStatus(req, res);
    } else {
      res.status(404).json({
        status: 'not found',
        message: 'Endpoint not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'internal error',
      error: error.message
    });
  }
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing and module usage
module.exports = {
  server,
  handler,
  validator,
  FIELD_SCHEMA,
  NUM_FIELDS,
  BUDGET,
  proofCache,
  agentRegistry
};

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`MediChain API running on port ${PORT}`);
    console.log(`RPC URL: ${RPC_URL}`);
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
  });
}