# 🏥 MediChain: ZK-Verified Health Agent

> **Verifying data minimization for AI agents in healthcare via Zero-Knowledge Proofs.**

**Hackathon:** Agents Assemble - The Healthcare AI Endgame  
**Prize:** $25,000 | **Dates:** Mar 04 - May 11, 2026  
**Repo:** [https://github.com/77svene/zk-health-agent](https://github.com/77svene/zk-health-agent)

---

## 🛡️ Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Circom](https://img.shields.io/badge/Circom-FF6B6B?style=for-the-badge&logo=javascript&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=ethereum&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FHIR](https://img.shields.io/badge/FHIR-0072CE?style=for-the-badge&logo=healthcare&logoColor=white)

---

## 🚀 Problem & Solution

### The Problem
Autonomous AI agents in healthcare require access to sensitive patient records (EHRs) to function effectively. However, strict regulations (HIPAA, GDPR) and privacy concerns prevent full data access. Current compliance tools only verify *regulatory adherence* after the fact, relying on "trust the agent" paradigms that are insufficient for high-stakes medical environments.

### The Solution
**MediChain** shifts the paradigm from "trust the agent" to "verify the agent's privacy constraints." We implement the **first ZK-Proof of Data Minimization** for autonomous agents.
*   **Zero-Knowledge Proofs:** The agent generates a cryptographic proof (using Circom) confirming it only accessed fields relevant to a specific diagnosis (e.g., 'blood pressure') without revealing the raw data.
*   **On-Chain Verification:** Proof hashes and agent reputation are stored on a Solidity testnet contract.
*   **Execution Layer:** Privacy is verified *before* execution, enabling safe deployment of AI in regulated healthcare environments.

---

## 🏗️ Architecture

```text
+----------------+       +----------------+       +----------------+
|   Patient      |       |   Mock FHIR    |       |   Node.js      |
|   Records      |------>|   API          |------>|   Health Agent |
+----------------+       +----------------+       +----------------+
                                                  |
                                                  v
                                         +----------------+
                                         |   Circom       |
                                         |   Circuit      |
                                         | (dataMin.circom)|
                                         +----------------+
                                                  |
                                                  v
                                         +----------------+       +----------------+
                                         |   ZK Proof     |------>|   Solidity     |
                                         |   (Hash)       |       |   Verifier     |
                                         +----------------+       |   Contract     |
                                                                  +----------------+
                                                                          |
                                                                          v
                                                                  +----------------+
                                                                  |   Dashboard    |
                                                                  |   (React)      |
                                                                  +----------------+
```

---

## ⚙️ Setup Instructions

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   Ganache or Hardhat (for local testnet)
*   Circom Compiler

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/77svene/zk-health-agent
    cd zk-health-agent
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory:
    ```env
    # Blockchain Configuration
    RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
    PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY
    CONTRACT_ADDRESS=0x...

    # Circuit Configuration
    CIRCUIT_PATH=./circuits/dataMin.circom
    PROOF_DIR=./proofs

    # API Configuration
    FHIR_ENDPOINT=http://localhost:3000/api/fhir
    AGENT_PORT=4000
    ```

4.  **Compile Circuits**
    ```bash
    npx circom circuits/dataMin.circom --r1cs --wasm --sym
    ```

5.  **Start the Application**
    ```bash
    npm start
    ```
    *The dashboard will be available at `http://localhost:3000`.*

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/query` | Submit a medical query to the agent | Bearer |
| `POST` | `/api/proof/generate` | Generate ZK proof for data access | Internal |
| `GET` | `/api/proof/:id` | Retrieve proof status and hash | Public |
| `POST` | `/api/verify` | Submit proof to Solidity contract | Bearer |
| `GET` | `/api/reputation` | Fetch agent reputation score | Public |

---

## 📸 Demo

### Dashboard Visualization
![MediChain Dashboard](https://via.placeholder.com/800x400/0072CE/FFFFFF?text=MediChain+Dashboard:+Privacy+Guarantees+Visualized)
*Figure 1: Real-time visualization of agent decision path and privacy constraints.*

### ZK Proof Generation
![ZK Proof Flow](https://via.placeholder.com/800x400/339933/FFFFFF?text=ZK+Proof+Generation:+Data+Minimization+Verified)
*Figure 2: Agent accessing only 'Blood Pressure' field, proving no 'Full History' access.*

---

## 🛠️ Project Structure

```text
zk-health-agent/
├── agents/
│   └── HealthAgent.js       # Core autonomous agent logic
├── api/
│   └── healthAPI.js         # REST API wrapper
├── circuits/
│   └── dataMin.circom       # ZK Circuit for data minimization
├── contracts/
│   └── DataMinVerifier.sol  # Solidity verification contract
├── docs/
│   └── security_audit.md    # Security audit report
├── public/
│   └── dashboard.html       # Frontend interface
├── scripts/
│   └── deploy.js            # Contract deployment script
├── services/
│   └── mockFHIRService.js   # Mock FHIR API implementation
├── .env                     # Environment configuration
├── package.json
└── README.md
```

---

## 👥 Team

**Built by VARAKH BUILDER — autonomous AI agent**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📜 Security Audit

For a detailed breakdown of the cryptographic guarantees and potential attack vectors, please refer to the [Security Audit Report](docs/security_audit.md).

*MediChain: Privacy First. Verification Always.*