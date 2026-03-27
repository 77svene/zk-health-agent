const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Field schema must match agents/HealthAgent.js for consistency
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

// Diagnosis to field mapping must match agents/HealthAgent.js
const DIAGNOSIS_FIELD_MAP = {
  'hypertension': [FIELD_SCHEMA.BLOOD_PRESSURE, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.MEDICATION_LIST],
  'diabetes': [FIELD_SCHEMA.BLOOD_SUGAR, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.LAB_RESULTS],
  'hyperlipidemia': [FIELD_SCHEMA.CHOLESTEROL, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.MEDICATION_LIST],
  'asthma': [FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.VITAL_HISTORY, FIELD_SCHEMA.ALLERGY_LIST, FIELD_SCHEMA.MEDICATION_LIST],
  'anemia': [FIELD_SCHEMA.BLOOD_SUGAR, FIELD_SCHEMA.LAB_RESULTS, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.FAMILY_HISTORY],
  'default': [FIELD_SCHEMA.BLOOD_PRESSURE, FIELD_SCHEMA.HEART_RATE, FIELD_SCHEMA.WEIGHT, FIELD_SCHEMA.LAB_RESULTS]
};

// Synthetic data generators using cryptographic entropy
const SYNTHEtic_DATA_GENERATORS = {
  bloodPressure: () => {
    const systolic = 90 + crypto.randomInt(100);
    const diastolic = 60 + crypto.randomInt(40);
    return `${systolic}/${diastolic} mmHg`;
  },
  heartRate: () => `${crypto.randomInt(50, 120)} bpm`,
  bloodSugar: () => `${crypto.randomInt(70, 250)} mg/dL`,
  cholesterol: () => {
    const total = crypto.randomInt(120, 300);
    const hdl = crypto.randomInt(30, 80);
    const ldl = crypto.randomInt(50, 190);
    return { total, hdl, ldl, ratio: (total / hdl).toFixed(1) };
  },
  weight: () => `${(crypto.randomInt(100, 300) / 10).toFixed(1)} kg`,
  height: () => `${(crypto.randomInt(140, 220)).toFixed(0)} cm`,
  allergies: () => {
    const allTypes = ['Penicillin', 'Peanuts', 'Shellfish', 'Latex', 'Sulfa', 'Aspirin', 'Iodine', 'Codeine', 'Morphine', 'Eggs', 'Dairy', 'Soy', 'Wheat', 'Tree Nuts', 'Fish'];
    const count = crypto.randomInt(0, 4);
    const selected = [];
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, allTypes.length);
      if (!selected.includes(allTypes[idx])) selected.push(allTypes[idx]);
    }
    return selected;
  },
  medications: () => {
    const medTypes = ['Lisinopril', 'Metformin', 'Atorvastatin', 'Albuterol', 'Aspirin', 'Metoprolol', 'Omeprazole', 'Levothyroxine', 'Gabapentin', 'Sertraline'];
    const count = crypto.randomInt(0, 5);
    const selected = [];
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, medTypes.length);
      if (!selected.includes(medTypes[idx])) selected.push(medTypes[idx]);
    }
    return selected;
  },
  labResults: () => {
    const results = [];
    const testTypes = ['CBC', 'CMP', 'Lipid Panel', 'HbA1c', 'TSH', 'Vitamin D', 'B12', 'Iron'];
    const count = crypto.randomInt(1, 5);
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, testTypes.length);
      results.push({
        test: testTypes[idx],
        value: crypto.randomInt(50, 200),
        unit: 'mg/dL',
        referenceRange: '50-150 mg/dL',
        status: crypto.randomInt(0, 10) < 8 ? 'normal' : 'abnormal'
      });
    }
    return results;
  },
  vitalHistory: () => {
    const history = [];
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i + 1) * 7);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates.map(date => ({
      date,
      bloodPressure: SYNTHEtic_DATA_GENERATORS.bloodPressure(),
      heartRate: SYNTHEtic_DATA_GENERATORS.heartRate(),
      weight: SYNTHEtic_DATA_GENERATORS.weight()
    }));
  },
  familyHistory: () => {
    const conditions = ['Hypertension', 'Diabetes Type 2', 'Coronary Artery Disease', 'Stroke', 'Cancer', 'Asthma', 'Arthritis', 'Depression'];
    const count = crypto.randomInt(0, 4);
    const selected = [];
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, conditions.length);
      if (!selected.includes(conditions[idx])) selected.push(conditions[idx]);
    }
    return selected;
  },
  socialHistory: () => ({
    smoking: crypto.randomInt(0, 2) === 0 ? 'never' : (crypto.randomInt(0, 2) === 0 ? 'former' : 'current'),
    alcohol: crypto.randomInt(0, 3),
    exercise: crypto.randomInt(0, 7),
    occupation: ['Office Worker', 'Teacher', 'Engineer', 'Healthcare', 'Retail', 'Construction', 'Student', 'Retired'][crypto.randomInt(0, 8)]
  }),
  immunizationRecords: () => {
    const vaccines = ['Influenza', 'Tetanus', 'Hepatitis B', 'MMR', 'Pneumococcal', 'Shingles', 'HPV', 'COVID-19'];
    const count = crypto.randomInt(0, 6);
    const selected = [];
    for (let i = 0; i < count; i++) {
      const idx = crypto.randomInt(0, vaccines.length);
      if (!selected.includes(vaccines[idx])) {
        selected.push({
          vaccine: vaccines[idx],
          date: new Date(Date.now() - crypto.randomInt(365, 3650)).toISOString().split('T')[0],
          status: 'administered'
        });
      }
    }
    return selected;
  }
};

// Synthetic patient data store - no real PII, all synthetic
const PATIENT_STORE = new Map();

// Generate unique synthetic patient ID (HIPAA compliant - no real identifiers)
function generateSyntheticPatientId() {
  return `patient_${crypto.randomBytes(4).toString('hex')}`;
}

// Generate complete synthetic patient record with all fields
function generateCompletePatientRecord() {
  const patientId = generateSyntheticPatientId();
  const diagnosis = Object.keys(DIAGNOSIS_FIELD_MAP).filter(k => k !== 'default')[crypto.randomInt(0, 5)];
  
  return {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient']
    },
    identifier: [
      {
        system: 'http://hospital.example.org/patients',
        value: patientId,
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }] }
      }
    ],
    name: [
      {
        use: 'official',
        family: generateSyntheticName('family'),
        given: [generateSyntheticName('given')]
      }
    ],
    gender: crypto.randomInt(0, 2) === 0 ? 'male' : 'female',
    birthDate: `${crypto.randomInt(1940, 2005)}-${String(crypto.randomInt(1, 12)).padStart(2, '0')}-${String(crypto.randomInt(1, 28)).padStart(2, '0')}`,
    address: [
      {
        use: 'home',
        type: 'physical',
        line: [`${crypto.randomInt(1, 9999)} Synthetic Street`],
        city: 'Syntheticville',
        state: 'CA',
        postalCode: String(crypto.randomInt(90000, 99999)),
        country: 'US'
      }
    ],
    telecom: [
      { system: 'phone', value: `555-${String(crypto.randomInt(100, 999)).padStart(3, '0')}-${String(crypto.randomInt(1000, 9999)).padStart(4, '0')}` },
      { system: 'email', value: `${generateSyntheticName('given').toLowerCase()}@example.com` }
    ],
    extension: [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/patient-birthPlace',
        valueAddress: {
          city: 'Synthetic City',
          state: 'CA',
          country: 'US'
        }
      }
    ],
    generalPractitioner: [
      {
        reference: 'Practitioner/dr_' + crypto.randomBytes(4).toString('hex'),
        display: 'Dr. Synthetic Provider'
      }
    ],
    communication: [
      {
        language: {
          coding: [{ system: 'urn:ietf:bcp:47', code: 'en-US', display: 'English (United States)' }]
        },
        preferred: true
      }
    ],
    // Clinical data fields for FHIR resources
    clinicalData: {
      bloodPressure: SYNTHEtic_DATA_GENERATORS.bloodPressure(),
      heartRate: SYNTHEtic_DATA_GENERATORS.heartRate(),
      bloodSugar: SYNTHEtic_DATA_GENERATORS.bloodSugar(),
      cholesterol: SYNTHEtic_DATA_GENERATORS.cholesterol(),
      weight: SYNTHEtic_DATA_GENERATORS.weight(),
      height: SYNTHEtic_DATA_GENERATORS.height(),
      allergies: SYNTHEtic_DATA_GENERATORS.allergies(),
      medications: SYNTHEtic_DATA_GENERATORS.medications(),
      labResults: SYNTHEtic_DATA_GENERATORS.labResults(),
      vitalHistory: SYNTHEtic_DATA_GENERATORS.vitalHistory(),
      familyHistory: SYNTHEtic_DATA_GENERATORS.familyHistory(),
      socialHistory: SYNTHEtic_DATA_GENERATORS.socialHistory(),
      immunizationRecords: SYNTHEtic_DATA_GENERATORS.immunizationRecords(),
      diagnosisHistory: [
        {
          code: {
            system: 'http://snomed.info/sct',
            code: crypto.randomInt(100000, 999999),
            display: diagnosis.charAt(0).toUpperCase() + diagnosis.slice(1)
          },
          clinicalStatus: { coding: [{ code: 'active', display: 'Active' }] },
          verificationStatus: { coding: [{ code: 'confirmed', display: 'Confirmed' }] },
          onsetDateTime: new Date(Date.now() - crypto.randomInt(30, 1000) * 86400000).toISOString()
        }
      ]
    },
    // Audit trail for data access
    auditTrail: {
      accessLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

// Generate synthetic name (HIPAA compliant - no real names)
function generateSyntheticName(type) {
  const prefixes = ['Syn', 'Med', 'Health', 'Care', 'Well', 'Life', 'Bio', 'Gen', 'Medi', 'Cure'];
  const suffixes = ['son', 'son', 'son', 'son', 'son', 'son', 'son', 'son', 'son', 'son'];
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Parker', 'Reese'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  if (type === 'family') {
    return lastNames[crypto.randomInt(0, lastNames.length)];
  } else if (type === 'given') {
    return firstNames[crypto.randomInt(0, firstNames.length)];
  } else {
    return `${prefixes[crypto.randomInt(0, prefixes.length)]}${suffixes[crypto.randomInt(0, suffixes.length)]}`;
  }
}

// Generate synthetic diagnosis code
function generateDiagnosisCode() {
  const codes = {
    hypertension: '400.00',
    diabetes: '250.00',
    hyperlipidemia: '272.00',
    asthma: '493.90',
    anemia: '285.90'
  };
  return codes[Object.keys(codes)[crypto.randomInt(0, Object.keys(codes).length)]];
}

// Initialize mock FHIR store with synthetic patients
function initializeMockStore(numPatients = 10) {
  const patients = [];
  for (let i = 0; i < numPatients; i++) {
    const patient = generateCompletePatientRecord();
    PATIENT_STORE.set(patient.id, patient);
    patients.push(patient);
  }
  return patients;
}

// Get patient record by ID
function getPatientRecord(patientId) {
  const patient = PATIENT_STORE.get(patientId);
  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }
  return patient;
}

// Query patient record with field-level access control (data minimization)
function queryPatientRecord(patientId, fieldMask, diagnosis = null) {
  const patient = PATIENT_STORE.get(patientId);
  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }
  
  // Determine which fields are minimally necessary for the diagnosis
  const requiredFields = diagnosis && DIAGNOSIS_FIELD_MAP[diagnosis] 
    ? DIAGNOSIS_FIELD_MAP[diagnosis] 
    : DIAGNOSIS_FIELD_MAP['default'];
  
  // Apply field-level access control - only return requested fields
  const filteredRecord = {
    resourceType: patient.resourceType,
    id: patient.id,
    meta: patient.meta,
    identifier: patient.identifier,
    name: patient.name,
    gender: patient.gender,
    birthDate: patient.birthDate,
    address: patient.address,
    telecom: patient.telecom,
    clinicalData: {}
  };
  
  // Map field schema to actual data fields
  const fieldMap = {
    [FIELD_SCHEMA.BLOOD_PRESSURE]: 'bloodPressure',
    [FIELD_SCHEMA.HEART_RATE]: 'heartRate',
    [FIELD_SCHEMA.BLOOD_SUGAR]: 'bloodSugar',
    [FIELD_SCHEMA.CHOLESTEROL]: 'cholesterol',
    [FIELD_SCHEMA.WEIGHT]: 'weight',
    [FIELD_SCHEMA.HEIGHT]: 'height',
    [FIELD_SCHEMA.ALLERGY_LIST]: 'allergies',
    [FIELD_SCHEMA.MEDICATION_LIST]: 'medications',
    [FIELD_SCHEMA.LAB_RESULTS]: 'labResults',
    [FIELD_SCHEMA.VITAL_HISTORY]: 'vitalHistory',
    [FIELD_SCHEMA.FAMILY_HISTORY]: 'familyHistory',
    [FIELD_SCHEMA.SOCIAL_HISTORY]: 'socialHistory',
    [FIELD_SCHEMA.IMMUNIZATION_RECORDS]: 'immunizationRecords',
    [FIELD_SCHEMA.DIAGNOSIS_HISTORY]: 'diagnosisHistory'
  };
  
  // Only include fields that are in the query mask AND are minimally necessary
  for (let i = 0; i < fieldMask.length; i++) {
    if (fieldMask[i] === 1 && requiredFields.includes(i)) {
      const fieldName = fieldMap[i];
      if (fieldName && patient.clinicalData[fieldName] !== undefined) {
        filteredRecord.clinicalData[fieldName] = patient.clinicalData[fieldName];
      }
    }
  }
  
  // Add audit trail entry
  filteredRecord.auditTrail = {
    ...patient.auditTrail,
    accessLog: [
      ...patient.auditTrail.accessLog,
      {
        timestamp: new Date().toISOString(),
        fieldsAccessed: fieldMask.map((bit, idx) => bit === 1 ? FIELD_SCHEMA[idx] : null).filter(Boolean),
        diagnosis: diagnosis || 'default',
        accessType: 'query'
      }
    ]
  };
  
  return filteredRecord;
}

// Generate ZK proof inputs from query
function generateProofInputs(patientId, fieldMask, diagnosis = null) {
  const patient = PATIENT_STORE.get(patientId);
  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }
  
  // Determine required fields for diagnosis
  const requiredFields = diagnosis && DIAGNOSIS_FIELD_MAP[diagnosis] 
    ? DIAGNOSIS_FIELD_MAP[diagnosis] 
    : DIAGNOSIS_FIELD_MAP['default'];
  
  // Create record mask (all fields that exist in patient record)
  const recordMask = new Array(15).fill(0);
  const fieldMap = {
    [FIELD_SCHEMA.BLOOD_PRESSURE]: 'bloodPressure',
    [FIELD_SCHEMA.HEART_RATE]: 'heartRate',
    [FIELD_SCHEMA.BLOOD_SUGAR]: 'bloodSugar',
    [FIELD_SCHEMA.CHOLESTEROL]: 'cholesterol',
    [FIELD_SCHEMA.WEIGHT]: 'weight',
    [FIELD_SCHEMA.HEIGHT]: 'height',
    [FIELD_SCHEMA.ALLERGY_LIST]: 'allergies',
    [FIELD_SCHEMA.MEDICATION_LIST]: 'medications',
    [FIELD_SCHEMA.LAB_RESULTS]: 'labResults',
    [FIELD_SCHEMA.VITAL_HISTORY]: 'vitalHistory',
    [FIELD_SCHEMA.FAMILY_HISTORY]: 'familyHistory',
    [FIELD_SCHEMA.SOCIAL_HISTORY]: 'socialHistory',
    [FIELD_SCHEMA.IMMUNIZATION_RECORDS]: 'immunizationRecords',
    [FIELD_SCHEMA.DIAGNOSIS_HISTORY]: 'diagnosisHistory'
  };
  
  for (let i = 0; i < 15; i++) {
    const fieldName = fieldMap[i];
    if (fieldName && patient.clinicalData[fieldName] !== undefined) {
      recordMask[i] = 1;
    }
  }
  
  // Calculate budget (number of fields accessed)
  const budget = fieldMask.reduce((sum, bit) => sum + bit, 0);
  
  return {
    queryMask: fieldMask,
    recordMask: recordMask,
    budget: budget,
    diagnosis: diagnosis || 'default',
    patientId: patientId,
    timestamp: new Date().toISOString()
  };
}

// Validate proof inputs against data minimization constraints
function validateProofInputs(proofInputs) {
  const { queryMask, recordMask, budget, diagnosis } = proofInputs;
  
  // Check budget constraint
  if (budget > 5) {
    return {
      valid: false,
      reason: 'Budget exceeded: accessed more than 5 fields'
    };
  }
  
  // Check subset constraint (query must be subset of record)
  for (let i = 0; i < queryMask.length; i++) {
    if (queryMask[i] === 1 && recordMask[i] === 0) {
      return {
        valid: false,
        reason: `Field ${i} queried but not present in record`
      };
    }
  }
  
  // Check diagnosis-specific minimization
  const requiredFields = DIAGNOSIS_FIELD_MAP[diagnosis] || DIAGNOSIS_FIELD_MAP['default'];
  const queriedFields = queryMask.map((bit, idx) => bit === 1 ? idx : null).filter(Boolean);
  
  // All queried fields must be in required fields for diagnosis
  const allRequired = queriedFields.every(field => requiredFields.includes(field));
  
  return {
    valid: allRequired,
    reason: allRequired ? 'Data minimization constraints satisfied' : 'Queried fields exceed diagnosis requirements',
    requiredFields,
    queriedFields
  };
}

// Get all patients (for testing)
function getAllPatients() {
  return Array.from(PATIENT_STORE.values());
}

// Get patient count
function getPatientCount() {
  return PATIENT_STORE.size;
}

// Clear mock store (for testing)
function clearMockStore() {
  PATIENT_STORE.clear();
}

// Export module
module.exports = {
  FIELD_SCHEMA,
  DIAGNOSIS_FIELD_MAP,
  generateSyntheticPatientId,
  generateCompletePatientRecord,
  generateDiagnosisCode,
  initializeMockStore,
  getPatientRecord,
  queryPatientRecord,
  generateProofInputs,
  validateProofInputs,
  getAllPatients,
  getPatientCount,
  clearMockStore
};