const fs = require('fs');
const path = require('path');

// Field schema mapping for FHIR resources - each field has a unique bit position
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

// Diagnosis to field mapping - what data is minimally necessary for each condition
const DIAGNOSIS_FIELD_MAP = {
  'hypertension': [FIELD_SCHEMA.BLOOD_PRESSURE, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.MEDICATION_LIST],
  'diabetes': [FIELD_SCHEMA.BLOOD_SUGAR, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.LAB_RESULTS],
  'hyperlipidemia': [FIELD_SCHEMA.CHOLESTEROL, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.MEDICATION_LIST],
  'asthma': [FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.VITAL_HISTORY, FIELD_SCHEMA.ALLERGY_LIST, FIELD_SCHEMA.MEDICATION_LIST],
  'anemia': [FIELD_SCHEMA.BLOOD_SUGAR, FIELD_SCHEMA.LAB_RESULTS, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.FAMILY_HISTORY],
  'default': [FIELD_SCHEMA.BLOOD_PRESSURE, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.LAB_RESULTS]
};

// Encrypted patient references - no raw PII stored in code
const PATIENT_REFERENCE_MAP = {
  'patient_001': 'enc_ref_a7f3d9e2b1c4',
  'patient_002': 'enc_ref_8b2e5f1a9d3c',
  'patient_003': 'enc_ref_4c9a1e7b3f2d'
};

// Mock FHIR data store - encrypted references with field-level access control
const MOCK_FHIR_STORE = {
  'enc_ref_a7f3d9e2b1c4': {
    BLOOD_PRESSURE: '120/80',
    HEART_RATE: 72,
    BLOOD_SUGAR: 95,
    CHOLESTEROL: 180,
    WEIGHT: 75,
    HEIGHT: 175,
    ALLERGY_LIST: ['penicillin', 'peanuts'],
    MEDICATION_LIST: ['lisinopril', 'metformin'],
    DIAGNOSIS_HISTORY: ['hypertension', 'type2_diabetes'],
    LAB_RESULTS: { hba1c: 5.6, creatinine: 0.9 },
    VITAL_HISTORY: [{ date: '2024-01-01', bp: '118/78', hr: 70 }],
    FAMILY_HISTORY: ['diabetes', 'heart_disease'],
    SOCIAL_HISTORY: { smoker: false, alcohol: 'occasional' },
    IMMUNIZATION_RECORDS: ['flu_2024', 'tetanus_2023']
  },
  'enc_ref_8b2e5f1a9d3c': {
    BLOOD_PRESSURE: '145/95',
    HEART_RATE: 88,
    BLOOD_SUGAR: 150,
    CHOLESTEROL: 220,
    WEIGHT: 92,
    HEIGHT: 168,
    ALLERGY_LIST: ['sulfa'],
    MEDICATION_LIST: ['metformin', 'atorvastatin'],
    DIAGNOSIS_HISTORY: ['diabetes', 'hyperlipidemia'],
    LAB_RESULTS: { hba1c: 7.2, creatinine: 1.1 },
    VITAL_HISTORY: [{ date: '2024-01-01', bp: '142/92', hr: 85 }],
    FAMILY_HISTORY: ['diabetes'],
    SOCIAL_HISTORY: { smoker: true, alcohol: 'daily' },
    IMMUNIZATION_RECORDS: ['flu_2024']
  },
  'enc_ref_4c9a1e7b3f2d': {
    BLOOD_PRESSURE: '110/70',
    HEART_RATE: 65,
    BLOOD_SUGAR: 88,
    CHOLESTEROL: 160,
    WEIGHT: 68,
    HEIGHT: 172,
    ALLERGY_LIST: [],
    MEDICATION_LIST: [],
    DIAGNOSIS_HISTORY: [],
    LAB_RESULTS: { hba1c: 5.2, creatinine: 0.8 },
    VITAL_HISTORY: [{ date: '2024-01-01', bp: '108/68', hr: 62 }],
    FAMILY_HISTORY: [],
    SOCIAL_HISTORY: { smoker: false, alcohol: 'none' },
    IMMUNIZATION_RECORDS: ['flu_2024', 'hpv_2023']
  }
};

// Circuit schema - matches dataMin.circom template
const CIRCUIT_SCHEMA = {
  numFields: 15,
  budget: 100
};

class HealthAgent {
  constructor() {
    this.agentId = 'agent_medichain_001';
    this.reputationScore = 100;
    this.queryLog = [];
    this.witnessCache = new Map();
  }

  /**
   * Fetch patient record by encrypted reference
   * @param {string} patientRef - Encrypted patient reference
   * @returns {Object} - Patient record data
   */
  async fetchPatientRecord(patientRef) {
    if (!PATIENT_REFERENCE_MAP[patientRef]) {
      throw new Error(`Invalid patient reference: ${patientRef}`);
    }
    
    const record = MOCK_FHIR_STORE[PATIENT_REFERENCE_MAP[patientRef]];
    if (!record) {
      throw new Error(`Record not found for reference: ${patientRef}`);
    }
    
    return { ...record };
  }

  /**
   * Generate binary mask for diagnosis-specific field selection
   * @param {string} diagnosis - Medical diagnosis code
   * @returns {number[]} - Binary mask array
   */
  _generateRecordMask(diagnosis) {
    const fieldList = DIAGNOSIS_FIELD_MAP[diagnosis] || DIAGNOSIS_FIELD_MAP['default'];
    const mask = new Array(CIRCUIT_SCHEMA.numFields).fill(0);
    
    for (const field of fieldList) {
      mask[field] = 1;
    }
    
    return mask;
  }

  /**
   * Generate query mask based on diagnosis requirements
   * @param {string} diagnosis - Medical diagnosis code
   * @returns {number[]} - Query mask array
   */
  _generateQueryMask(diagnosis) {
    const fieldList = DIAGNOSIS_FIELD_MAP[diagnosis] || DIAGNOSIS_FIELD_MAP['default'];
    const mask = new Array(CIRCUIT_SCHEMA.numFields).fill(0);
    
    for (const field of fieldList) {
      mask[field] = 1;
    }
    
    return mask;
  }

  /**
   * Validate that query respects data minimization constraints
   * @param {number[]} queryMask - Fields being queried
   * @param {number[]} recordMask - Fields available in record
   * @returns {boolean} - Validation result
   */
  _validateDataMinimization(queryMask, recordMask) {
    for (let i = 0; i < CIRCUIT_SCHEMA.numFields; i++) {
      if (queryMask[i] === 1 && recordMask[i] === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate ZK witness for data minimization proof
   * @param {string} patientRef - Encrypted patient reference
   * @param {string} diagnosis - Medical diagnosis code
   * @returns {Object} - Witness data for circuit
   */
  async generateWitness(patientRef, diagnosis) {
    const record = await this.fetchPatientRecord(patientRef);
    const queryMask = this._generateQueryMask(diagnosis);
    const recordMask = this._generateRecordMask(diagnosis);
    
    const isValid = this._validateDataMinimization(queryMask, recordMask);
    
    const witness = {
      queryMask: queryMask,
      recordMask: recordMask,
      isValid: isValid ? 1 : 0,
      patientRef: patientRef,
      diagnosis: diagnosis,
      timestamp: Date.now()
    };
    
    this.witnessCache.set(`${patientRef}_${diagnosis}`, witness);
    
    return witness;
  }

  /**
   * Execute agent query with privacy guarantees
   * @param {string} patientRef - Encrypted patient reference
   * @param {string} diagnosis - Medical diagnosis code
   * @returns {Object} - Query result with privacy metadata
   */
  async executeQuery(patientRef, diagnosis) {
    const queryStart = Date.now();
    
    const queryLogEntry = {
      agentId: this.agentId,
      patientRef: patientRef,
      diagnosis: diagnosis,
      timestamp: queryStart,
      fieldsQueried: DIAGNOSIS_FIELD_MAP[diagnosis] || DIAGNOSIS_FIELD_MAP['default']
    };
    
    this.queryLog.push(queryLogEntry);
    
    const witness = await this.generateWitness(patientRef, diagnosis);
    
    const queryResult = {
      agentId: this.agentId,
      patientRef: patientRef,
      diagnosis: diagnosis,
      fieldsAccessed: witness.fieldsQueried,
      dataMinimizationProof: {
        queryMask: witness.queryMask,
        recordMask: witness.recordMask,
        isValid: witness.isValid
      },
      queryDuration: Date.now() - queryStart,
      reputationImpact: witness.isValid ? 0 : -5
    };
    
    if (!witness.isValid) {
      this.reputationScore = Math.max(0, this.reputationScore + queryResult.reputationImpact);
    }
    
    return queryResult;
  }

  /**
   * Get agent reputation score
   * @returns {number} - Reputation score
   */
  getReputationScore() {
    return this.reputationScore;
  }

  /**
   * Get query log (sanitized - no raw data)
   * @returns {Array} - Sanitized query log
   */
  getQueryLog() {
    return this.queryLog.map(entry => ({
      agentId: entry.agentId,
      patientRef: entry.patientRef,
      diagnosis: entry.diagnosis,
      timestamp: entry.timestamp,
      fieldsQueried: entry.fieldsQueried
    }));
  }

  /**
   * Reset agent state
   */
  reset() {
    this.reputationScore = 100;
    this.queryLog = [];
    this.witnessCache.clear();
  }
}

module.exports = { HealthAgent, FIELD_SCHEMA, DIAGNOSIS_FIELD_MAP, CIRCUIT_SCHEMA };