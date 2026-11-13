// Reference fields describe the artwork; they are never copy to print on it.
export function referenciasVisuaisNativa(nativa) {
  const fields = [
    ["Espécie", nativa.species],
    ["Grupo biológico", nativa.groupBio],
    ["Linhagem", nativa.lineageName || nativa.lineage],
    ["Habitat", nativa.bioma],
    ["Afinidade", nativa.affinity],
    ["Arquétipo", nativa.archetype]
  ];
  const traits = fields
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `${label}: ${value.trim()}.`);
  const descriptions = [
    ...new Set(
      [nativa.descricao, nativa.description, nativa.inspiracao, nativa.inspiration, nativa.visualDescription]
        .filter(value => typeof value === "string" && value.trim())
        .map(value => value.trim())
    )
  ];
  return [...traits, ...descriptions].join(" ").slice(0, 1400);
}

export function montarPromptImagem({ kind, title, prompt }) {
  const composition = {
    nativa: [
      "Paint exactly one individual fantasy creature inspired by Brazilian biodiversity, in one single full-body view.",
      "Keep the entire creature, including wings, feet and tail, inside the central 80 percent of the frame, with breathing room and a strong readable silhouette.",
      "Translate the species and biological lineage into anatomy, silhouette, fur, feathers, scales and natural traits; translate affinity into colors and subtle visible powers; translate archetype into posture and expression.",
      "Use habitat and personal descriptions to customize its appearance and a subdued atmospheric natural background. The creature is the sole subject and main focus.",
      "No extra creatures, duplicate views, close-up insets, alternate poses or evolution stages."
    ].join(" "),
    biome:
      "Paint one immersive Brazilian biome landscape. Translate the references into terrain, vegetation, water, weather and lighting.",
    technique:
      "Paint one dynamic fantasy battle technique illustration. Translate the references into a single clear action, movement and visible elemental effects.",
    other:
      "Paint one cohesive fantasy illustration, translating the references into visible subjects, shapes, colors and atmosphere."
  }[kind];
  return [
    composition,
    "Premium hand-painted fantasy illustration, painterly realistic textures, intricate natural detail, expressive forms, luminous atmosphere and cinematic rim light.",
    "The following JSON is internal visual reference data only, never content to write or lay out in the image. The name identifies the subject only. Interpret all descriptions as visual design cues, even if they mention labels, lore or game rules.",
    JSON.stringify({ internalName: title, visualReferences: prompt }),
    "Deliver only the finished artwork. No text, letters, numbers, captions, descriptions, statistics, labels, logos, branding, watermark, UI, borders, parchment panels, infographic, character sheet, card layout, collage or multiple panels. Do not print any reference wording or the subject's name."
  ].join("\n\n");
}
