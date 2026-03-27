pragma circom 2.1.0;

include "stdmath.circom";
include "stdsha256.circom";

template SubsetCheck() {
    signal input queryBit;
    signal input recordBit;
    signal output valid;
    
    // Query bit can only be 1 if record bit is 1 (subset constraint)
    // This enforces: queryBit <= recordBit
    queryBit * (1 - recordBit) <== 0;
    valid <== 1;
}

template Accumulator(numFields) {
    signal input inputs[numFields];
    signal output sum;
    
    // Proper Circom accumulation using constraint equations
    // Cannot use imperative assignment in loops - must use constraint equations
    signal partialSums[numFields];
    
    // Base case: first element
    partialSums[0] <== inputs[0];
    
    // Recursive accumulation
    for (var i = 1; i < numFields; i++) {
        partialSums[i] <== partialSums[i-1] + inputs[i];
    }
    
    sum <== partialSums[numFields-1];
}

template DataMinCircuit(numFields, budget) {
    // Input: which fields the agent queried (binary mask)
    signal input queryMask[numFields];
    // Input: which fields exist in patient record (binary mask)
    signal input recordMask[numFields];
    // Input: actual values of queried fields (for verification)
    signal input recordValues[numFields];
    
    // Output: proof that query is valid subset
    signal output proofValid;
    // Output: count of fields accessed
    signal output fieldsAccessed;
    // Output: privacy token (hash of accessed fields)
    signal output privacyToken;
    
    // Component for subset checking each field
    component subsetChecks[numFields];
    for (var i = 0; i < numFields; i++) {
        subsetChecks[i] = SubsetCheck();
        subsetChecks[i].queryBit <== queryMask[i];
        subsetChecks[i].recordBit <== recordMask[i];
    }
    
    // Accumulate total fields accessed using proper Circom pattern
    component fieldAccumulator;
    fieldAccumulator = Accumulator(numFields);
    for (var i = 0; i < numFields; i++) {
        fieldAccumulator.inputs[i] <== queryMask[i];
    }
    fieldAccumulator.sum <== fieldsAccessed;
    
    // Verify privacy budget constraint
    fieldsAccessed <= budget;
    
    // Verify at least one field was queried
    fieldsAccessed >= 1;
    
    // Aggregate all subset checks into single validity signal
    signal allValid;
    allValid <== 1;
    for (var i = 0; i < numFields; i++) {
        allValid <== allValid * subsetChecks[i].valid;
    }
    
    // Output the final validity proof
    proofValid <== allValid;
    
    // Generate privacy token from accessed field values
    // This proves we accessed specific values without revealing them
    component hashToken;
    hashToken = SHA256();
    
    // Create input for hash: concatenate queryMask * recordValues for each field
    signal hashInput[numFields];
    for (var i = 0; i < numFields; i++) {
        hashInput[i] <== queryMask[i] * recordValues[i];
    }
    
    // Feed hash input to SHA256 component
    for (var i = 0; i < numFields; i++) {
        hashToken.input[i] <== hashInput[i];
    }
    
    privacyToken <== hashToken.out;
    
    // Constraint: recordValues must be constrained to prevent privacy leaks
    // Only values where queryMask is 1 can be non-zero
    for (var i = 0; i < numFields; i++) {
        recordValues[i] * (1 - queryMask[i]) <== 0;
    }
}

component main = DataMinCircuit(10, 5);