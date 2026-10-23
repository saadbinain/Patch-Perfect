/**
 * Mock AI Engine simulating the 4 Deep Learning Models from Chapter III:
 * 1. ResNet50: Wound matching / Patient similarity check
 * 2. FUSegNet: Wound boundary segmentation & localization
 * 3. VGG16: Wound type classification (Diabetic / Pressure / Venous / Surgical)
 * 4. FPN + VGG16: Tissue segmentation (granulation, slough, necrotic) & Severity Scoring (1 to 5)
 */

export const simulateAIAnalysis = async (imageDataUrl, selectedPatient, selectedWoundId = null) => {
  // Simulate network & AI inference latency
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Determine realistic diagnostic output based on image dimensions/features and patient context
  const woundTypes = [
    { type: "Diabetic Ulcer", location: "Plantar Foot / Heel", defaultSev: 4 },
    { type: "Surgical Wound", location: "Surgical Incision Site", defaultSev: 3 },
    { type: "Pressure Injury", location: "Sacral Area", defaultSev: 3 },
    { type: "Venous Ulcer", location: "Medial Malleolus", defaultSev: 3 },
  ];

  let selectedType = woundTypes[1]; // Surgical Wound

  // Inspect actual image aspect ratio
  let aspect = 1.0;
  if (imageDataUrl && typeof window !== "undefined") {
    try {
      const img = new window.Image();
      img.src = imageDataUrl;
      if (img.complete && img.naturalWidth > 0) {
        aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      } else {
        await new Promise((res) => {
          img.onload = () => {
            aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
            res();
          };
          img.onerror = () => res();
        });
      }
    } catch (e) {}
  }

  // 1. Anatomical location cues (if specified)
  if (selectedPatient?.anatomicalLocation) {
    const loc = selectedPatient.anatomicalLocation.toLowerCase();
    if (loc.includes("sacrum") || loc.includes("coccyx") || loc.includes("buttock") || loc.includes("pressure") || loc.includes("hip")) {
      selectedType = woundTypes[2]; // Pressure Injury
    } else if (loc.includes("ankle") || loc.includes("malleolus") || loc.includes("leg") || loc.includes("calf") || loc.includes("venous") || loc.includes("gaiter")) {
      selectedType = woundTypes[3]; // Venous Ulcer
    } else if (loc.includes("foot") || loc.includes("plantar") || loc.includes("toe") || loc.includes("heel") || loc.includes("sole")) {
      selectedType = woundTypes[0]; // Diabetic Ulcer
    } else if (loc.includes("abdomen") || loc.includes("incision") || loc.includes("midline") || loc.includes("surgical") || loc.includes("suture") || loc.includes("staple")) {
      selectedType = woundTypes[1]; // Surgical Wound
    } else {
      selectedType = woundTypes[0]; // Diabetic Ulcer
    }
  } else {
    selectedType = woundTypes[0]; // Diabetic Ulcer
  }

  // Tissue distribution breakdown
  const tissueOptions = [
    { granulation: 65, slough: 25, necrotic: 10 },
    { granulation: 50, slough: 35, necrotic: 15 },
    { granulation: 75, slough: 20, necrotic: 5 },
    { granulation: 40, slough: 40, necrotic: 20 },
    { granulation: 55, slough: 30, necrotic: 15 },
  ];
  const tissueStats = tissueOptions[Math.floor(Math.random() * tissueOptions.length)];

  // Severity Level assignment
  const severityScore = Math.floor(Math.random() * 5) + 1; // 1 to 5
  const severityLabels = {
    1: "Minimal",
    2: "Mild",
    3: "Moderate",
    4: "Severe",
    5: "Critical",
  };

  const healingStatuses = severityScore <= 2 ? "Improving" : severityScore === 3 ? "Stable" : "Action Needed";

  const recommendations = {
    1: "Excellent granulation progression. Continue hydrocolloid secondary dressing and weekly checks.",
    2: "Wound bed stable. Maintain foam barrier protection and keep dry during hygiene routines.",
    3: "Moderate exudate noted. Recommend silver alginate dressing change every 48 hours.",
    4: "Elevated slough and periwound maceration detected. Prompt sharp debridement and pressure offloading recommended.",
    5: "Critical tissue necrosis and spreading erythema. Urgent surgical consult and systemic antibiotic review required.",
  };

  // Resolve targeted wound profile and its specific prior scans
  let targetWound = null;
  if (selectedWoundId && selectedPatient?.wounds) {
    targetWound = selectedPatient.wounds.find((w) => w.id === selectedWoundId);
  }
  if (!targetWound && selectedPatient?.wounds && selectedPatient.wounds.length > 0) {
    targetWound = selectedPatient.wounds[0];
  }

  const priorScans = (targetWound?.scans && targetWound.scans.length > 0)
    ? targetWound.scans
    : (selectedPatient?.wounds?.length ? [] : (selectedPatient?.scans || []));
  const hasPriorScans = priorScans.length > 0;
  const woundName = targetWound?.label || targetWound?.anatomical_location || targetWound?.anatomicalLocation || "Wound";

  let similarityResult = {
    model: "ResNet50",
    isBaseline: true,
    isSameWound: true,
    confidence: "100.0%",
    similarityScore: 1.0,
    status: `Day 1 Baseline Scan Established for ${woundName}`,
    warning: null,
  };

  if (hasPriorScans) {
    const baselineImage = priorScans[0].image || priorScans[0].image_base64 || "";
    let isSame = true;
    let simPct = 88.5;

    if (baselineImage && imageDataUrl) {
      if (baselineImage === imageDataUrl) {
        simPct = 100.0;
        isSame = true;
      } else {
        const lenDiff = Math.abs((imageDataUrl?.length || 0) - (baselineImage?.length || 0));
        const relDiff = lenDiff / Math.max(1, (baselineImage?.length || 1));
        
        if (relDiff > 0.38) {
          simPct = Math.max(31.2, Math.min(62.5, Math.round((1 - relDiff * 0.7) * 1000) / 10));
          isSame = simPct >= 65.0;
        } else {
          simPct = 88.5;
          isSame = true;
        }
      }
    }

    similarityResult = {
      model: "ResNet50",
      isBaseline: false,
      isSameWound: isSame,
      similarityScore: simPct / 100.0,
      confidence: `${simPct}%`,
      status: isSame ? `Day 1 Baseline Match Confirmed (${simPct}%)` : `⚠️ WOUND MISMATCH DETECTED (${simPct}%)`,
      warning: isSame ? null : `Visual similarity with Day 1 baseline scan of ${woundName} is only ${simPct}% (below 65% threshold). This appears to be a different wound.`,
    };
  }

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
      similarityCheck: similarityResult,
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
        sloughPercent: severityScore <= 2 ? 15 : severityScore === 3 ? 35 : 50,
        necroticPercent: severityScore <= 2 ? 7 : severityScore === 3 ? 15 : 25,
      },
    },
  };
};
