// Historical managed-asset fingerprints observed locally from v0.5.2,
// v0.5.4 and the protected 0.5.4 source baseline. No source-tree runtime dependency.
// User/project attractors are deliberately excluded from overwrite authority.
export const CODUMENT_LEGACY_MANAGED_FINGERPRINTS: Readonly<Record<string, readonly string[]>> = {
  "codument/README.md": ["sha256:f4d57e73076bd36e1d76e7f592cee9f77576bdec898b1dc857133e9c241e828a"],
  // Exact committed-source bytes at bba44a1ac23c, independently matched to the
  // dogfood copy. These are std templates, not project-owned codument/attractors.
  "codument/std/attractors/knowledge-tiers.md": ["sha256:c7d3bf985405847d8a7f673eb73ff46f8d9341e09a2e7fd3fe652a7e13f88f13"],
  "codument/std/attractors/model-driven-docs.md": ["sha256:687fe73f31395d578d8b88cb19300b30809d507952fe6e45af546583a4406dc2"],
  "codument/std/attractors/depa-attractor.md": ["sha256:2c73b3a0e963cb9673a713bdcceb3834338cd844fa5f73f1c2c693be44562b92"],
  "codument/manifest.xnl": [
    "sha256:832da4581f05ae47b017fcfd5d623bb4182a1ecb8bf72be26746103cd49795fe"
  ],
  "codument/std/AGENTS.md": [
    "sha256:3f9571f426e3f4c1ce7e1a0f32476c101fef054917b5e19dfd352b2cad734787",
    "sha256:e29b386fa33151f1b4ffe3a5dda7cf41ffc8bae0af91c2cdc20285e9633d4af6"
  ],
  "codument/std/commands/archive-track.md": [
    "sha256:2feee4df1dedc8ca8117cc8dd7d8dd76fc63a08a5a8ae7fdfdcb8b398c1266fd"
  ],
  "codument/std/commands/modeling-engineering.md": [
    "sha256:c5b8c2b215d83644d77657e1b88d0c7f226d155fb9f5251968e0c8897964a02f"
  ],
  "codument/std/commands/upgrade-workspace.md": [
    "sha256:b4ded6855fafb5002d75ec13916c49bcf7904195b2e61042a41f7f27bd6f6cca"
  ],
  "codument/std/compat/README.md": [
    "sha256:91dccef87157581db439beabf5ef47482834953ecd36182b241beb6ac6f0a837"
  ],
  "codument/std/kernel-pointer.md": [
    "sha256:e102239525db0613a6987214ed05fcd3aa01d5274c86d92bda8659a7f72673a7"
  ],
  "codument/std/kinds/KindDefinitions/AttractorProfiles/manifest.xnl": [
    "sha256:3885f946e01b9435ddc5850e3b72169de7919cc160787d5395b07ba8f1a51823"
  ],
  "codument/std/kinds/KindDefinitions/Behavior/manifest.xnl": [
    "sha256:b8e985a74a58cc1ab89ab2d038cfd293dfd3014df5a9c4c01951b4c452bd83bf"
  ],
  "codument/std/kinds/KindDefinitions/BehaviorPatch/manifest.xnl": [
    "sha256:b29df7622a39feafcca7c1462827c061c86bb3f56502eb138785cc544799fe4b"
  ],
  "codument/std/kinds/KindDefinitions/Decision/manifest.xnl": [
    "sha256:20ecb1f691b3e9f22adeb1a9853e203890cc11041d1a7b51ebbbf08543967e1a"
  ],
  "codument/std/kinds/KindDefinitions/EngineeringConfig/manifest.xnl": [
    "sha256:995306d7335e8cf0467781461f56b33eeef43360e2fd1eb40f9a16b638c105c1"
  ],
  "codument/std/kinds/KindDefinitions/Mission/manifest.xnl": [
    "sha256:beaac195159645975e3b2cd2c3262a7ffe33afeab0e040463377eca7eba38a53"
  ],
  "codument/std/kinds/KindDefinitions/ModelingConfig/manifest.xnl": [
    "sha256:706aa044efd5f09d03c034fb2a9b01acc676ac2843b587941e154382347e3425"
  ],
  "codument/std/kinds/KindDefinitions/OperationHooks/manifest.xnl": [
    "sha256:9e5d6bb7aa503747366806839d6c1e0ae8bcb694824eb6f618b1fe95b394de72"
  ],
  "codument/std/kinds/KindDefinitions/Track/manifest.xnl": [
    "sha256:8534ddd5233ad35f6451f818c7a6598f4044eb2644cef35c0d39f75dab3d75ea"
  ],
  "codument/std/kinds/manifest.xnl": [
    "sha256:2965a7a1fbabdf133d856c1694e230b75a5f831bfd0b742835cd9fc097990f85"
  ],
  "codument/std/methods/dag-execution.md": [
    "sha256:7a1acaeeb2211e6906448c51f8f9bfd735383a650f66f54e237db6e4c5255c60"
  ],
  "codument/std/methods/tdd.md": [
    "sha256:611650588b5cc26acb7109c1a48c9110309d63d5d93aa738281ea8ec2921635c"
  ],
  "codument/std/methods/workflow.md": [
    "sha256:113cecc6499c56360467792a0e9800f967a621877aedee9b5c2b6b1c3b7dfdbb",
    "sha256:1cdd89e85fb862446cbd39e5510871131564656b84a6a58d8611b8116789987e"
  ],
  "codument/std/operations/README.md": [
    "sha256:2a074b49f9cc5559496becafa969f745f74cd12433b8c1a0e0983df95016f402"
  ],
  "codument/std/operations/_operation-spec.md": [
    "sha256:a90723c2861ece9b45cd119b5fd13ba4c96fd1f4cf6a90f66f2fc7eb1caf85e8"
  ],
  "codument/std/operations/archive-mission.md": [
    "sha256:d233d905391ae6b3b3584ef3f8b0b4b9507dc55bf105048400f50e8bcec98f98"
  ],
  "codument/std/operations/archive-track.md": [
    "sha256:771a52cef012066cbb7512c8d080cc7e0ceeeebf77ca99090367a781d7edf81d",
    "sha256:1ff8d02f7132f6921a1d2ffcca1515acd84fbac0bd163f82c42ee273fb55d372"
  ],
  "codument/std/operations/artifact-sync.md": [
    "sha256:4ee05c2c4f57b70fc457f7f3f1c31e4efe8311252e4a099b4b9f9e974bc35795"
  ],
  "codument/std/operations/discuss.md": [
    "sha256:04a246310e2ec44d80275d0b31e3d0120f1a2d72e31a19644434576f34293be8",
    "sha256:5784b915758aec8bff120bbd5d77f7cccc95987c5d74a90db908f717733e5fbe"
  ],
  "codument/std/operations/docs-bootstrap.md": [
    "sha256:f7c62f062d900a953aca42782935e191c4fdfe347a5694bb344cddd72be04896"
  ],
  "codument/std/operations/gap-loop.md": [
    "sha256:3eebb62dc3924cf41e7b052902fc8ee499790cac690a64871ce08913c7abcfb0"
  ],
  "codument/std/operations/impl-mission.md": [
    "sha256:960eb0dc4f32ba507bb813691a766662baeee605975497d7d5d9cef61f197469",
    "sha256:c1f8db119d003a5d04d3a44ed913da41364ff70c86d7e9cc0aa6b438d551523b"
  ],
  "codument/std/operations/impl-quick.md": [
    "sha256:ab651887db875c4b81aa45d4d66f5196418eb9fb804f1aa8ed3ca2f43f35c7a7",
    "sha256:df484ba917630405d4c752d95564fdcb10512245abd413d0ad10676c548837ba"
  ],
  "codument/std/operations/impl-track.md": [
    "sha256:05207096f65167dde3154f51bced9c72a3f7e00d2945ef900bdb389249e30e34",
    "sha256:40f75f21b369c2a35f2a7ae549ab3ca4d2aa48f0119686812481c6a996bb2f6d"
  ],
  "codument/std/operations/maintain-track.md": [
    "sha256:8baaae2b09d405a6c4507a51149bf96db9358e761b00486ca276345bd59d97e8"
  ],
  "codument/std/operations/migrate.md": [
    "sha256:4d2aae9940d666de18afd55eed0079e61522cd2b41364e7fe166e2bf71c2741e"
  ],
  "codument/std/operations/plan-mission.md": [
    "sha256:4e6092350c95477d0a5c8aad9f72bd3e79eda2e2abb63eb7f03fd5e75023116a",
    "sha256:bd8034899b4fd897835892d642dd2260c9fb11f9b0a5e5050510cd470a3a1187"
  ],
  "codument/std/operations/plan-track.md": [
    "sha256:db4ac8d8b2c49a6cf448fbd75f790c9bcf0b201f4edcb0fcc2788333373265c7",
    "sha256:09659e135f01ee0eb6b2164a43d0c66e5047b7fd212323f201519e571b9f6970",
    "sha256:6b21dc87801f3ed128af074f177d5494d79615cb7105fa3e960a090c50846578"
  ],
  "codument/std/operations/validate.md": [
    "sha256:f979de176f6aa76e5a6938c604162708d7f3675e01b2125876a94dd5b984d43b"
  ],
  "codument/std/operations/verify.md": [
    "sha256:2def648100c298c600a7fb192180e03649b39a6f539e3d300f559701b036a9be"
  ],
  "codument/std/protocols/attractor-check.md": [
    "sha256:73f3a1fddf5b6fb463b38b904d68b4b806dfad72e1b0b8967ec3f943767f53b8"
  ],
  "codument/std/protocols/cybernetic-loop.md": [
    "sha256:88ec4157de8f53b26360aeaed2eff3a618c36b672b9dce3da6bc8ef2842da210"
  ],
  "codument/std/protocols/decision-tree.md": [
    "sha256:18737443f6a656848190273a6e2a1180939475830e69d3f486b3e15d4f9feb5c"
  ],
  "codument/std/protocols/questioning.md": [
    "sha256:0300aac5da534d0821bee1965ac9d44ec448150fbf80e05f11b9b2be9f26973d"
  ],
  "codument/std/protocols/validation.md": [
    "sha256:4d38ff041525b27000da52a4a779325e65c08080915a3eafc947af5ff163bd28"
  ],
  "codument/std/skill/docs-engineering-fractal/index.md": [
    "sha256:b9cfb6b4e349bc1a038b4e7c9086afb9de2a195699baa5abda05647a905dd3f7"
  ],
  "codument/std/skill/docs-modeling-fractal/index.md": [
    "sha256:d441023fa7bcea6b36386278b171fbde2ab330249746c6421cf25ff9542cc0b7"
  ],
  "codument/std/spec/behavior-delta.md": [
    "sha256:936584a995727e942ab5d032c0a1f9246d5ab7c6566f0133695b9998bb2974d5"
  ],
  "codument/std/spec/behavior-registry.md": [
    "sha256:6729594bc55bca493004761dc0b5731548080e0722d829852baaa017bfdefc26"
  ],
  "codument/std/spec/decision-registry.md": [
    "sha256:09de28078611035755c5e2ae9d128f84e566c85a1994f15f63e4251161a128df"
  ],
  "codument/std/spec/engineering-delta.md": [
    "sha256:d66fe3840cf903cdb6cb9ff8022b9153b036792163f21496e2b3b6ec6728451f"
  ],
  "codument/std/spec/engineering-node-schema.md": [
    "sha256:82ca6dc325cec80fe82a59e731b519529ff64544eb5fa765cc73f95013b90b9d"
  ],
  "codument/std/spec/engineering-registry.md": [
    "sha256:4084eb6b43bf6cab10d3ac105c4ab13ba2a4d1e2da665121bbb28638816144b0"
  ],
  "codument/std/spec/flow-notation.md": [
    "sha256:49d8d9e4ee0f33a0375f823874684951fafb0b2f20f93c4c25f0069aabeebf42"
  ],
  "codument/std/spec/folder-manifest.md": [
    "sha256:3c4986c2ac3cfe244900dd1a32540db90da43b1e9755ddbe141279a25e3e518f"
  ],
  "codument/std/spec/mission-xnl-spec.md": [
    "sha256:d2e435a57619fd3776e6b0b912441b5671bdcf62ccc761a52e399c1efc2857bf",
    "sha256:e449542feb8921c784d429485edbeec33bf49cbfb992244bd19adf692d646f4c"
  ],
  "codument/std/spec/modeling-delta.md": [
    "sha256:fe954e0bdeba23affebd80d23f22f9f3b89658395ad27a22bf8318287774f269"
  ],
  "codument/std/spec/modeling-node-schema.md": [
    "sha256:5c7a6acde740009ebe9c72f946d6deb4f7d168ee508cd9d30794639bb8883de4"
  ],
  "codument/std/spec/modeling-registry.md": [
    "sha256:d3440d1e382324292d1064a768fca1f106e6fcc4dac317b3a490de4fd276d26d"
  ],
  "codument/std/spec/track-xnl-spec.md": [
    "sha256:bc0e6863e6e0d2ce7ff15f440e5e8fda6580f41b0f169451b593f4a52d119f44"
  ],
  "codument/std/spec/xnl-format.md": [
    "sha256:dde1ac3aa8f715e62d4531bee89f6762780de0e6963245a6c8965613f99487bd",
    "sha256:c254abbced19a400da854da68775adb9b0825b31e7eb964c99583811d8e23a43"
  ]
};
