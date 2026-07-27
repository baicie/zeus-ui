# Interactive Playground

Every public Zeus Web component package has an independent live Playground.
Open a component to interact with its Web Component build and compare source
for every framework the package actually exports.

<ClientOnly>
<PlaygroundDirectory />
</ClientOnly>

## Notes

The live preview uses the package's `wc/auto` entry because VitePress is a Vue
application. Each page displays separate Web Component, React and Vue source
only when the corresponding package export exists.
