# @zeus-web/registry

Source component registry templates for Zeus Web.

## Overview

This package contains the source templates used by `@zeus-web/cli` to scaffold and update component files in your project.

The registry is consumed by the CLI and is not typically imported directly.

## Public components

The bundled registry ships React and Vue source for accordion, alert, avatar,
badge, button, card, checkbox, collapsible, dialog, input, label, progress,
radio group, select, separator, skeleton, switch, tabs, textarea and tooltip.
Run `zweb list --json` for the current machine-readable inventory.

## Component quality

`quality.json` is the machine-readable quality catalog for primitive
components. Each entry links its quality level to checked-in evidence paths.
`experimental` requires a published package entry, `beta` requires behavior
and accessibility tests, and `stable` additionally requires an end-to-end
test. The catalog validator verifies the component inventory, level names,
evidence paths, and these minimum thresholds; it does not infer quality from
component count or claim manual review that has not happened.
