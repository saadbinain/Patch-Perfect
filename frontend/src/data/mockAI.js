/**
 * Mock AI Engine simulating the 4 Deep Learning Models from Chapter III:
 * 1. ResNet50: Wound matching / Patient similarity check
 * 2. FUSegNet: Wound boundary segmentation & localization
 * 3. VGG16: Wound type classification (Diabetic / Pressure / Venous / Surgical)
 * 4. FPN + VGG16: Tissue segmentation (granulation, slough, necrotic) & Severity Scoring (1 to 5)
 */

export const simulateAIAnalysis = async (imageDataUrl, selectedPatient) => {
  // Simulate network & AI inference latency
  await new Promise((resolve) => setTimeout(resolve, 2200));

  // Determine realistic diagnostic output based on patient context or random medical heuristics
  const woundTypes = [
    { type: "Diabetic Ulcer", location: "Left Foot / Plantar", defaultSev: 4 },
    { type: "Surgical Wound", location: "Abdominal Incision", defaultSev: 2 },
    { type: "Pressure Injury", location: "Sacral Area", defaultSev: 3 },
    { type: "Venous Ulcer", location: "Medial Malleolus", defaultSev: 3 },
  ];

  let selectedType = woundTypes[0];
  if (selectedPatient) {
    const matched = woundTypes.find(
      (w) => selectedPatient.woundType.toLowerCase().includes(w.type.split(" ")[0].toLowerCase())
    );
    if (matched) selectedType = matched;
  }

  // Randomize severity score slightly or use patient baseline
  const severityScore = selectedPatient
    ? Math.min(5, Math.max(1, selectedPatient.currentSeverity + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0)))
    : 3;

  const severityLabels = {
    1: "Mild",
    2: "Mild-Moderate",
    3: "Moderate",
    4: "Very Severe",
    5: "Critical",
  };

  const healingStatuses = severityScore <= 2 ? "Improving" : severityScore === 3 ? "Stable" : "Deteriorating";

  const recommendations = {
    1: "Favorable re-epithelialization observed. Continue protective dressing and weekly check-up.",
    2: "Healthy pink granulation tissue present. Clean gently with sterile 0.9% saline and apply non-adherent dressing.",
    3: "Daily monitoring advised. Clean wound periphery with sterile saline solution. Schedule follow-up within 48 hours.",
    4: "Elevated slough and periwound maceration detected. Prompt sharp debridement and pressure offloading recommended.",
    5: "Critical tissue necrosis and spreading erythema. Urgent surgical consult and systemic antibiotic review required.",
  };

  return {
    id: `scan-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " Today",
    severityScore,
    severityLevel: severityLabels[severityScore],
    woundType: selectedType.type,
    location: selectedType.location,
    healingStatus: healingStatuses,
    recommendation: recommendations[severityScore],
    pipelineResults: {
      similarityCheck: {
        model: "ResNet50",
        confidence: "98.4%",
        status: "Matched with existing patient history",
      },
      segmentation: {
        model: "FUSegNet",
        iouScore: "0.912",
        boundaryAreaMm2: 342.5,
      },
      classification: {
        model: "VGG16",
        predictedType: selectedType.type,
        accuracy: "95.8%",
      },
      tissueAnalysis: {
        model: "FPN + VGG16",
        granulationPercent: severityScore <= 2 ? 78 : severityScore === 3 ? 50 : 25,
        sloughPercent: severityScore <= 2 ? 18 : severityScore === 3 ? 35 : 55,
        necroticPercent: severityScore <= 2 ? 4 : severityScore === 3 ? 15 : 20,
      },
    },
  };
};
