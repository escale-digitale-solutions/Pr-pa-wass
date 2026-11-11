import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

/** Qualité « Haute » : occlusion ambiante et halo des sources lumineuses, en plus du rendu direct. */
export default function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        ref={(pass: { autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } } | null) => {
          // les halos et ombres « peints » sont des surfaces transparentes : sans ce réglage,
          // l'occlusion s'interromprait net à leur bord
          if (!pass) return
          pass.autoDetectTransparency = false
          pass.configuration.transparencyAware = false
        }}
        aoRadius={0.9}
        distanceFalloff={0.7}
        intensity={2}
        aoSamples={16}
        denoiseSamples={8}
        denoiseRadius={10}
        color="#1c140c"
      />
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.32} radius={0.72} />
      <SMAA />
      <Vignette offset={0.22} darkness={0.32} />
    </EffectComposer>
  )
}
