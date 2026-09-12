# Codument CLI shell

Adapts a CLI invocation to an owned Codument product Host and guarantees disposal. Parsing and help use the public Halfcode shell. Product result formatting preserves original raw domain JSON and lifecycle text; captured verifier output is bound separately from JSON output. The main product CLI registers the same lifecycle adapters with a local/domain runtime. This does not replace the root distribution bin or merge `init`, `status`, or `upgrade-workspace`.
