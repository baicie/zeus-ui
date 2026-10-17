# @zeus-web/registry

Source component registry templates for Zeus Web.

## Overview

This package contains the source templates used by `@zeus-web/cli` to scaffold and update component files in your project.

The registry is consumed by the CLI and is not typically imported directly.

## Component quality

`quality.json` is the machine-readable quality catalog for primitive
components. Each entry links its quality level to checked-in evidence paths.
`experimental` requires a published package entry, `beta` requires behavior
and accessibility tests, and `stable` additionally requires an end-to-end
test. The catalog validator verifies the component inventory, level names,
evidence paths, and these minimum thresholds; it does not infer quality from
component count or claim manual review that has not happened.
